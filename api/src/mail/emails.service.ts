import { Injectable, Logger } from "@nestjs/common";
import { Agency, AgencyService } from "../agency/agency";
import { AuditService } from "../audit/audit.service";
import { badRequest, forbidden, notFound, unauthorized } from "../common/errors";
import { DbService } from "../db/db.service";
import { DocumentsService, toDocument } from "../collections/documents.service";
import type { Caller } from "../collections/policies";
import { DocumentType, PdfService } from "../pdf/pdf.service";
import { reservationTravel } from "../finance/schedule";
import { MailerService } from "./mailer.service";
import { InboxService } from "./inbox.service";
import { packagePath } from "../common/slug";
import { escapeHtml } from "../auth/auth.service";
import {
  EMAIL_SETTINGS_KIND,
  EMAIL_TRIGGERS,
  EmailSettings,
  buildReservationParams,
  emailSettingsFromProducts,
  renderTemplate,
  reservationClientEmail,
  splitEmails,
  templateEnvelope,
  triggerConfig,
} from "./templates";

/** Documents joints automatiquement, par étape du dossier. */
const ATTACHMENTS: Record<string, DocumentType[]> = {
  // Fiche de réservation complète + facture (état de paiement) + CGV à part.
  reservation_created_client: ["reservation", "facture", "cgv"],
  reservation_confirmed: ["reservation", "facture"],
  reservation_paid: ["facture"],
  payment_reminder: ["facture"],
};

/** Documents remis au client par le bouton « Envoyer au client » du dashboard. */
const CLIENT_PACK: DocumentType[] = ["reservation", "facture", "cgv"];

const frDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

function agencyParams(a: Agency): Record<string, string> {
  const site = a.website ? (a.website.startsWith("http") ? a.website : `https://${a.website}`) : "";
  return {
    company_name: a.tradeName,
    site_url: site,
    agency_name: a.tradeName,
    agency_phone: (a.phones || []).join(" · "),
    agency_whatsapp: a.whatsapp,
    agency_email: a.email,
    agency_rib: a.rib ? `${a.bankName ? `${a.bankName} — ` : ""}${a.rib}` : "",
    // Espace client : valider ou annuler la réservation.
    client_space_url: PdfService.clientSpaceUrl(a),
  };
}

/**
 * Emails de réservation — remplace l'Appwrite Function d'envoi.
 *
 * Les destinataires et les variables sont TOUJOURS calculés ici à partir de
 * la réservation en base, jamais pris du client : un compte connecté ne peut
 * pas se servir de l'API pour envoyer des emails à des adresses arbitraires.
 */
