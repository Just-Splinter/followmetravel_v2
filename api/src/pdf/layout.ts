import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Agency } from "../agency/agency";

// Mise en page commune des documents (devis, facture, voucher…) : en-tête
// logo + agence, titre, pied de page légal (fiche agence) numéroté.

export const BRAND = "#0f766e";
const INK = "#1e293b";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ASSETS = join(__dirname, "..", "..", "assets");
export const LOGO = join(ASSETS, "logo-followme.png");
export const LOGO_ASFARI = join(ASSETS, "logo-asfari.png");

/** Thème « doré » de la fiche de réservation (charte Asfari Voyage × Follow Me Travel). */
export const GOLD = { brand: "#8a6326", accent: "#b8893d", soft: "#f3ead8", line: "#e6d6b6", ink: "#1f1a14" };

/**
 * Les polices standard PDF (Helvetica) n'ont que le jeu WinAnsi : tout autre
 * caractère (emoji, arabe, ★…) sortirait en charabia. On le remplace ou on
 * le retire.
 */
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/★/g, "*")
    .replace(/\s*[→⇒➜]\s*/g, " – ")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ\n]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : ""))
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const money = (n: unknown) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/ | /g, " ")} DH`;

export const frDate = (iso?: string | null) => {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export type Doc = PDFKit.PDFDocument;

export interface LayoutOptions {
  /** Couleur des titres et filets (défaut : vert de la charte documents). */
  brand?: string;
  /** Pas d'en-tête standard : la première page est dessinée par l'appelant. */
  customHeader?: boolean;
  /** Pied de page de marque (site + signature) en plus des mentions légales. */
  brandFooter?: string;
}

export interface Column {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export class Layout {
  readonly doc: Doc;
  private readonly chunks: Buffer[] = [];
  private readonly done: Promise<Buffer>;
  readonly left = 50;
  readonly width: number;
  readonly brand: string;

  constructor(
    private readonly agency: Agency,
    title: string,
    private readonly meta: { label: string; value: string }[] = [],
    private readonly opts: LayoutOptions = {},
  ) {
    this.doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true, info: { Title: clean(title), Author: agency.tradeName } });
    this.width = this.doc.page.width - 100;
    this.brand = opts.brand ?? BRAND;
    this.doc.on("data", (c: Buffer) => this.chunks.push(c));
    this.done = new Promise((resolve) => this.doc.on("end", () => resolve(Buffer.concat(this.chunks))));
    if (!opts.customHeader) this.header(title);
  }

  private header(title: string) {
    const { doc } = this;
    const top = 40;
    if (existsSync(LOGO)) doc.image(LOGO, this.left, top, { width: 54 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(clean(this.agency.tradeName), this.left + 64, top + 4, { width: 240 });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    const contact = [this.agency.address, this.agency.city].filter(Boolean).join(", ");
    // Téléphones deux par ligne : la colonne est étroite (titre du document à droite).
    const phones = this.agency.phones || [];
    const phoneLines = Array.from({ length: Math.ceil(phones.length / 2) }, (_, i) => phones.slice(i * 2, i * 2 + 2).join(" · "));
    const lines = [contact, ...phoneLines, [this.agency.email, this.agency.website].filter(Boolean).join(" · ")].filter(Boolean);
    doc.text(clean(lines.join("\n")), this.left + 64, top + 22, { width: 240 });

    doc.font("Helvetica-Bold").fontSize(18).fillColor(this.brand).text(clean(title).toUpperCase(), this.left + 250, top, { width: this.width - 250, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    let y = top + 26;
    const metaX = this.left + 250;
    const metaW = this.width - 250;
    for (const m of this.meta) {
      // Valeur calée à droite, libellé juste avant (pas de `continued` : il
      // casse l'alignement à droite dans pdfkit).
      const value = clean(m.value);
      doc.font("Helvetica-Bold").fontSize(9);
      const valueW = doc.widthOfString(value);
      doc.fillColor(INK).text(value, metaX, y, { width: metaW, align: "right", lineBreak: false });
      doc.font("Helvetica").fillColor(MUTED).text(`${clean(m.label)} :`, metaX, y, { width: metaW - valueW - 4, align: "right", lineBreak: false });
      y += 13;
    }
    const bottom = Math.max(top + 70, y + 8);
    doc.moveTo(this.left, bottom).lineTo(this.left + this.width, bottom).lineWidth(1.5).strokeColor(this.brand).stroke();
    doc.y = bottom + 16;
    doc.x = this.left;
  }

  /** Saut de page si `needed` points ne tiennent plus. */
  ensure(needed: number) {
    const { doc } = this;
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  section(title: string) {
    this.ensure(40);
    const { doc } = this;
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(this.brand).text(clean(title).toUpperCase(), this.left, doc.y, { width: this.width, characterSpacing: 0.5 });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
  }

  paragraph(text: string, opts: { muted?: boolean; bold?: boolean; size?: number } = {}) {
    const { doc } = this;
    const value = clean(text);
    if (!value) return;
    const style = () => doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size ?? 9.5).fillColor(opts.muted ? MUTED : INK);
    style();
    this.ensure(doc.heightOfString(value, { width: this.width }) + 4);
    style(); // un saut de page réinitialise la couleur de remplissage
    doc.text(value, this.left, doc.y, { width: this.width });
    doc.moveDown(0.25);
  }

  /** Grille libellé / valeur sur deux colonnes. */
  keyValues(pairs: [string, unknown][], columns = 2) {
    const { doc } = this;
    const colWidth = this.width / columns;
    const rows = Math.ceil(pairs.length / columns);
    for (let r = 0; r < rows; r++) {
      this.ensure(28);
      const y = doc.y;
      let height = 0;
      for (let c = 0; c < columns; c++) {
        const pair = pairs[r * columns + c];
        if (!pair) continue;
        const x = this.left + c * colWidth;
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(clean(pair[0]), x, y, { width: colWidth - 10 });
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(clean(pair[1]) || "—", x, y + 10, { width: colWidth - 10 });
        height = Math.max(height, doc.y - y);
      }
      doc.y = y + height + 6;
    }
    doc.x = this.left;
  }

  table(columns: Column[], rows: string[][], opts: { totals?: [string, string][] } = {}) {
    const { doc } = this;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.width);
    const drawHeader = () => {
      this.ensure(24);
      const y = doc.y;
      doc.rect(this.left, y, this.width, 18).fill("#f1f5f9");
      let x = this.left;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED);
      columns.forEach((c, i) => {
        doc.text(clean(c.header), x + 5, y + 5, { width: widths[i] - 10, align: c.align ?? "left" });
        x += widths[i];
      });
      doc.y = y + 18;
    };
    drawHeader();
    for (const row of rows) {
      doc.font("Helvetica").fontSize(9);
      const height = Math.max(16, ...row.map((cell, i) => doc.heightOfString(clean(cell), { width: widths[i] - 10 }) + 8));
      if (doc.y + height > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawHeader();
      }
      const y = doc.y;
      let x = this.left;
      doc.fillColor(INK);
      row.forEach((cell, i) => {
        doc.text(clean(cell), x + 5, y + 4, { width: widths[i] - 10, align: columns[i].align ?? "left" });
        x += widths[i];
      });
      doc.moveTo(this.left, y + height).lineTo(this.left + this.width, y + height).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.y = y + height;
    }
    for (const [label, value] of opts.totals ?? []) {
      this.ensure(20);
      const y = doc.y + 4;
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(clean(label), this.left, y, { width: this.width - 110, align: "right" });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(clean(value), this.left + this.width - 105, y, { width: 100, align: "right" });
      doc.y = y + 14;
    }
    doc.x = this.left;
    doc.moveDown(0.4);
  }

  /** Encadré mis en avant (total, montant en lettres, mention). */
  callout(text: string) {
    const { doc } = this;
    const value = clean(text);
    doc.font("Helvetica-Bold").fontSize(9.5);
    const h = doc.heightOfString(value, { width: this.width - 20 }) + 14;
    this.ensure(h + 6);
    const y = doc.y;
    doc.rect(this.left, y, this.width, h).fill(this.brand === BRAND ? "#f0fdfa" : GOLD.soft);
    doc.rect(this.left, y, 3, h).fill(this.brand);
    doc.fillColor(INK).text(value, this.left + 12, y + 7, { width: this.width - 20 });
    doc.y = y + h + 6;
    doc.x = this.left;
  }

  signatures(left: string, right: string) {
    this.ensure(90);
    const { doc } = this;
    const y = doc.y + 10;
    const w = this.width / 2 - 20;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
    doc.text(clean(left), this.left, y, { width: w });
    doc.text(clean(right), this.left + this.width / 2 + 20, y, { width: w });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("Date et signature précédées de « Lu et approuvé »", this.left, y + 14, { width: w });
    doc.text("Cachet et signature", this.left + this.width / 2 + 20, y + 14, { width: w });
    doc.rect(this.left, y + 30, w, 50).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.rect(this.left + this.width / 2 + 20, y + 30, w, 50).strokeColor(LINE).stroke();
    doc.y = y + 90;
  }

  private footers() {
    const { doc } = this;
    const a = this.agency;
    const legal = [
      a.legalName || a.tradeName,
      a.capital && `Capital ${a.capital}`,
      a.licenceNumber && `Licence n° ${a.licenceNumber}`,
      a.rc && `RC ${a.rc}`,
      a.taxId && `IF ${a.taxId}`,
      a.patente && `Patente ${a.patente}`,
      a.ice && `ICE ${a.ice}`,
    ].filter(Boolean).join(" · ");
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Écrire sous la marge basse sans déclencher un saut de page automatique.
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 42;
      doc.moveTo(this.left, y - 6).lineTo(this.left + this.width, y - 6).lineWidth(0.5).strokeColor(LINE).stroke();
      if (this.opts.brandFooter) {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(this.brand).text(clean(a.website || ""), this.left, y - 18, { width: 160, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(clean(this.opts.brandFooter), this.left + 160, y - 18, { width: this.width - 320, align: "center", characterSpacing: 2, lineBreak: false });
      }
      doc.font("Helvetica").fontSize(7).fillColor(MUTED);
      doc.text(clean(legal), this.left, y, { width: this.width - 50, lineBreak: true });
      doc.text(`${i - range.start + 1} / ${range.count}`, this.left + this.width - 50, y, { width: 50, align: "right" });
      doc.page.margins.bottom = bottom;
    }
  }

  async finish(): Promise<Buffer> {
    this.footers();
    this.doc.end();
    return this.done;
  }
}
