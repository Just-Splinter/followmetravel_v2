import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import { Agency, AgencyService, cancellationLines } from "../agency/agency";
import { DocumentsService, Row } from "../collections/documents.service";
import { DbService } from "../db/db.service";
import { badRequest, notFound } from "../common/errors";
import { financeOf } from "../finance/schedule";
import { PackageData, lineItems, parseJSON } from "../reservations/pricing";
import { addDays, todayIso } from "../reservations/travel-dates";
import { GOLD, Layout, clean, frDate, money } from "./layout";
import { renderCgv } from "./cgv";
import { FicheRenderer } from "./fiche";
import { amountInWords } from "./words";

export const DOCUMENT_TYPES = ["reservation", "facture", "cgv", "devis", "contrat", "programme", "recu", "voucher", "echeancier"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  reservation: "Fiche de réservation",
  cgv: "Conditions de vente",
  devis: "Devis",
  contrat: "Contrat de vente",
  programme: "Programme du voyage",
  facture: "Facture",
  recu: "Reçu de paiement",
  voucher: "Bon d'échange hôtel",
  echeancier: "Échéancier de paiement",
};

const METHODS: Record<string, string> = {
  cash: "Espèces", transfer: "Virement", card: "Carte bancaire", check: "Chèque", other: "Autre",
};

interface Participant {
  fullName?: string; civility?: string; phone?: string; email?: string; birthDate?: string;
  nationality?: string; passportNumber?: string; passportExpiry?: string;
}
interface Payment { id?: string; date?: string; amount?: number; method?: string; reference?: string; note?: string }
interface ResHotel { name?: string; hotelId?: string; rooms?: { type?: string; qty?: unknown }[]; pax?: unknown }

interface Context {
  r: Record<string, any>;
  row: Row;
  agency: Agency;
  pkg: PackageData & Record<string, any>;
  pkgTop: Record<string, any>;
  participants: Participant[];
  payments: Payment[];
  hotels: ResHotel[];
  finance: ReturnType<typeof financeOf>;
}

@Injectable()
export class PdfService {
  constructor(
    private readonly docs: DocumentsService,
    private readonly agencyService: AgencyService,
    private readonly db: DbService,
  ) {}

  /** Lien vers l'espace client (validation / annulation) sur le site de l'agence. */
  static clientSpaceUrl(a: Agency) {
    const site = a.website ? (a.website.startsWith("http") ? a.website : `https://${a.website}`) : "";
    return `${site.replace(/\/$/, "")}/profil#reservations`;
  }

  private async agentName(userId: unknown): Promise<string | null> {
    if (!userId) return null;
    const { rows } = await this.db.query<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = $1", [String(userId)]);
    return rows[0] ? rows[0].name || rows[0].email : null;
  }

