import { existsSync } from "node:fs";
import type { Agency } from "../agency/agency";
import { cancellationLines } from "../agency/agency";
import type { financeOf } from "../finance/schedule";
import { formuleMode, formuleNights } from "../reservations/formules";
import { lineItems, normalizeSupplements, type PackageData } from "../reservations/pricing";
import { GOLD, LOGO, LOGO_ASFARI, Layout, clean, frDate, money } from "./layout";

// Fiche de réservation — document remis au client (charte Asfari Voyage ×
// Follow Me Travel) : page 1 en cartes comme la fiche papier de l'agence,
// puis le détail complet (voyageurs, suppléments, échéancier, programme,
// conditions d'annulation, validation).

export interface FicheTraveler {
  fullName?: string; civility?: string; phone?: string; email?: string; birthDate?: string;
  nationality?: string; passportNumber?: string; passportExpiry?: string;
}
export interface FichePayment { date?: string; amount?: number; method?: string; reference?: string }
export interface FicheHotel { name?: string; hotelId?: string; rooms?: { type?: string; qty?: unknown }[] }

export interface FicheInput {
  r: Record<string, any>;
  agency: Agency;
  pkg: PackageData & Record<string, any>;
  participants: FicheTraveler[];
  payments: FichePayment[];
  hotels: FicheHotel[];
  finance: ReturnType<typeof financeOf>;
  agentName: string | null;
  /** Photo de la destination (JPEG/PNG), si disponible. */
  photo: Buffer | null;
  /** Lien vers l'espace client (validation / annulation). */
  clientSpaceUrl: string;
}

export const METHODS: Record<string, string> = {
  cash: "Espèces", transfer: "Virement", card: "Carte bancaire", check: "Chèque", other: "Autre",
};
const STATUS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", paid: "Payée", cancelled: "Annulée", completed: "Terminée",
};

/** Âge (années révolues) à une date, ou null. */
export function ageAt(birth?: string, at?: string | null): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}/.test(birth)) return null;
  const ref = at && /^\d{4}-\d{2}-\d{2}/.test(at) ? at : new Date().toISOString().slice(0, 10);
  const [by, bm, bd] = birth.slice(0, 10).split("-").map(Number);
  const [ry, rm, rd] = ref.slice(0, 10).split("-").map(Number);
  return ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0);
}

/** Adultes (12 ans et +), enfants (2–11), bébés (< 2) à la date de départ. */
export function travelerGroups(participants: FicheTraveler[], totalPax: number, travelStart?: string | null) {
  const kids: number[] = [];
  const babies: number[] = [];
  let known = 0;
  for (const p of participants) {
    const age = ageAt(p.birthDate, travelStart);
    if (age === null) continue;
    known++;
    if (age < 2) babies.push(age);
    else if (age < 12) kids.push(age);
  }
  const adults = Math.max(0, Math.max(totalPax, participants.length) - kids.length - babies.length);
  return { adults, kids, babies, known };
}

export const categoryLabel = (age: number | null) => (age === null ? "—" : age < 2 ? "Bébé" : age < 12 ? "Enfant" : "Adulte");

type Row = [string, string, { strong?: boolean; highlight?: boolean }?];

export class FicheRenderer {
  private readonly l: Layout;
  private readonly x0 = 36;
  private readonly w: number;
  private readonly gap = 14;

  constructor(private readonly f: FicheInput) {
    this.l = new Layout(f.agency, "Fiche de réservation", [], { brand: GOLD.brand, customHeader: true, brandFooter: "DES VOYAGES QUI RAPPROCHENT" });
    this.w = this.l.doc.page.width - this.x0 * 2;
  }

  private get doc() {
    return this.l.doc;
  }

  private get colW() {
    return (this.w - this.gap) / 2;
  }

