import { Body, Controller, Get, HttpCode, Logger, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { AgencyService } from "../agency/agency";
import { escapeHtml } from "../auth/auth.service";
import { badRequest, unauthorized } from "../common/errors";
import { uniqueId } from "../common/ids";
import { DbService } from "../db/db.service";
import { MailerService } from "../mail/mailer.service";
import { DocumentsService } from "./documents.service";

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
const SOURCES = ["newsletter", "contact", "quote"];
/** Champs structurés d'une demande de devis (formulaire « voyage sur mesure »). */
const QUOTE_FIELDS: [string, string][] = [
  ["destination", "Destination"],
  ["period", "Période"],
  ["travelers", "Voyageurs"],
  ["budget", "Budget"],
];

/**
 * Prospects du site (inscription newsletter, demande de contact / de devis) :
 * un document `clients` créé côté serveur — la collection reste fermée aux
 * visiteurs. Un email déjà connu est complété, pas dupliqué. Les demandes de
 * contact et de devis sont aussi envoyées par email à l'agence.
 */
@Controller("v1/leads")
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(
    private readonly db: DbService,
    private readonly docs: DocumentsService,
    private readonly mailer: MailerService,
    private readonly agency: AgencyService,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() body: Record<string, unknown>) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200) throw badRequest("Adresse email invalide.");
    const source = SOURCES.includes(String(body.source)) ? String(body.source) : "newsletter";
    const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
    const details = QUOTE_FIELDS.map(([k, label]) => [label, clip(body[k], 120)]).filter(([, v]) => v);
    const message = [details.map(([l, v]) => `${l} : ${v}`).join(" · "), clip(body.message, 1500)].filter(Boolean).join("\n");
    const note = `[${source} — ${new Date().toISOString().slice(0, 10)}] ${message}`.trim();

    const { rows } = await this.db.query<{ id: string; data: Record<string, unknown> }>(
      "SELECT id, data FROM documents WHERE collection = 'clients' AND lower(data->>'email') = $1 LIMIT 1",
      [email],
    );
    if (rows[0]) {
      const notes = [String(rows[0].data.notes ?? ""), note].filter(Boolean).join("\n");
      await this.docs.patch("clients", rows[0].id, { notes: notes.slice(-4000), ...(source === "newsletter" ? { newsletter: true } : {}) });
    } else {
      await this.docs.insert("clients", uniqueId(), {
        name: clip(body.name, 120),
        email,
        phone: clip(body.phone, 40),
        notes: note,
        source,
        newsletter: source === "newsletter",
      });
    }
    if (source !== "newsletter") await this.notifyAgency(source, { name: clip(body.name, 120), email, phone: clip(body.phone, 40), subject: clip(body.subject, 120) }, details, clip(body.message, 1500));
    // Même réponse que l'email soit nouveau ou connu.
    return { success: true };
  }

  /** Client connecté : est-il inscrit à la newsletter (fiche `clients` de son email) ? */
  @Get("newsletter")
  async newsletterStatus(@Req() req: Request) {
    if (!req.user) throw unauthorized();
    const row = await this.clientByEmail(req.user.email);
    return { subscribed: row?.data.newsletter === true };
  }

  /**
   * Client connecté : inscription / désinscription en un clic, sur l'email du
   * compte (pas de saisie). Désinscription = `newsletter: false` sur sa fiche,
   * la fiche et ses notes restent (historique pour l'agence).
   */
  @Put("newsletter")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async newsletterSet(@Req() req: Request, @Body() body: Record<string, unknown>) {
    if (!req.user) throw unauthorized();
    const subscribed = body.subscribed === true;
    const email = String(req.user.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) throw badRequest("Adresse email invalide.");
    const note = `[newsletter — ${new Date().toISOString().slice(0, 10)}] ${subscribed ? "Inscription depuis l'espace client" : "Désinscription depuis l'espace client"}`;
    const row = await this.clientByEmail(email);
    if (row) {
      const notes = [String(row.data.notes ?? ""), note].filter(Boolean).join("\n");
      await this.docs.patch("clients", row.id, { newsletter: subscribed, notes: notes.slice(-4000) });
    } else if (subscribed) {
      await this.docs.insert("clients", uniqueId(), {
        name: String(req.user.name ?? "").slice(0, 120),
        email,
        phone: "",
        notes: note,
        source: "newsletter",
        newsletter: true,
      });
    }
    return { subscribed };
  }

  private async clientByEmail(email: string) {
    const { rows } = await this.db.query<{ id: string; data: Record<string, unknown> }>(
      "SELECT id, data FROM documents WHERE collection = 'clients' AND lower(data->>'email') = $1 LIMIT 1",
      [String(email ?? "").trim().toLowerCase()],
    );
    return rows[0] ?? null;
  }

  /** Email à l'agence — au mieux : un SMTP en panne ne doit pas perdre la demande (déjà enregistrée). */
  private async notifyAgency(source: string, who: Record<string, string>, details: string[][], message: string) {
    if (!this.mailer.configured) return;
    try {
      const agency = await this.agency.get();
      const to = agency.email || this.mailer.senderAddress;
      const rows = [["Nom", who.name], ["Email", who.email], ["Téléphone", who.phone], ["Objet", who.subject], ...details]
        .filter(([, v]) => v)
        .map(([l, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(l)}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>`)
        .join("");
      const kind = source === "quote" ? "Demande de devis" : "Message de contact";
      await this.mailer.send({
        to,
        replyTo: who.email,
        fromName: agency.tradeName || undefined,
        subject: `${kind} — ${who.name || who.email}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a"><h2 style="font-size:17px">${kind} depuis le site</h2><table>${rows}</table>${message ? `<p style="white-space:pre-wrap;border-left:3px solid #e8630a;padding-left:12px">${escapeHtml(message)}</p>` : ""}<p style="color:#64748b;font-size:12px">Répondez directement à cet email pour écrire au client. La demande est aussi enregistrée dans Clients.</p></div>`,
      });
    } catch (e) {
      this.logger.warn(`Notification de demande ${source} non envoyée : ${(e as Error).message}`);
    }
  }
}