  /**
   * Photo de la destination pour la fiche, convertie en JPEG 900 px (pdfkit
   * ne lit que JPEG/PNG ; les images du site sont souvent en WebP ou AVIF).
   */
  private async photo(url: unknown): Promise<Buffer | null> {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return await sharp(buf).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    } catch {
      return null;
    }
  }

  private async reservation(c: Context) {
    return new FicheRenderer({
      r: c.r,
      agency: c.agency,
      pkg: c.pkg,
      participants: c.participants,
      payments: c.payments,
      hotels: c.hotels,
      finance: c.finance,
      agentName: await this.agentName(c.r.assignedTo),
      photo: await this.photo(c.pkg.heroBg),
      clientSpaceUrl: PdfService.clientSpaceUrl(c.agency),
    }).render();
  }

  private async context(reservationId: string): Promise<Context> {
    const row = await this.docs.findRow("reservations", reservationId);
    const r = row.data as Record<string, any>;
    const agency = await this.agencyService.get();
    const pkgRow = r.packageId ? await this.docs.findRow("products", String(r.packageId)).catch(() => null) : null;
    return {
      r,
      row,
      agency,
      pkg: parseJSON<PackageData & Record<string, any>>(pkgRow?.data.data, {}),
      pkgTop: (pkgRow?.data ?? {}) as Record<string, any>,
      participants: parseJSON<Participant[]>(r.participants, []).filter((p) => p && (p.fullName || p.passportNumber)),
      payments: parseJSON<Payment[]>(r.payments, []),
      hotels: parseJSON<ResHotel[]>(r.hotels, []),
      finance: financeOf(r, row.created_at, agency, todayIso()),
    };
  }

  private clientBlock(l: Layout, c: Context) {
    const lead = c.participants[0];
    l.section("Client");
    l.keyValues([
      ["Nom", c.r.userName || lead?.fullName],
      ["Téléphone", lead?.phone],
      ["Email", c.r.userEmail || lead?.email],
      ["Référence dossier", c.r.ref],
    ]);
  }

  private tripBlock(l: Layout, c: Context) {
    l.section("Voyage");
    l.keyValues([
      ["Voyage", c.r.packageTitle],
      ["Formule", c.r.category || "—"],
      ["Départ", frDate(c.finance.travel?.travelStart) + (c.r.dateFrom ? ` (${c.r.dateFrom})` : "")],
      ["Retour", frDate(c.finance.travel?.travelEnd) + (c.r.dateTo ? ` (${c.r.dateTo})` : "")],
      ["Voyageurs", String(c.r.totalPax ?? c.participants.length)],
      ["Durée", c.pkg.durationLabel || "—"],
    ]);
  }

  private priceTable(l: Layout, c: Context, withPayments: boolean) {
    const items = lineItems(c.r, c.pkg);
    const totals: [string, string][] = [["Total TTC", money(c.finance.total)]];
    if (withPayments) {
      totals.push(["Déjà réglé", money(c.finance.paid)], ["Reste à payer", money(c.finance.remaining)]);
    }
    l.table(
      [
        { header: "Désignation", width: 50 },
        { header: "Quantité", width: 22 },
        { header: "Prix unitaire", width: 14, align: "right" },
        { header: "Montant", width: 14, align: "right" },
      ],
      items.map((i) => [i.label, i.quantity, i.unit !== undefined ? money(i.unit) : "", money(i.amount)]),
      { totals },
    );
  }

  private scheduleTable(l: Layout, c: Context) {
    const STATUS: Record<string, string> = { paid: "Réglée", partial: "Partielle", overdue: "En retard", due: "À régler ce jour", upcoming: "À venir" };
    if (!c.finance.installments.length) return;
    l.table(
      [
        { header: "Échéance", width: 34 },
        { header: "Date limite", width: 18 },
        { header: "Montant", width: 16, align: "right" },
        { header: "Reste", width: 16, align: "right" },
        { header: "Statut", width: 16 },
      ],
      c.finance.installments.map((i) => [i.label, frDate(i.dueDate), money(i.amount), money(i.remaining), STATUS[i.status]]),
    );
  }

  private bankBlock(l: Layout, a: Agency) {
    if (!a.rib) return;
    l.paragraph(`Règlement par virement : ${a.bankName ? `${a.bankName} — ` : ""}RIB ${a.rib}. Merci d'indiquer la référence du dossier en libellé.`, { muted: true });
  }

  private travellersTable(l: Layout, c: Context) {
    if (!c.participants.length) {
      l.paragraph("Liste des voyageurs à compléter.", { muted: true });
      return;
    }
    l.table(
      [
        { header: "#", width: 5 },
        { header: "Nom complet", width: 35 },
        { header: "Naissance", width: 15 },
        { header: "Passeport", width: 22 },
        { header: "Expiration", width: 15 },
      ],
      c.participants.map((p, i) => [
        String(i + 1),
        [p.civility, p.fullName].filter(Boolean).join(" "),
        frDate(p.birthDate),
        p.passportNumber || "—",
        frDate(p.passportExpiry),
      ]),
    );
  }

  // ── Documents ───────────────────────────────────────────────────

  private async devis(c: Context) {
    const issued = c.row.created_at.toISOString().slice(0, 10);
    const l = new Layout(c.agency, "Devis", [
      { label: "N°", value: `D-${c.r.ref || c.row.id}` },
      { label: "Date", value: frDate(issued) },
      { label: "Valable jusqu'au", value: frDate(addDays(issued, 7)) },
    ]);
    this.clientBlock(l, c);
    this.tripBlock(l, c);
    l.section("Détail du prix");
    this.priceTable(l, c, false);
    l.section("Conditions de paiement");
    this.scheduleTable(l, c);
    this.bankBlock(l, c.agency);
    l.section("Conditions d'annulation");
    for (const line of cancellationLines(c.pkg.cancellationPolicy ?? c.agency.cancellationPolicy)) l.paragraph(`• ${line}`);
    l.paragraph("Devis établi sous réserve de disponibilité au moment de la confirmation. Les prix sont exprimés en dirhams marocains, toutes taxes comprises.", { muted: true });
    return l.finish();
  }

  private async contrat(c: Context) {
    const l = new Layout(c.agency, "Contrat de vente", [
      { label: "Dossier", value: c.r.ref || c.row.id },
      { label: "Date", value: frDate(todayIso()) },
    ]);
    const a = c.agency;
    l.section("Entre les soussignés");
    l.paragraph(
      `${a.legalName || a.tradeName}${a.licenceNumber ? `, agence de voyages titulaire de la licence n° ${a.licenceNumber}` : ""}${a.address ? `, sise ${a.address}${a.city ? `, ${a.city}` : ""}` : ""}${a.ice ? `, ICE ${a.ice}` : ""}, ci-après « l'Agence »,`,
    );
    l.paragraph(`et ${c.r.userName || c.participants[0]?.fullName || "le client"}${c.r.userEmail ? ` (${c.r.userEmail})` : ""}, agissant en son nom et pour le compte des voyageurs listés ci-dessous, ci-après « le Client ».`);
    this.tripBlock(l, c);
    l.section("Voyageurs");
    this.travellersTable(l, c);
    l.section("Prix et modalités de paiement");
    this.priceTable(l, c, true);
    this.scheduleTable(l, c);
    this.bankBlock(l, a);
    l.section("Conditions d'annulation");
    l.paragraph("Toute annulation doit être notifiée par écrit. Les frais suivants s'appliquent sur le prix total du voyage :");
    for (const line of cancellationLines(c.pkg.cancellationPolicy ?? a.cancellationPolicy)) l.paragraph(`• ${line}`);
    l.section("Conditions générales");
    l.paragraph(
      a.cgvText
        ? a.cgvText.replace(/[#*_`>]/g, "")
        : `Le présent contrat est soumis aux conditions générales de vente de l'Agence, consultables sur ${a.website || "le site de l'Agence"} (rubrique CGV), dont le Client reconnaît avoir pris connaissance. Le Client est responsable de la validité de ses documents de voyage (passeport valable au moins 6 mois après le retour, visas, vaccins).`,
    );
    l.signatures("Le Client", "L'Agence");
    return l.finish();
  }

  private async programme(c: Context) {
    const l = new Layout(c.agency, "Programme du voyage", [{ label: "Dossier", value: c.r.ref || c.row.id }]);
    const p = c.pkg;
    l.paragraph(`${c.r.packageTitle || ""}`, { bold: true, size: 14 });
    l.paragraph([p.tagline, p.durationLabel].filter(Boolean).join(" — "), { muted: true });
    this.tripBlock(l, c);
    const days: { num?: string; title?: string; theme?: string; activities?: { label?: string; optional?: boolean }[] }[] = Array.isArray(p.days) ? p.days : [];
    if (days.length) {
      l.section(p.itineraryTitle ? `Itinéraire — ${p.itineraryTitle}` : "Itinéraire");
      for (const d of days) {
        l.paragraph(`Jour ${d.num ?? ""} · ${d.title ?? ""}${d.theme ? ` — ${d.theme}` : ""}`, { bold: true });
        const acts = (d.activities || []).map((x) => `${x.label}${x.optional ? " (en option)" : ""}`).filter(Boolean);
        if (acts.length) l.paragraph(acts.map((x) => `• ${x}`).join("\n"));
      }
    }
    const sections: { title?: string; badge?: string; items?: { text?: string }[] }[] = Array.isArray(p.sections) ? p.sections : [];
    for (const s of sections) {
      if (!s.items?.length) continue;
      l.section(s.title || "Inclus");
      if (s.badge) l.paragraph(s.badge, { muted: true });
      l.paragraph(s.items.map((i) => `• ${i.text ?? ""}`).join("\n"));
    }
    const category = (p.hotelCategories || []).find((cat) => cat.label === c.r.category);
    if (category?.hotels?.length) {
      l.section(`Hébergement — formule ${category.label}`);
      l.table(
        [{ header: "Hôtel", width: 50 }, { header: "Ville", width: 25 }, { header: "Nuits", width: 12, align: "center" }, { header: "Catégorie", width: 13, align: "center" }],
        category.hotels.map((h) => [h.name || "", h.city || "", String(h.nights ?? ""), h.stars ? `${h.stars}*` : ""]),
      );
    }
    l.paragraph(`Contact pendant le voyage : ${(c.agency.phones || []).join(" · ")}${c.agency.whatsapp ? ` · WhatsApp ${c.agency.whatsapp}` : ""}`, { muted: true });
    return l.finish();
  }

  private async facture(c: Context) {
    // Avant émission (numéro définitif), la facture est une proforma : même
    // détail, avec l'état de paiement, pour l'envoyer dès la réservation.
    const proforma = !c.r.invoiceNumber;
    const l = new Layout(c.agency, proforma ? "Facture proforma" : "Facture", [
      { label: "N°", value: proforma ? `PRO-${c.r.ref || c.row.id}` : String(c.r.invoiceNumber) },
      { label: "Date", value: frDate(proforma ? todayIso() : String(c.r.invoiceDate || todayIso())) },
      { label: "Dossier", value: c.r.ref || c.row.id },
    ], { brand: GOLD.brand, brandFooter: "DES VOYAGES QUI RAPPROCHENT" });
    this.clientBlock(l, c);
    this.tripBlock(l, c);
    l.section("Détail");
    this.priceTable(l, c, true);
    l.callout(`Arrêtée la présente ${proforma ? "facture proforma" : "facture"} à la somme de ${amountInWords(c.finance.total)} TTC.`);
    l.section("État de paiement");
    const state = c.finance.remaining <= 0 ? "Payée" : c.finance.paid > 0 ? "Partiellement réglée" : "Non réglée";
    l.keyValues([
      ["Statut", state],
      ["Total TTC", money(c.finance.total)],
      ["Déjà réglé", money(c.finance.paid)],
      ["Reste à payer", money(c.finance.remaining)],
    ], 4);
    this.scheduleTable(l, c);
    if (c.payments.length) {
      l.section("Règlements reçus");
      l.table(
        [{ header: "Date", width: 18 }, { header: "Mode", width: 22 }, { header: "Référence", width: 40 }, { header: "Montant", width: 20, align: "right" }],
        c.payments.map((p) => [frDate(p.date), METHODS[p.method ?? ""] ?? p.method ?? "", p.reference || "", money(p.amount)]),
      );
    }
    this.bankBlock(l, c.agency);
    if (c.agency.invoiceMention) l.paragraph(c.agency.invoiceMention, { muted: true });
    if (proforma) l.paragraph("Document proforma : la facture définitive numérotée est émise par l'agence après règlement.", { muted: true });
    return l.finish();
  }

  private async recu(c: Context, paymentId?: string) {
    const index = c.payments.findIndex((p) => p.id === paymentId);
    if (!paymentId || index < 0) throw badRequest("Paiement introuvable (paramètre paymentId).");
    const p = c.payments[index];
    const paidUntil = c.payments.slice(0, index + 1).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const l = new Layout(c.agency, "Reçu de paiement", [
      { label: "N°", value: `R-${c.r.ref || c.row.id}-${index + 1}` },
      { label: "Date", value: frDate(p.date) },
    ]);
    this.clientBlock(l, c);
    l.section("Paiement");
    l.keyValues([
      ["Montant reçu", money(p.amount)],
      ["Mode de paiement", METHODS[p.method ?? ""] ?? p.method],
      ["Référence", p.reference || "—"],
      ["Pour le voyage", c.r.packageTitle],
    ]);
    l.callout(`Reçu la somme de ${amountInWords(Number(p.amount) || 0)}.`);
    l.keyValues([
      ["Total du dossier", money(c.finance.total)],
      ["Total réglé à cette date", money(paidUntil)],
      ["Reste à payer", money(Math.max(0, c.finance.total - paidUntil))],
    ], 3);
    if (p.note) l.paragraph(p.note, { muted: true });
    l.signatures("Le Client", "L'Agence");
    return l.finish();
  }

  private async voucher(c: Context, hotelIndex?: number) {
    if (!c.hotels.length) throw notFound("document_not_found", "Aucun hôtel sur ce dossier.");
    const list = hotelIndex === undefined ? c.hotels.map((h, i) => ({ h, i })) : [{ h: c.hotels[hotelIndex], i: hotelIndex }];
    if (list.some((x) => !x.h)) throw badRequest("Hôtel introuvable (paramètre hotel).");
    const category = (c.pkg.hotelCategories || []).find((cat) => cat.label === c.r.category);
    // Dates d'arrivée successives : départ du voyage + nuits des hôtels précédents (formule du package).
    let cursor = c.finance.travel?.travelStart ?? null;
    const stays = c.hotels.map((h) => {
      const row = category?.hotels?.find((x) => x.hotelId && x.hotelId === h.hotelId);
      const nights = Number(row?.nights) || 0;
      const checkIn = cursor;
      const checkOut = cursor && nights ? addDays(cursor, nights) : (c.hotels.length === 1 ? c.finance.travel?.travelEnd ?? null : null);
      cursor = checkOut;
      return { checkIn, checkOut, nights, city: row?.city, stars: row?.stars };
    });

    const l = new Layout(c.agency, "Bon d'échange hôtel", [{ label: "Dossier", value: c.r.ref || c.row.id }]);
    list.forEach(({ h, i }, n) => {
      if (n > 0) {
        l.doc.addPage();
        l.doc.y = l.doc.page.margins.top;
      }
      const s = stays[i];
      l.section(`Voucher ${i + 1} / ${c.hotels.length}`);
      l.keyValues([
        ["Hôtel", `${h.name ?? ""}${s.stars ? ` (${s.stars}*)` : ""}`],
        ["Ville", s.city ?? "—"],
        ["Arrivée", frDate(s.checkIn)],
        ["Départ", frDate(s.checkOut)],
        ["Nuits", s.nights ? String(s.nights) : "—"],
        ["Régime", "Petit déjeuner (sauf mention contraire au programme)"],
      ]);
      l.section("Chambres");
      l.paragraph((h.rooms || []).map((r) => `• ${Number(r.qty) || 0} × ${r.type}`).join("\n"));
      l.section("Occupants");
      this.travellersTable(l, c);
      l.callout(`Prestation réglée par ${c.agency.tradeName}. Merci de présenter ce bon à la réception de l'hôtel avec vos passeports.`);
      l.paragraph(`Assistance : ${(c.agency.phones || []).join(" · ")}${c.agency.whatsapp ? ` · WhatsApp ${c.agency.whatsapp}` : ""}`, { muted: true });
    });
    return l.finish();
  }

  private async echeancier(c: Context) {
    const l = new Layout(c.agency, "Échéancier de paiement", [
      { label: "Dossier", value: c.r.ref || c.row.id },
      { label: "Au", value: frDate(todayIso()) },
    ]);
    this.clientBlock(l, c);
    this.tripBlock(l, c);
    l.section("Échéances");
    this.scheduleTable(l, c);
    l.keyValues([
      ["Total du dossier", money(c.finance.total)],
      ["Déjà réglé", money(c.finance.paid)],
      ["Reste à payer", money(c.finance.remaining)],
    ], 3);
    this.bankBlock(l, c.agency);
    return l.finish();
  }

  async render(type: DocumentType, reservationId: string, opts: { paymentId?: string; hotel?: number } = {}) {
    const c = await this.context(reservationId);
    const buffer =
      type === "reservation" ? await this.reservation(c)
      : type === "cgv" ? await renderCgv(c.agency, c.r, c.pkg.cancellationPolicy, c.finance.travel?.travelEnd)
      : type === "devis" ? await this.devis(c)
      : type === "contrat" ? await this.contrat(c)
      : type === "programme" ? await this.programme(c)
      : type === "facture" ? await this.facture(c)
      : type === "recu" ? await this.recu(c, opts.paymentId)
      : type === "voucher" ? await this.voucher(c, opts.hotel)
      : await this.echeancier(c);
    const suffix = type === "recu" ? `-${opts.paymentId}` : type === "voucher" && opts.hotel !== undefined ? `-${opts.hotel + 1}` : "";
    const filename = `${DOCUMENT_LABELS[type]} ${clean(c.r.ref || reservationId)}${suffix}.pdf`
      .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 ._-]/g, "").replace(/\s+/g, "-");
    return { buffer, filename, reservation: c.r };
  }
}