  // ── En-tête de marque ──────────────────────────────────────────────
  private header() {
    const { doc } = this;
    const a = this.f.agency;
    const top = 30;
    if (existsSync(LOGO_ASFARI)) doc.image(LOGO_ASFARI, this.x0, top + 4, { fit: [118, 46] });
    doc.moveTo(this.x0 + 128, top + 2).lineTo(this.x0 + 128, top + 50).lineWidth(0.8).strokeColor(GOLD.accent).stroke();
    if (existsSync(LOGO)) doc.image(LOGO, this.x0 + 138, top, { fit: [72, 52] });

    const cx = this.x0 + 236;
    const cw = this.w - 236;
    doc.font("Helvetica").fontSize(8.5).fillColor(GOLD.ink);
    const lines = [
      [a.address, a.city].filter(Boolean).join(", "),
      (a.phones || []).join(" - "),
      [a.email, a.website].filter(Boolean).join(" · "),
    ].filter(Boolean);
    let y = top + 4;
    for (const line of lines) {
      doc.circle(cx + 3, y + 4, 2).fill(GOLD.accent);
      doc.fillColor(GOLD.ink).text(clean(line), cx + 10, y, { width: cw - 10 });
      y = doc.y + 3;
    }

    // Titre, destination, signature
    let ty = Math.max(y, top + 58) + 14;
    doc.font("Times-Bold").fontSize(28).fillColor(GOLD.ink).text("FICHE RÉSERVATION", this.x0, ty, { width: this.w, align: "center" });
    ty = doc.y;
    const dest = clean(this.f.r.packageTitle || this.f.pkg.destination || "").toUpperCase();
    if (dest) {
      doc.font("Times-Bold").fontSize(20).fillColor(GOLD.accent).text(dest, this.x0, ty, { width: this.w, align: "center" });
      ty = doc.y + 2;
    }
    const mid = this.x0 + this.w / 2;
    doc.moveTo(mid - 110, ty + 4).lineTo(mid + 110, ty + 4).lineWidth(0.6).strokeColor(GOLD.accent).stroke();
    doc.circle(mid, ty + 4, 2.2).fill(GOLD.accent);
    doc.font("Helvetica").fontSize(8).fillColor(GOLD.ink).text("VOYAGEZ AUTREMENT, AVEC CONFIANCE", this.x0, ty + 11, { width: this.w, align: "center", characterSpacing: 3 });

    // Bandeau dossier
    const r = this.f.r;
    const by = doc.y + 8;
    doc.roundedRect(this.x0, by, this.w, 20, 4).fill(GOLD.soft);
    const validated = r.clientValidatedAt ? `Validée par le client le ${frDate(String(r.clientValidatedAt).slice(0, 10))}` : "En attente de validation du client";
    const info = `Dossier ${r.ref || ""}   ·   Statut : ${STATUS[String(r.status)] ?? r.status ?? "—"}   ·   ${validated}   ·   Établie le ${frDate(new Date().toISOString().slice(0, 10))}`;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(GOLD.brand).text(clean(info), this.x0 + 8, by + 6.5, { width: this.w - 16, align: "center", lineBreak: false });
    doc.y = by + 30;
  }

  // ── Carte (bandeau titre + lignes libellé / valeur) ───────────────
  private measure(rows: Row[], w: number) {
    const { doc } = this;
    const labelW = w * 0.42;
    const valueW = w - labelW - 16;
    return rows.map(([label, value, o]) => {
      doc.font("Helvetica").fontSize(8.5);
      const hl = doc.heightOfString(clean(label), { width: labelW - 8 });
      doc.font(o?.strong || o?.highlight ? "Helvetica-Bold" : "Helvetica").fontSize(o?.highlight ? 10.5 : 9);
      const hv = doc.heightOfString(clean(value) || "—", { width: valueW });
      return Math.max(hl, hv) + 7;
    });
  }

  private cardHeight(rows: Row[], w: number, extra = 0) {
    return 24 + this.measure(rows, w).reduce((a, b) => a + b, 0) + 6 + extra;
  }

