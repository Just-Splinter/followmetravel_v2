import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { AgencyService } from "../agency/agency";
import { DocumentsService } from "../collections/documents.service";
import { slugify } from "../common/slug";
import { DbService } from "../db/db.service";
import { LOGO } from "../pdf/layout";
import { ageAt, categoryLabel, travelerGroups } from "../pdf/fiche";
import { formuleMode } from "../reservations/formules";
import { passportExpiryIssue } from "../reservations/passport";
import { PackageData, normalizeSupplements, parseJSON } from "../reservations/pricing";
import { todayIso } from "../reservations/travel-dates";
import { isPackageRow } from "./finance.service";
import { financeOf } from "./schedule";

// Planning de voyage « Asfari Voyage » en Excel : tout le détail des
// départs (voyageurs, passeports, hébergement, paiements, conseiller) en un
// fichier — remplace les exports CSV rooming list / manifeste.

const GOLD = "FF8A6326";
const GOLD_SOFT = "FFF3EAD8";
const INK = "FF1F1A14";

const STATUS: Record<string, { label: string; fill: string; font?: string }> = {
  pending: { label: "En attente", fill: "FFFEF3C7" },
  confirmed: { label: "Confirmée", fill: "FFDBEAFE" },
  paid: { label: "Payée", fill: "FFDCFCE7" },
  completed: { label: "Terminée", fill: "FFE2E8F0" },
  cancelled: { label: "Annulée", fill: "FFF1F5F9", font: "FF94A3B8" },
};
const METHODS: Record<string, string> = { cash: "Espèces", transfer: "Virement", card: "Carte bancaire", check: "Chèque", other: "Autre" };

interface Traveler {
  fullName?: string; civility?: string; phone?: string; email?: string; birthDate?: string;
  nationality?: string; passportNumber?: string; passportExpiry?: string;
}

const isoToDate = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);
const fr = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

@Injectable()
export class PlanningExportService {
  constructor(
    private readonly docs: DocumentsService,
    private readonly agency: AgencyService,
    private readonly db: DbService,
  ) {}

