// Exports CSV ouverts directement dans Excel : séparateur « ; » et BOM UTF-8
// (sinon Excel en français casse les accents et met tout dans une colonne).
import { parseTravelers } from "./travelers";

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob(["﻿", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const parse = (raw) => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const frDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : iso || "");
const paidOf = (r) => parse(r.payments).reduce((s, p) => s + (Number(p.amount) || 0), 0);

/** Réservations (une ligne par dossier). */
export function reservationsRows(reservations) {
  const headers = ["Référence", "Statut", "Créée le", "Client", "Email", "Téléphone", "Voyage", "Formule", "Départ", "Retour", "Voyageurs", "Total (DH)", "Réglé (DH)", "Reste (DH)"];
  const rows = reservations.map((r) => {
    const lead = parse(r.participants).find((p) => p?.fullName || p?.phone) || {};
    const paid = paidOf(r);
    return [r.ref, r.status, frDate(r.$createdAt), r.userName || lead.fullName, r.userEmail || lead.email, lead.phone, r.packageTitle, r.category,
      frDate(r.travelStart) || r.dateFrom, frDate(r.travelEnd) || r.dateTo, r.totalPax, Number(r.totalEstimate) || 0, paid, Math.max(0, (Number(r.totalEstimate) || 0) - paid)];
  });
  return { headers, rows };
}

/** Paiements (une ligne par règlement) — pour le rapprochement bancaire. */
export function paymentsRows(reservations) {
  const headers = ["Date", "Référence dossier", "Client", "Montant (DH)", "Mode", "Référence paiement", "Note"];
  const rows = reservations.flatMap((r) =>
    parse(r.payments).map((p) => [frDate(p.date), r.ref, r.userName, Number(p.amount) || 0, p.method, p.reference, p.note]),
  );
  return { headers, rows: rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]))) };
}

/**
 * Rooming list d'un départ : une ligne par chambre et par hôtel, avec les
 * occupants — le document que l'hôtel attend avant l'arrivée.
 */
export function roomingRows(reservations) {
  const headers = ["Hôtel", "Dossier", "Type de chambre", "N° chambre", "Occupants", "Arrivée", "Départ", "Remarques"];
  const rows = [];
  for (const r of reservations) {
    const travelers = parseTravelers(r.participants).map((t) => [t.civility, t.fullName].filter(Boolean).join(" ") || "—");
    let cursor = 0;
    for (const h of parse(r.hotels)) {
      let roomNo = 0;
      for (const room of h.rooms || []) {
        const per = { Triple: 3, Double: 2, Single: 1, Quadruple: 4 }[room.type] || 1;
        for (let q = 0; q < (Number(room.qty) || 0); q++) {
          roomNo += 1;
          const occupants = travelers.slice(cursor, cursor + per);
          cursor += per;
          rows.push([h.name, r.ref, room.type, roomNo, occupants.join(", "), frDate(r.travelStart) || r.dateFrom, frDate(r.travelEnd) || r.dateTo, ""]);
        }
      }
      cursor = 0; // mêmes voyageurs d'un hôtel à l'autre (circuit)
    }
  }
  return { headers, rows: rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]))) };
}

/** Manifeste passagers (compagnie aérienne, visas) : un voyageur par ligne. */
export function manifestRows(reservations) {
  const headers = ["Dossier", "Civilité", "Nom complet", "Date de naissance", "Nationalité", "N° passeport", "Expiration", "Téléphone", "Email"];
  const rows = reservations.flatMap((r) =>
    parseTravelers(r.participants).map((t) => [r.ref, t.civility, t.fullName, frDate(t.birthDate), t.nationality, t.passportNumber, frDate(t.passportExpiry), t.phone, t.email]),
  );
  return { headers, rows };
}