  private card(x: number, y: number, w: number, title: string, icon: string, rows: Row[], after?: (y: number) => number) {
    const { doc } = this;
    const heights = this.measure(rows, w);
    const extra = after ? after(-1) : 0; // hauteur réservée au contenu libre
    const h = 24 + heights.reduce((a, b) => a + b, 0) + 6 + extra;
    doc.roundedRect(x, y, w, h, 5).lineWidth(0.7).fillAndStroke("#ffffff", GOLD.line);
    doc.roundedRect(x, y, w, 22, 5).fill(GOLD.soft);
    doc.rect(x, y + 12, w, 10).fill(GOLD.soft);
    doc.roundedRect(x + 5, y + 3, 16, 16, 3).fill(GOLD.brand);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text(icon, x + 5, y + 7, { width: 16, align: "center", lineBreak: false });
    doc.font("Times-Bold").fontSize(11).fillColor(GOLD.brand).text(clean(title).toUpperCase(), x + 28, y + 6, { width: w - 34, lineBreak: false });

    const labelW = w * 0.42;
    let ry = y + 26;
    rows.forEach(([label, value, o], i) => {
      if (o?.highlight) doc.rect(x + 1, ry - 2, w - 2, heights[i]).fill(GOLD.soft);
      doc.font("Helvetica").fontSize(8.5).fillColor("#5b4a36").text(clean(label), x + 8, ry + 1, { width: labelW - 8 });
      doc.font(o?.strong || o?.highlight ? "Helvetica-Bold" : "Helvetica").fontSize(o?.highlight ? 10.5 : 9).fillColor(GOLD.ink)
        .text(clean(value) || "—", x + labelW + 8, ry, { width: w - labelW - 16 });
      ry += heights[i];
      if (i < rows.length - 1) doc.moveTo(x + 8, ry - 2).lineTo(x + w - 8, ry - 2).lineWidth(0.4).strokeColor("#efe5d2").stroke();
    });
    if (after) after(ry);
    return h;
  }

  /** Coche dessinée (les polices PDF standard n'ont pas de ✔ fiable). */
  private tick(x: number, y: number) {
    const { doc } = this;
    doc.roundedRect(x, y, 8, 8, 1.5).lineWidth(0.6).strokeColor(GOLD.accent).stroke();
    doc.moveTo(x + 1.8, y + 4.2).lineTo(x + 3.4, y + 6).lineTo(x + 6.6, y + 1.8).lineWidth(1.1).strokeColor(GOLD.brand).stroke();
  }

  // ── Données ───────────────────────────────────────────────────────
  private category() {
    return (this.f.pkg.hotelCategories || []).find((c) => c.label === this.f.r.category) ?? null;
  }

  private stays() {
    const cat = this.category();
    return this.f.hotels.map((h) => {
      const row = cat?.hotels?.find((x) => (h.hotelId && x.hotelId === h.hotelId) || (!h.hotelId && x.name === h.name));
      return {
        name: h.name || row?.name || "—",
        city: (row?.city as string) || "—",
        stars: row?.stars ? `${row.stars}*` : "—",
        nights: row?.nights ? String(row.nights) : "—",
        rooms: (h.rooms || []).filter((x) => Number(x.qty) > 0).map((x) => `${Number(x.qty)} × ${x.type}`).join(", ") || "—",
        board: (cat?.board as string) || "—",
      };
    });
  }

  private included(): string[] {
    const sections: { title?: string; items?: { text?: string }[] }[] = Array.isArray(this.f.pkg.sections) ? this.f.pkg.sections : [];
    const inc = sections.filter((s) => /compren|inclu/i.test(s.title || ""));
    return (inc.length ? inc : sections.slice(0, 1)).flatMap((s) => (s.items || []).map((i) => i.text || "")).filter(Boolean);
  }