  async build(opts: { from: string; to: string; packageId?: string; start?: string }) {
    const agency = await this.agency.get();
    const today = todayIso();
    const products = new Map((await this.docs.allRows("products")).filter(isPackageRow).map((p) => [p.id, p]));
    const users = new Map(
      (await this.db.query<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users")).rows.map((u) => [u.id, u.name || u.email]),
    );

    // Dossiers du(des) départ(s), annulés compris (signalés).
    const rows = (await this.docs.allRows("reservations"))
      .map((row) => ({ row, r: row.data as Record<string, any>, f: financeOf(row.data, row.created_at, agency, today) }))
      .filter(({ r, f }) => {
        const start = f.travel?.travelStart;
        if (!start || start < opts.from || start > opts.to) return false;
        if (opts.packageId && r.packageId !== opts.packageId) return false;
        if (opts.start && start !== opts.start) return false;
        return true;
      })
      .sort((a, b) => (a.f.travel!.travelStart.localeCompare(b.f.travel!.travelStart)) || String(a.r.packageTitle).localeCompare(String(b.r.packageTitle)) || (a.r.status === "cancelled" ? 1 : 0) - (b.r.status === "cancelled" ? 1 : 0));

    const pkgOf = (r: Record<string, any>) => {
      const p = products.get(String(r.packageId));
      return { top: p?.data ?? {}, blob: parseJSON<PackageData & Record<string, any>>(p?.data.data, {}) };
    };
    const capacityOf = (r: Record<string, any>) => {
      const dep = (pkgOf(r).blob.departureDates || []).find((d) => d.from === r.dateFrom && (!d.to || d.to === r.dateTo));
      return { capacity: Number(dep?.capacity) > 0 ? Number(dep!.capacity) : null, guaranteed: !!dep?.guaranteed };
    };
    const stays = (r: Record<string, any>) => {
      const cat = (pkgOf(r).blob.hotelCategories || []).find((c) => c.label === r.category);
      return parseJSON<{ name?: string; hotelId?: string; rooms?: { type?: string; qty?: unknown }[] }[]>(r.hotels, []).map((h) => {
        const row = cat?.hotels?.find((x) => (h.hotelId && x.hotelId === h.hotelId) || (!h.hotelId && x.name === h.name));
        return {
          name: h.name || row?.name || "",
          city: String(row?.city ?? ""),
          nights: Number(row?.nights) || 0,
          stars: row?.stars ? `${row.stars}*` : "",
          rooms: (h.rooms || []).filter((x) => Number(x.qty) > 0).map((x) => `${Number(x.qty)} × ${x.type}`).join(", "),
          mode: cat ? formuleMode(cat) : "sejour",
        };
      });
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = "Asfari Voyage — Follow Me Travel";
    wb.created = new Date();
    const logoId = existsSync(LOGO) ? wb.addImage({ filename: LOGO, extension: "png" }) : null;

    // ── Feuille 1 : planning par voyageur ────────────────────────────
    const ws = wb.addWorksheet("Planning", { views: [{ state: "frozen", ySplit: 6, xSplit: 3 }], properties: { tabColor: { argb: GOLD } } });
    const cols: { header: string; key: string; width: number; type?: "date" | "money" }[] = [
      { header: "Départ", key: "start", width: 11, type: "date" },
      { header: "Retour", key: "end", width: 11, type: "date" },
      { header: "Voyage", key: "voyage", width: 24 },
      { header: "Formule", key: "formule", width: 16 },
      { header: "Hébergement", key: "hotels", width: 30 },
      { header: "Chambres", key: "rooms", width: 16 },
      { header: "Dossier", key: "ref", width: 19 },
      { header: "Statut", key: "status", width: 12 },
      { header: "Validation client", key: "validated", width: 15 },
      { header: "Conseiller", key: "agent", width: 16 },
      { header: "Client (titulaire)", key: "client", width: 20 },
      { header: "Tél. client", key: "clientPhone", width: 14 },
      { header: "Email client", key: "clientEmail", width: 24 },
      { header: "N°", key: "n", width: 5 },
      { header: "Civilité", key: "civility", width: 8 },
      { header: "Voyageur", key: "traveler", width: 22 },
      { header: "Naissance", key: "birth", width: 11, type: "date" },
      { header: "Catégorie", key: "category", width: 10 },
      { header: "Nationalité", key: "nationality", width: 12 },
      { header: "N° passeport", key: "passport", width: 14 },
      { header: "Expiration", key: "expiry", width: 11, type: "date" },
      { header: "Contrôle passeport", key: "passportCheck", width: 26 },
      { header: "Suppléments", key: "supplements", width: 24 },
      { header: "Total dossier", key: "total", width: 13, type: "money" },
      { header: "Payé", key: "paid", width: 12, type: "money" },
      { header: "Reste", key: "remaining", width: 12, type: "money" },
      { header: "Prochaine échéance", key: "next", width: 22 },
      { header: "Mode de paiement", key: "methods", width: 16 },
      { header: "Remarques", key: "remarks", width: 28 },
    ];
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
    const last = cols.length;

    // Titre
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 18;
    if (logoId !== null) ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 92, height: 63 } });
    ws.mergeCells(1, 3, 1, last);
    const title = ws.getCell(1, 3);
    title.value = "ASFARI VOYAGE — PLANNING DE VOYAGE";
    title.font = { name: "Calibri", size: 18, bold: true, color: { argb: GOLD } };
    ws.mergeCells(2, 3, 2, last);
    ws.getCell(2, 3).value = `Follow Me Travel · ${opts.start ? `Départ du ${fr(opts.start)}` : `Départs du ${fr(opts.from)} au ${fr(opts.to)}`} · Généré le ${fr(today)}`;
    ws.getCell(2, 3).font = { size: 10, color: { argb: "FF6B5D49" } };
    const active = rows.filter((x) => x.r.status !== "cancelled");
    const sum = (k: "total" | "paid" | "remaining") => active.reduce((a, x) => a + x.f[k], 0);
    const nf = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, " ")} DH`;
    ws.mergeCells(3, 3, 3, last);
    ws.getCell(3, 3).value = `${new Set(active.map((x) => `${x.r.packageId}|${x.f.travel?.travelStart}`)).size} départ(s) · ${active.length} dossier(s) · ${active.reduce((a, x) => a + (Number(x.r.totalPax) || 0), 0)} voyageur(s) · CA ${nf(sum("total"))} · Encaissé ${nf(sum("paid"))} · Reste ${nf(sum("remaining"))}`;
    ws.getCell(3, 3).font = { size: 10, bold: true, color: { argb: INK } };

    const headerRow = ws.getRow(6);
    cols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    });
    headerRow.height = 30;
    ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: last } };

    const style = (row: ExcelJS.Row, status: string, firstOfDossier: boolean) => {
      cols.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font = { size: 10, color: { argb: STATUS[status]?.font ?? INK }, strike: status === "cancelled" };
        if (c.type === "date") cell.numFmt = "dd/mm/yyyy";
        if (c.type === "money") cell.numFmt = '#,##0 "DH"';
        cell.border = { top: firstOfDossier ? { style: "thin", color: { argb: "FFE6D6B6" } } : undefined };
      });
      const st = row.getCell("status");
      st.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS[status]?.fill ?? "FFFFFFFF" } };
      st.font = { size: 10, bold: true, color: { argb: INK } };
    };

    let groupKey = "";
    let groupPax = 0;
    for (const { row, r, f } of rows) {
      const start = f.travel!.travelStart;
      const key = `${r.packageId}|${start}`;
      if (key !== groupKey) {
        groupKey = key;
        const same = rows.filter((x) => `${x.r.packageId}|${x.f.travel?.travelStart}` === key && x.r.status !== "cancelled");
        groupPax = same.reduce((a, x) => a + (Number(x.r.totalPax) || 0), 0);
        const { capacity, guaranteed } = capacityOf(r);
        const g = ws.addRow([]);
        ws.mergeCells(g.number, 1, g.number, last);
        g.getCell(1).value = `${fr(start)} → ${fr(f.travel?.travelEnd)}   ·   ${r.packageTitle || "Voyage"}   ·   ${groupPax}${capacity ? ` / ${capacity}` : ""} voyageur(s)   ·   ${same.length} dossier(s)${guaranteed ? "   ·   Départ garanti" : ""}   ·   Reste à encaisser ${nf(same.reduce((a, x) => a + x.f.remaining, 0))}`;
        g.getCell(1).font = { bold: true, size: 11, color: { argb: GOLD } };
        g.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD_SOFT } };
        g.height = 20;
      }

      const travelers = parseJSON<Traveler[]>(r.participants, []).filter((t) => t && (t.fullName || t.passportNumber));
      const pax = Math.max(Number(r.totalPax) || 0, travelers.length, 1);
      const lead = travelers[0] ?? {};
      const hotelList = stays(r);
      const supps = normalizeSupplements(pkgOf(r).blob, r.supplements, Number(r.totalPax) || 0);
      const payments = parseJSON<{ method?: string }[]>(r.payments, []);
      const next = f.next;
      const base = {
        start: isoToDate(start),
        end: isoToDate(f.travel?.travelEnd),
        voyage: r.packageTitle || "",
        formule: r.category || "Prix par personne",
        hotels: hotelList.map((h) => [h.name, h.city && `(${h.city}${h.nights ? `, ${h.nights} n.` : ""})`].filter(Boolean).join(" ")).join(hotelList[0]?.mode === "circuit" ? " → " : " / "),
        rooms: hotelList[0]?.rooms ?? "",
        ref: r.ref || row.id,
        status: STATUS[String(r.status)]?.label ?? r.status ?? "",
        validated: r.clientValidatedAt ? `Oui (${fr(String(r.clientValidatedAt))})` : "Non",
        agent: users.get(String(r.assignedTo)) ?? "",
        client: r.userName || lead.fullName || "",
        clientPhone: lead.phone || "",
        clientEmail: r.userEmail || lead.email || "",
        supplements: supps.map((s) => `${s.label}${s.qty ? ` ×${s.qty}` : ""}`).join(", "),
        next: next ? `${fr(next.dueDate)} — ${nf(next.remaining)}` : "",
        methods: [...new Set(payments.map((p) => METHODS[p.method ?? ""] ?? p.method).filter(Boolean))].join(", "),
        remarks: [r.remarks, r.specialConditions].filter(Boolean).join(" · "),
      };
      for (let i = 0; i < pax; i++) {
        const t: Traveler = travelers[i] ?? {};
        const issue = !t.passportNumber
          ? "Passeport à compléter"
          : !t.passportExpiry
            ? "Date d'expiration manquante"
            : passportExpiryIssue(t.passportExpiry, f.travel?.travelEnd, agency.passportValidityMonths);
        const line = ws.addRow({
          ...base,
          n: i + 1,
          civility: t.civility || "",
          traveler: t.fullName || `Voyageur ${i + 1} (à compléter)`,
          birth: isoToDate(t.birthDate),
          category: categoryLabel(ageAt(t.birthDate, start)),
          nationality: t.nationality || "",
          passport: t.passportNumber || "",
          expiry: isoToDate(t.passportExpiry),
          passportCheck: issue ? `⚠ ${issue}` : "OK",
          // Montants une seule fois par dossier (les sommes des filtres restent justes).
          total: i === 0 ? f.total : null,
          paid: i === 0 ? f.paid : null,
          remaining: i === 0 ? f.remaining : null,
        });
        style(line, String(r.status), i === 0);
        if (issue && r.status !== "cancelled") {
          line.getCell("passportCheck").font = { size: 10, bold: true, color: { argb: "FFB42318" } };
        }
        if (i === 0 && f.remaining > 0 && r.status !== "cancelled") line.getCell("remaining").font = { size: 10, bold: true, color: { argb: "FFB42318" } };
      }
    }
    if (!rows.length) {
      const empty = ws.addRow(["Aucun dossier sur cette période."]);
      ws.mergeCells(empty.number, 1, empty.number, last);
    }

    // ── Feuille 2 : un dossier par ligne ─────────────────────────────
    const ds = wb.addWorksheet("Dossiers", { views: [{ state: "frozen", ySplit: 1 }] });
    ds.columns = [
      { header: "Dossier", key: "ref", width: 19 }, { header: "Statut", key: "status", width: 12 },
      { header: "Validation client", key: "validated", width: 15 }, { header: "Créé le", key: "created", width: 11, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Voyage", key: "voyage", width: 24 }, { header: "Formule", key: "formule", width: 16 },
      { header: "Départ", key: "start", width: 11, style: { numFmt: "dd/mm/yyyy" } }, { header: "Retour", key: "end", width: 11, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Client", key: "client", width: 20 }, { header: "Téléphone", key: "phone", width: 14 }, { header: "Email", key: "email", width: 24 },
      { header: "Voyageurs", key: "pax", width: 10 }, { header: "Adultes", key: "adults", width: 9 }, { header: "Enfants", key: "kids", width: 9 }, { header: "Bébés", key: "babies", width: 8 },
      { header: "Hébergement", key: "hotels", width: 30 }, { header: "Chambres", key: "rooms", width: 16 }, { header: "Suppléments", key: "supplements", width: 24 },
      { header: "Total", key: "total", width: 12, style: { numFmt: '#,##0 "DH"' } }, { header: "Payé", key: "paid", width: 12, style: { numFmt: '#,##0 "DH"' } },
      { header: "Reste", key: "remaining", width: 12, style: { numFmt: '#,##0 "DH"' } }, { header: "En retard", key: "overdue", width: 12, style: { numFmt: '#,##0 "DH"' } },
      { header: "Prochaine échéance", key: "next", width: 22 }, { header: "Conseiller", key: "agent", width: 16 }, { header: "Remarques", key: "remarks", width: 28 },
    ];
    for (const { row, r, f } of rows) {
      const travelers = parseJSON<Traveler[]>(r.participants, []).filter((t) => t && t.fullName);
      const g = travelerGroups(travelers, Number(r.totalPax) || 0, f.travel?.travelStart);
      const hotelList = stays(r);
      ds.addRow({
        ref: r.ref || row.id, status: STATUS[String(r.status)]?.label ?? r.status, validated: r.clientValidatedAt ? "Oui" : "Non",
        created: row.created_at, voyage: r.packageTitle, formule: r.category || "", start: isoToDate(f.travel?.travelStart), end: isoToDate(f.travel?.travelEnd),
        client: r.userName || travelers[0]?.fullName || "", phone: travelers[0]?.phone || "", email: r.userEmail || "",
        pax: Number(r.totalPax) || 0, adults: g.adults, kids: g.kids.length, babies: g.babies.length,
        hotels: hotelList.map((h) => `${h.name}${h.city ? ` (${h.city})` : ""}`).join(" / "), rooms: hotelList[0]?.rooms ?? "",
        supplements: normalizeSupplements(pkgOf(r).blob, r.supplements, Number(r.totalPax) || 0).map((s) => `${s.label}${s.qty ? ` ×${s.qty}` : ""}`).join(", "),
        total: f.total, paid: f.paid, remaining: f.remaining, overdue: f.overdue,
        next: f.next ? `${fr(f.next.dueDate)} — ${nf(f.next.remaining)}` : "", agent: users.get(String(r.assignedTo)) ?? "",
        remarks: [r.remarks, r.specialConditions].filter(Boolean).join(" · "),
      }).getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS[String(r.status)]?.fill ?? "FFFFFFFF" } };
    }
    this.headerStyle(ds);

    // ── Feuille 3 : rooming list ─────────────────────────────────────
    const rl = wb.addWorksheet("Rooming list", { views: [{ state: "frozen", ySplit: 1 }] });
    rl.columns = [
      { header: "Hôtel", key: "hotel", width: 26 }, { header: "Ville", key: "city", width: 14 }, { header: "Catégorie", key: "stars", width: 10 },
      { header: "Arrivée", key: "in", width: 11, style: { numFmt: "dd/mm/yyyy" } }, { header: "Départ", key: "out", width: 11, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Nuits", key: "nights", width: 7 }, { header: "Dossier", key: "ref", width: 19 }, { header: "Chambres", key: "rooms", width: 18 },
      { header: "Occupants", key: "occupants", width: 44 }, { header: "Statut", key: "status", width: 12 },
    ];
    for (const { row, r, f } of rows.filter((x) => x.r.status !== "cancelled")) {
      const names = parseJSON<Traveler[]>(r.participants, []).filter((t) => t?.fullName).map((t) => [t.civility, t.fullName].filter(Boolean).join(" ")).join(", ");
      let cursor = f.travel?.travelStart ?? null;
      const list = stays(r);
      for (const h of list) {
        // Circuit : arrivées successives ; séjour : toute la durée du voyage.
        const checkIn = h.mode === "circuit" ? cursor : f.travel?.travelStart ?? null;
        const checkOut = h.mode === "circuit" && cursor && h.nights ? new Date(new Date(`${cursor}T12:00:00Z`).getTime() + h.nights * 86_400_000).toISOString().slice(0, 10) : f.travel?.travelEnd ?? null;
        if (h.mode === "circuit") cursor = checkOut;
        rl.addRow({ hotel: h.name, city: h.city, stars: h.stars, in: isoToDate(checkIn), out: isoToDate(checkOut), nights: h.nights || "", ref: r.ref || row.id, rooms: h.rooms, occupants: names || `${r.totalPax} voyageur(s) — noms à compléter`, status: STATUS[String(r.status)]?.label });
      }
    }
    this.headerStyle(rl);

    // ── Feuille 4 : règlements reçus ─────────────────────────────────
    const ps = wb.addWorksheet("Paiements", { views: [{ state: "frozen", ySplit: 1 }] });
    ps.columns = [
      { header: "Date", key: "date", width: 11, style: { numFmt: "dd/mm/yyyy" } }, { header: "Dossier", key: "ref", width: 19 }, { header: "Client", key: "client", width: 22 },
      { header: "Voyage", key: "voyage", width: 24 }, { header: "Départ", key: "start", width: 11, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Mode", key: "method", width: 14 }, { header: "Référence", key: "reference", width: 22 }, { header: "Montant", key: "amount", width: 13, style: { numFmt: '#,##0 "DH"' } },
    ];
    for (const { row, r, f } of rows) {
      for (const p of parseJSON<{ date?: string; method?: string; reference?: string; amount?: unknown }[]>(r.payments, [])) {
        ps.addRow({ date: isoToDate(p.date), ref: r.ref || row.id, client: r.userName || "", voyage: r.packageTitle, start: isoToDate(f.travel?.travelStart), method: METHODS[p.method ?? ""] ?? p.method ?? "", reference: p.reference || "", amount: Number(p.amount) || 0 });
      }
    }
    this.headerStyle(ps);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const first = rows[0]?.r;
    const name = opts.start && first
      ? `Asfari-Voyage-Planning-${slugify(String(first.packageTitle || "voyage"))}-${opts.start}.xlsx`
      : `Asfari-Voyage-Planning-${opts.from}-au-${opts.to}.xlsx`;
    return { buffer, filename: name };
  }

  private headerStyle(ws: ExcelJS.Worksheet) {
    const row = ws.getRow(1);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }
}