@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    private readonly db: DbService,
    private readonly docs: DocumentsService,
    private readonly mailer: MailerService,
    private readonly agency: AgencyService,
    private readonly pdf: PdfService,
    private readonly audit: AuditService,
    private readonly inbox: InboxService,
  ) {}

  private async settings(): Promise<EmailSettings | null> {
    const { rows } = await this.db.query<{ data: Record<string, unknown> }>(
      `SELECT data FROM documents WHERE collection = 'products' AND data->>'data' LIKE $1`,
      [`%${EMAIL_SETTINGS_KIND}%`],
    );
    return emailSettingsFromProducts(rows.map((r) => r.data));
  }

  /**
   * Qui peut déclencher quoi :
   *   - équipe (admin, conseiller, comptable) : tout déclencheur, toute réservation ;
   *   - client propriétaire : uniquement "reservation_cancelled" sur sa
   *     réservation déjà annulée (annulation self-service).
   * La création publique (POST /v1/reservations) déclenche elle-même ses emails.
   */
  async trigger(triggerKey: string, reservationId: string, caller: Caller | null) {
    if (!EMAIL_TRIGGERS[triggerKey]) throw badRequest(`Déclencheur inconnu : ${triggerKey}`);
    if (!caller) throw unauthorized();

    const row = await this.docs.findRow("reservations", reservationId).catch(() => null);
    if (!row) throw notFound("document_not_found", "Réservation introuvable.");
    const reservation = toDocument(row);

    if (!caller.isStaff) {
      const isOwner = row.data.userId === caller.id;
      if (!isOwner) throw notFound("document_not_found", "Réservation introuvable.");
      if (triggerKey !== "reservation_cancelled" || row.data.status !== "cancelled") throw forbidden();
    }

    return this.sendForReservation(triggerKey, reservation, {}, caller);
  }

  /** Envoie l'email configuré pour ce déclencheur. `sent: false` si désactivé / sans destinataire. */
  async sendForReservation(
    triggerKey: string,
    reservation: Record<string, unknown>,
    extraParams: Record<string, string> = {},
    caller: Caller | null = null,
  ) {
    const settings = await this.settings();
    const cfg = triggerConfig(settings, triggerKey);
    if (!cfg.enabled || !cfg.templateId) return { sent: false, reason: "trigger_disabled" };

    const to =
      EMAIL_TRIGGERS[triggerKey].audience === "admin"
        ? splitEmails(settings?.adminEmails)
        : [reservationClientEmail(reservation)].filter(Boolean);
    if (!to.length) return { sent: false, reason: "no_recipient" };

    const template = await this.docs.findRow("email_templates", cfg.templateId).catch(() => null);
    if (!template) {
      this.logger.error(`template ${cfg.templateId} introuvable pour ${triggerKey}`);
      return { sent: false, reason: "template_not_found" };
    }

    const agency = await this.agency.get();
    const createdAt = new Date(String(reservation.$createdAt ?? Date.now()));
    const travel = reservationTravel(reservation, createdAt);
    const params = {
      ...buildReservationParams(reservation),
      ...(await this.packageParams(String(reservation.packageId ?? ""))),
      ...agencyParams(agency),
      reservation_travel_start: frDate(travel?.travelStart),
      reservation_travel_end: frDate(travel?.travelEnd),
      ...extraParams,
    };
    const data = template.data as Record<string, string>;
    const { subject, html } = renderTemplate(data, params);

    // Pièces jointes : un document impossible à produire n'empêche pas l'email de partir.
    const id = String(reservation.$id);
    const attachments = await this.renderPack(id, ATTACHMENTS[triggerKey] ?? []);

    // Copie dans la boîte de réception de l'espace client (emails au client uniquement).
    if (EMAIL_TRIGGERS[triggerKey].audience !== "admin") {
      await this.inbox.record({
        email: to[0],
        userId: (reservation.userId as string) || null,
        subject,
        html,
        kind: triggerKey,
        reservationId: id,
        attachments: ATTACHMENTS[triggerKey] ?? [],
      });
    }
    await this.mailer.send({ to, subject, html, attachments, ...templateEnvelope(data, this.mailer.senderAddress) });
    await this.audit.record({
      caller,
      collection: "reservations",
      documentId: id,
      action: "email",
      message: `${triggerKey} → ${to.join(", ")}${attachments.length ? ` (+${attachments.length} PDF)` : ""}`,
    });
    return { sent: true, recipients: to.length, attachments: attachments.length };
  }

  private async renderPack(id: string, types: DocumentType[]) {
    const attachments: { filename: string; content: Buffer }[] = [];
    for (const type of types) {
      try {
        const doc = await this.pdf.render(type, id);
        attachments.push({ filename: doc.filename, content: doc.buffer });
      } catch (err) {
        this.logger.warn(`pièce jointe ${type} non générée pour ${id} : ${(err as Error).message}`);
      }
    }
    return attachments;
  }

  /**
   * Envoi au client de son dossier : fiche de réservation, facture (état de
   * paiement) et conditions de vente, avec le lien pour valider ou annuler
   * depuis son espace. Email intégré : ne dépend d'aucun template.
   */
  async sendReservationDocuments(id: string, caller: Caller) {
    const row = await this.docs.findRow("reservations", id);
    const r = { ...row.data, $id: id } as Record<string, any>;
    const to = reservationClientEmail(r);
    if (!to) throw badRequest("Aucune adresse email client sur ce dossier.");
    const agency = await this.agency.get();
    const travel = reservationTravel(r, row.created_at);
    const space = PdfService.clientSpaceUrl(agency);
    const attachments = await this.renderPack(id, CLIENT_PACK);
    const name = escapeHtml(String(r.userName || "").split(" ")[0] || "");
    const line = (k: string, v: string) => `<tr><td style="padding:4px 14px 4px 0;color:#7a6a55">${k}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f1a14;max-width:560px">
<p>Bonjour ${name},</p>
<p>Vous trouverez ci-joint votre <b>fiche de réservation</b> (détail complet du voyage), votre <b>facture</b> avec l'état de vos paiements et nos <b>conditions de vente et d'annulation</b>.</p>
<table style="border-collapse:collapse;margin:12px 0">${line("Dossier", String(r.ref || ""))}${line("Voyage", String(r.packageTitle || ""))}${line("Dates", `${frDate(travel?.travelStart)} → ${frDate(travel?.travelEnd)}`)}${line("Voyageurs", String(r.totalPax || ""))}</table>
<p><b>Merci de vérifier ces informations puis de valider votre réservation</b> — ou de l'annuler — depuis votre espace client :</p>
<p style="margin:22px 0"><a href="${space}" style="background:#8a6326;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Valider ou annuler ma réservation</a></p>
<p style="color:#7a6a55;font-size:12px">La validation vaut acceptation de la fiche et des conditions de vente jointes. Une question ? Répondez simplement à cet email ou appelez-nous : ${escapeHtml((agency.phones || []).join(" · "))}.</p>
<p>${escapeHtml(agency.tradeName)}</p></div>`;
    const subject = `Votre réservation ${r.ref || ""} — ${r.packageTitle || ""}`.trim();
    await this.inbox.record({ email: to, userId: r.userId || null, subject, html, kind: "documents", reservationId: id, attachments: CLIENT_PACK });
    await this.mailer.send({
      to,
      subject,
      html,
      attachments,
      fromName: agency.tradeName,
      replyTo: agency.email || undefined,
    });
    await this.docs.patch("reservations", id, { documentsSentAt: new Date().toISOString() });
    await this.audit.record({ caller, collection: "reservations", documentId: id, action: "email", message: `Fiche de réservation, facture et conditions de vente → ${to} (+${attachments.length} PDF)` });
    return { sent: true, to, attachments: attachments.length };
  }

  /**
   * Message libre de l'équipe au client d'un dossier : copie dans sa boîte de
   * réception (toujours), email si le SMTP est configuré (au mieux).
   */
  async sendClientMessage(id: string, caller: Caller, subject: string, text: string) {
    const row = await this.docs.findRow("reservations", id);
    const r = row.data as Record<string, any>;
    const to = reservationClientEmail({ ...r, $id: id });
    if (!to && !r.userId) throw badRequest("Aucun client (compte ou email) sur ce dossier.");
    const agency = await this.agency.get();
    const name = escapeHtml(String(r.userName || "").split(" ")[0] || "");
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f1a14;max-width:560px">
${name ? `<p style="margin:0 0 12px">Bonjour ${name},</p>` : ""}${paragraphs}
<p style="margin:16px 0 0;color:#7a6a55;font-size:12px">Dossier ${escapeHtml(String(r.ref || ""))} — ${escapeHtml(String(r.packageTitle || ""))}</p>
<p style="margin:4px 0 0">${escapeHtml(agency.tradeName)}</p></div>`;
    await this.inbox.record({ email: to || "", userId: r.userId || null, subject, html, kind: "agency_message", reservationId: id });
    let emailed = false;
    if (to && this.mailer.configured) {
      try {
        await this.mailer.send({ to, subject, html, fromName: agency.tradeName, replyTo: agency.email || undefined });
        emailed = true;
      } catch (err) {
        this.logger.warn(`message client ${id} : email non envoyé (${(err as Error).message})`);
      }
    }
    await this.audit.record({ caller, collection: "reservations", documentId: id, action: "email", message: `Message au client : « ${subject} »${emailed ? ` → ${to}` : " (espace client)"}` });
    return { sent: true, emailed, to: to || null };
  }

  /** Alerte à l'agence : le client a validé sa fiche (au mieux, sans bloquer). */
  async notifyClientValidation(id: string) {
    if (!this.mailer.configured) return;
    const row = await this.docs.findRow("reservations", id);
    const r = row.data as Record<string, any>;
    const settings = await this.settings();
    const agency = await this.agency.get();
    const to = splitEmails(settings?.adminEmails);
    if (!to.length && agency.email) to.push(agency.email);
    if (!to.length) return;
    await this.mailer.send({
      to,
      fromName: agency.tradeName,
      subject: `Réservation ${r.ref || ""} validée par le client`,
      html: `<p>Le client <b>${escapeHtml(String(r.userName || r.userEmail || ""))}</b> a validé sa fiche de réservation <b>${escapeHtml(String(r.ref || ""))}</b> (${escapeHtml(String(r.packageTitle || ""))}) et accepté les conditions de vente.</p>`,
    });
  }

  /** Variables package_* du catalogue (emailVariables.js), lues sur le package réservé. */
  private async packageParams(packageId: string): Promise<Record<string, string>> {
    if (!packageId) return {};
    const row = await this.docs.findRow("products", packageId).catch(() => null);
    if (!row) return {};
    let blob: Record<string, any> = {};
    try {
      blob = typeof row.data.data === "string" ? JSON.parse(row.data.data) : ((row.data.data as Record<string, any>) ?? {});
    } catch {
      blob = {};
    }
    const nf = new Intl.NumberFormat("fr-FR");
    return {
      package_destination: `${blob.destination ?? ""}${blob.destinationAccent ?? ""}`.trim() || String(row.data.title ?? ""),
      package_country: String(row.data.country ?? blob.country ?? ""),
      package_duration: String(blob.durationLabel ?? ""),
      package_price: row.data.basePrice ? nf.format(Number(row.data.basePrice)).replace(/ /g, " ") : "",
      package_phone: String(blob.phone1 ?? ""),
      package_website: String(blob.website ?? ""),
    };
  }

  /**
   * Relance d'un client qui a abandonné sa réservation (événement analytics
   * « abandon »), envoyée à la main depuis le dashboard.
   */
  async abandonFollowup(userId: string, packageId: string, caller: Caller) {
    const settings = await this.settings();
    const cfg = triggerConfig(settings, "booking_abandoned");
    if (!cfg.templateId) throw badRequest("Choisissez un template pour « Réservation abandonnée » dans Paramètres → Notifications.");
    const { rows } = await this.db.query<{ email: string; name: string }>("SELECT email, name FROM users WHERE id = $1", [userId]);
    if (!rows[0]) throw notFound("user_not_found", "Compte introuvable.");
    const pkg = await this.docs.findRow("products", packageId).catch(() => null);
    const template = await this.docs.findRow("email_templates", cfg.templateId);
    const agency = await this.agency.get();
    const site = agency.website.startsWith("http") ? agency.website : `https://${agency.website}`;
    const { subject, html } = renderTemplate(template.data as Record<string, string>, {
      ...agencyParams(agency),
      client_name: rows[0].name || "",
      client_email: rows[0].email,
      package_title: String(pkg?.data.title ?? ""),
      package_url: `${site.replace(/\/$/, "")}${packagePath(packageId, String(pkg?.data.title ?? ""))}`,
    });
    await this.inbox.record({ email: rows[0].email, userId, subject, html, kind: "booking_abandoned" });
    await this.mailer.send({ to: rows[0].email, subject, html, ...templateEnvelope(template.data, this.mailer.senderAddress) });
    await this.audit.record({ caller, collection: "users", documentId: userId, action: "email", message: `booking_abandoned (${packageId})` });
    return { sent: true };
  }

  /** Bouton « envoyer un test » de l'éditeur de templates (admin). */
  async test(templateId: string, to: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw badRequest("Adresse email invalide.");
    const template = await this.docs.findRow("email_templates", templateId).catch(() => null);
    if (!template) throw notFound("document_not_found", "Template introuvable.");
    const data = template.data as Record<string, unknown>;

    // Variables remplacées par leurs valeurs par défaut (champ `variables` du template,
    // [{ key, default }] — cf. applyVariables dans Emailmanager.jsx).
    let previews: { key?: string; default?: string }[] = [];
    try {
      previews = typeof data.variables === "string" ? JSON.parse(data.variables) : (data.variables as typeof previews) || [];
    } catch {
      previews = [];
    }
    const params = Object.fromEntries(
      (Array.isArray(previews) ? previews : [])
        .filter((v) => v?.key)
        .map((v) => [v.key!, String(v.default ?? "")]),
    );

    const { subject, html } = renderTemplate(data as Record<string, string>, params);
    // Expéditeur et réponse comme en vrai, mais sans Cc/Cci : un test ne
    // doit pas atterrir chez les destinataires en copie du template.
    const { fromName, replyTo } = templateEnvelope(data, this.mailer.senderAddress);
    await this.mailer.send({ to, subject: `[TEST] ${subject}`, html, fromName, replyTo });
    return { sent: true };
  }
}