  // ── Page 1 : la fiche ────────────────────────────────────────────
  private page1() {
    const { doc } = this;
    const { r, pkg, finance, agency } = this.f;
    const travel = finance.travel;
    const cat = this.category();
    const pax = Number(r.totalPax) || this.f.participants.length;
    const groups = travelerGroups(this.f.participants, pax, travel?.travelStart);
    const lead = this.f.participants[0] ?? {};
    const nights = cat ? formuleNights(cat) : 0;
    const w = this.colW;
    const card = (title: string, icon: string, rows: Row[], extra?: { height: number; draw: (x: number, y: number) => void }) => ({
      height: this.cardHeight(rows, w, extra?.height ?? 0),
      draw: (x: number, y: number, cw: number) =>
        this.card(x, y, cw, title, icon, rows, extra ? (yy) => (yy < 0 ? extra.height : (extra.draw(x, yy), extra.height)) : undefined),
    });

    // Colonne gauche : type de voyage + client ; droite : photo + voyage.
    const typeRows: Row[] = [
      ["Voyage", r.packageTitle || "—", { strong: true }],
      ["Formule", r.category || "Prix par personne"],
      ["Type", cat ? (formuleMode(cat) === "circuit" ? "Circuit (plusieurs villes)" : "Séjour (une ville)") : "—"],
    ];
    const clientRows: Row[] = [
      ["Nom & prénom", r.userName || [lead.civility, lead.fullName].filter(Boolean).join(" ") || "—", { strong: true }],
      ["Téléphone", lead.phone || "—"],
      ["Email", r.userEmail || lead.email || "—"],
      ["Nombre d'adultes", String(groups.adults)],
      ["Nombre d'enfants", groups.kids.length ? String(groups.kids.length) : "—"],
      ["Âge des enfants", groups.kids.length ? groups.kids.map((a) => `${a} ans`).join(", ") : "—"],
      ["Nombre de bébés", groups.babies.length ? String(groups.babies.length) : "—"],
      ["Âge des bébés", groups.babies.length ? groups.babies.map((a) => `${a} an${a > 1 ? "s" : ""}`).join(", ") : "—"],
    ];
    const voyageRows: Row[] = [
      ["Destination", [r.packageTitle, pkg.country].filter(Boolean).join(" — ") || "—", { strong: true }],
      ["Date de départ", `${frDate(travel?.travelStart)}${r.dateFrom ? `  (${r.dateFrom})` : ""}`],
      ["Date de retour", `${frDate(travel?.travelEnd)}${r.dateTo ? `  (${r.dateTo})` : ""}`],
      ["Durée", pkg.durationLabel || (nights ? `${String(nights + 1).padStart(2, "0")} jours / ${String(nights).padStart(2, "0")} nuits` : "—")],
      ["Nombre de nuits", nights ? String(nights).padStart(2, "0") : "—"],
      ["Type de transfert", r.transferType || pkg.transferType || (this.included().some((i) => /transfert/i.test(i)) ? "Inclus (voir prestations)" : "—")],
      ["Voyageurs", `${pax} personne${pax > 1 ? "s" : ""}`],
    ];
    const photoH = 150;
    const top = doc.y;
    const leftCards = [card("Type de voyage", "T", typeRows), card("Client", "C", clientRows)];
    let yl = top;
    for (const c of leftCards) yl += c.draw(this.x0, yl, w) + 10;
    const xr = this.x0 + w + this.gap;
    this.photoBlock(xr, top, w, photoH);
    const yr = top + photoH + 10 + card("Voyage", "V", voyageRows).draw(xr, top + photoH + 10, w) + 10;

    // Puis les autres cartes, en colonnes équilibrées.
    const stays = this.stays();
    const hotelCards = stays.map((st, i) =>
      card(stays.length > 1 ? `Hébergement ${i + 1}` : "Hébergement", "H", [
        ["Ville", st.city],
        ["Hôtel", st.name, { strong: true }],
        ["Catégorie", st.stars],
        ["Nombre de nuits", st.nights],
        ["Type de chambre", st.rooms],
        ["Restauration", st.board],
      ]),
    );

    const included = this.included();
    const incH = included.length ? this.measureList(included, w - 30) + 6 : 20;
    const incCard = card("Prestations incluses", "P", [], {
      height: incH,
      draw: (x, yy) => {
        let iy = yy;
        if (!included.length) {
          doc.font("Helvetica").fontSize(8.8).fillColor(GOLD.ink).text("Selon le programme du voyage.", x + 10, iy, { width: w - 20 });
          return;
        }
        for (const it of included) {
          this.tick(x + 9, iy + 1.5);
          doc.font("Helvetica").fontSize(8.8).fillColor(GOLD.ink).text(clean(it), x + 22, iy, { width: w - 30 });
          iy = doc.y + 3;
        }
      },
    });

    const methods = [...new Set(this.f.payments.map((p) => METHODS[p.method ?? ""] ?? p.method).filter(Boolean))].join(", ");
    const next = finance.installments.find((i) => i.remaining > 0);
    const payRows: Row[] = [
      ...lineItems(r, pkg).map((i) => [this.payLabel(i.label), `${i.quantity ? `${i.quantity}  ·  ` : ""}${money(i.amount)}`] as Row),
      ["Total", money(finance.total), { strong: true }],
      ["Avance versée", money(finance.paid)],
      ["Reste", money(finance.remaining), { highlight: true }],
      ["Mode de paiement", methods || "—"],
      ...(next ? ([["Prochaine échéance", `${frDate(next.dueDate)} — ${money(next.remaining)}`]] as Row[]) : []),
    ];

    const yes = (v: unknown, fallback: boolean) => (v === undefined || v === null || v === "" ? fallback : v === true || v === "true" || v === "1");
    const condRows: Row[] = [
      ["Remboursable", yes(r.refundable, agency.refundable) ? "Oui, selon les conditions d'annulation" : "Non"],
      ["Modifiable", yes(r.modifiable, agency.modifiable) ? "Oui" : "Non"],
      ["Conditions particulières", r.specialConditions || "—"],
      ["Remarques", r.remarks || "—"],
    ];
    const note = clean(agency.reservationNote);
    doc.font("Helvetica").fontSize(8);
    const noteH = note ? doc.heightOfString(`N.B. : ${note}`, { width: w - 40 }) + 16 : 0;
    const condCard = card("Conditions", "!", condRows, {
      height: noteH,
      draw: (x, yy) => {
        if (!note) return;
        doc.roundedRect(x + 8, yy + 2, w - 16, noteH - 6, 4).fill("#fbf6ec");
        doc.circle(x + 18, yy + 12, 6).fill(GOLD.brand);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text("i", x + 15, yy + 8.5, { width: 6, align: "center", lineBreak: false });
        doc.font("Helvetica").fontSize(8).fillColor(GOLD.ink).text(`N.B. : ${note}`, x + 30, yy + 7, { width: w - 40 });
      },
    });
    const agentCard = card("Agent", "A", [["Nom de l'agent", this.f.agentName || "Service réservations", { strong: true }]], {
      height: 74,
      draw: (x, yy) => {
        doc.roundedRect(x + w - 150, yy + 6, 140, 60, 4).dash(3, { space: 2 }).lineWidth(0.7).strokeColor(GOLD.accent).stroke().undash();
        doc.font("Helvetica").fontSize(7.5).fillColor("#8b7a62").text("Cachet et signature de l'agence", x + w - 150, yy + 31, { width: 140, align: "center" });
      },
    });

    // Reprise sous les deux colonnes du haut, chacune à sa hauteur.
    doc.y = Math.max(yl, yr);
    this.flowFrom([yl, yr], [...hotelCards, incCard, card("Paiement", "$", payRows), condCard, agentCard]);
  }

