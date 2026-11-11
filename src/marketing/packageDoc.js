import { localizeData } from "../services/translate";

/**
 * Document « package » de l'API → objet voyage utilisé par la fiche et la
 * page de réservation : `data` (objet ou JSON) localisé, plus les champs de
 * premier niveau du document.
 */
export function packageFromDoc(doc, locale) {
  if (!doc) return null;
  let raw = doc.data;
  if (typeof raw !== "object" || raw === null) {
    try {
      raw = JSON.parse(raw) || {};
    } catch {
      raw = {};
    }
  }
  const d = localizeData(raw, locale);
  return { ...d, $id: doc.$id, title: doc.title, basePrice: doc.basePrice, country: d.country || doc.country };
}

/** Adresse de la page de réservation d'un voyage (départ présélectionné, voyageurs, date). */
export function bookingPath(id, { dateIdx = null, adults = null, date = null, formule = null } = {}) {
  const q = new URLSearchParams();
  if (dateIdx !== null && dateIdx !== undefined) q.set("depart", String(dateIdx));
  if (adults) q.set("adults", String(adults));
  if (date) q.set("date", String(date));
  if (formule !== null && formule !== undefined) q.set("formule", String(formule));
  const qs = q.toString();
  return `/reserver/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
}