  private flowFrom(start: number[], cards: { height: number; draw: (x: number, y: number, w: number) => number }[]) {
    const { doc } = this;
    const bottom = doc.page.height - 78;
    const xs = [this.x0, this.x0 + this.colW + this.gap];
    let ys = [...start];
    for (const c of cards) {
      let col = ys[0] <= ys[1] ? 0 : 1;
      if (ys[col] + c.height > bottom && ys[1 - col] + c.height <= bottom) col = 1 - col;
      if (ys[col] + c.height > bottom) {
        doc.addPage();
        ys = [40, 40];
        col = 0;
      }
      ys[col] += c.draw(xs[col], ys[col], this.colW) + 10;
    }
    doc.y = Math.max(...ys);
    doc.x = this.x0;
  }

  private measureList(items: string[], width: number) {
    const { doc } = this;
    doc.font("Helvetica").fontSize(8.8);
    return items.reduce((a, it) => a + doc.heightOfString(clean(it), { width }) + 3, 0);
  }

  /** Libellés courts pour la carte Paiement (le détail complet est en page 2 et sur la facture). */
  private payLabel(label: string) {
    const cat = this.f.r.category;
    if (/^(Circuit|Forfait) /.test(label)) return cat ? `Forfait — ${cat}` : "Forfait";
    return label.replace(/^Supplément : /, "+ ");
  }

  /** Photo de la destination (ou bandeau doré si aucune image exploitable). */
  private photoBlock(x: number, y: number, w: number, h: number) {
    const { doc } = this;
    const { r, pkg } = this.f;
    doc.save();
    doc.roundedRect(x, y, w, h, 6).clip();
    let drawn = false;
    if (this.f.photo) {
      try {
        doc.image(this.f.photo, x, y, { cover: [w, h], align: "center", valign: "center" });
        drawn = true;
      } catch {
        drawn = false;
      }
    }
    if (!drawn) {
      doc.rect(x, y, w, h).fill(GOLD.soft);
      doc.font("Times-Bold").fontSize(26).fillColor(GOLD.accent).text(clean(pkg.destination || r.packageTitle || ""), x + 12, y + h / 2 - 30, { width: w - 24, align: "center" });
      doc.font("Helvetica").fontSize(8.5).fillColor(GOLD.brand).text(clean([pkg.country, pkg.durationLabel].filter(Boolean).join(" · ")), x + 12, doc.y + 4, { width: w - 24, align: "center", characterSpacing: 1 });
    }
    doc.restore();
    if (drawn) {
      doc.save();
      doc.rect(x, y + h - 30, w, 30).fillOpacity(0.5).fill("#1f1a14");
      doc.restore();
      doc.font("Times-Bold").fontSize(15).fillColor("#ffffff").text(clean(r.packageTitle || ""), x + 10, y + h - 23, { width: w - 20, align: "right", lineBreak: false });
    }
  }

  // ── Page 2 : le détail du détail ─────────────────────────────────
  private details() {
    const { doc, l } = this;
    const { r, pkg, finance, agency } = this.f;
    // Suite sur la même page s'il reste de la place sous les cartes.
    if (doc.y > doc.page.height - 300) {
      doc.addPage();
      doc.y = 46;
    } else {
      doc.y += 12;
    }
    doc.font("Times-Bold").fontSize(18).fillColor(GOLD.ink).text("Détail du dossier", l.left, doc.y, { width: l.width });
    doc.font("Helvetica").fontSize(9).fillColor("#6b5d49").text(clean(`${r.ref || ""} — ${r.packageTitle || ""}${r.category ? ` — formule ${r.category}` : ""}`), l.left, doc.y + 2, { width: l.width });
    doc.moveDown(0.4);

    // Voyageurs
    l.section("Voyageurs");
    const travel = finance.travel;
    if (!this.f.participants.length) {
      l.paragraph("Liste des voyageurs à compléter depuis votre espace client.", { muted: true });
    } else {
      l.table(
        [
          { header: "#", width: 4 },
          { header: "Voyageur", width: 24 },
          { header: "Naissance", width: 12 },
          { header: "Catégorie", width: 12 },
          { header: "Nationalité", width: 12 },
          { header: "Passeport", width: 14 },
          { header: "Expiration", width: 12 },
          { header: "Téléphone", width: 14 },
        ],
        this.f.participants.map((p, i) => [
          String(i + 1),
          [p.civility, p.fullName].filter(Boolean).join(" ") || "—",
          frDate(p.birthDate),
          categoryLabel(ageAt(p.birthDate, travel?.travelStart)),
          p.nationality || "—",
          p.passportNumber || "—",
          frDate(p.passportExpiry),
          p.phone || "—",
        ]),
      );
      if (agency.passportValidityMonths) {
        l.paragraph(`Passeport obligatoire, valable au moins ${agency.passportValidityMonths} mois après la date de retour (${frDate(travel?.travelEnd)}).`, { muted: true, size: 8.5 });
      }
    }

    // Suppléments choisis
    const supps = normalizeSupplements(pkg, r.supplements, Number(r.totalPax) || 0);
    if (supps.length) {
      l.section("Suppléments et excursions");
      l.table(
        [{ header: "Supplément", width: 50 }, { header: "Voyageurs", width: 16, align: "center" }, { header: "Prix / pers.", width: 17, align: "right" }, { header: "Montant", width: 17, align: "right" }],
        supps.map((s) => [s.label, s.qty ? String(s.qty) : "—", s.pricePerPax ? money(s.pricePerPax) : "—", money(s.price)]),
      );
    }

    // Échéancier et règlements
    l.section("Échéancier de paiement");
    const STATUS_I: Record<string, string> = { paid: "Réglée", partial: "Partielle", overdue: "En retard", due: "À régler ce jour", upcoming: "À venir" };
    if (finance.installments.length) {
      l.table(
        [{ header: "Échéance", width: 34 }, { header: "Date limite", width: 18 }, { header: "Montant", width: 16, align: "right" }, { header: "Reste", width: 16, align: "right" }, { header: "Statut", width: 16 }],
        finance.installments.map((i) => [i.label, frDate(i.dueDate), money(i.amount), money(i.remaining), STATUS_I[i.status]]),
        { totals: [["Total du dossier", money(finance.total)], ["Déjà réglé", money(finance.paid)], ["Reste à payer", money(finance.remaining)]] },
      );
    }
    if (this.f.payments.length) {
      l.table(
        [{ header: "Règlement reçu le", width: 22 }, { header: "Mode", width: 22 }, { header: "Référence", width: 36 }, { header: "Montant", width: 20, align: "right" }],
        this.f.payments.map((p) => [frDate(p.date), METHODS[p.method ?? ""] ?? p.method ?? "", p.reference || "", money(p.amount)]),
      );
    }
    if (agency.rib) l.paragraph(`Règlement par virement : ${agency.bankName ? `${agency.bankName} — ` : ""}RIB ${agency.rib}. Merci d'indiquer la référence ${r.ref || "du dossier"} en libellé.`, { muted: true });

    // Programme
    const days: { num?: string; title?: string; theme?: string; activities?: { label?: string; optional?: boolean }[] }[] = Array.isArray(pkg.days) ? pkg.days : [];
    if (days.length) {
      l.section(pkg.itineraryTitle ? `Programme — ${pkg.itineraryTitle}` : "Programme jour par jour");
      for (const d of days) {
        const acts = (d.activities || []).map((x) => `${x.label}${x.optional ? " (en option)" : ""}`).filter(Boolean);
        l.ensure(acts.length ? 30 : 16); // le jour et ses activités sur la même page
        l.paragraph(`Jour ${d.num ?? ""} · ${d.title ?? ""}${d.theme ? ` — ${d.theme}` : ""}`, { bold: true, size: 9 });
        if (acts.length) l.paragraph(acts.join(" · "), { muted: true, size: 8.5 });
      }
    }

    // Annulation et validation
    l.section("Conditions d'annulation");
    l.paragraph("Toute annulation doit être notifiée par écrit ou depuis l'espace client. Frais appliqués sur le prix total du voyage :", { size: 9 });
    for (const line of cancellationLines(pkg.cancellationPolicy ?? agency.cancellationPolicy)) l.paragraph(`•  ${line}`, { size: 9 });
    l.paragraph("Les conditions générales de vente sont jointes à ce document (PDF « Conditions de vente »).", { muted: true, size: 8.5 });

    l.section("Validation du client");
    if (r.clientValidatedAt) {
      l.callout(`Fiche et conditions de vente validées par le client le ${frDate(String(r.clientValidatedAt).slice(0, 10))} à ${String(r.clientValidatedAt).slice(11, 16)} (espace client).`);
    } else {
      l.callout(`Merci de vérifier cette fiche puis de la valider — ou d'annuler votre réservation — depuis votre espace client : ${this.f.clientSpaceUrl}`);
    }
  }

  async render(): Promise<Buffer> {
    this.header();
    this.page1();
    this.details();
    return this.l.finish();
  }
}
