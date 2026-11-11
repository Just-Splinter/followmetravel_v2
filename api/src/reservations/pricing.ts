// Recalcul serveur du prix d'une réservation — porté tel quel depuis
// l'Appwrite Function functions/create-reservation/src/main.js.
//
import { formuleMode } from "./formules";

// ROOM_TYPES DOIT rester aligné avec src/services/roomTypes.js : BookingFlow
// calcule le prix affiché avec cette table, et ce recalcul doit retomber sur
// le même nombre (test/pricing.test.ts compare les deux tables).

export const ROOM_TYPES = [
  { label: "Triple", colIdx: 0, paxPerRoom: 3 },
  { label: "Double", colIdx: 1, paxPerRoom: 2 },
  { label: "Single", colIdx: 2, paxPerRoom: 1 },
  { label: "2–5 ans", colIdx: 3, paxPerRoom: 1 },
];

// Ancienne liste par défaut (excursions d'Istanbul) que le site proposait pour
// TOUT package sans `suppliments` — y compris Bali ou la Thaïlande. Elle n'est
// plus proposée ni facturée ; elle sert seulement à relire les réservations
// faites avant (fiche PDF, facture, export planning) avec leurs libellés.
const SUPPLEMENT_LABELS: Record<string, string> = {
  excursions: "Pack excursions",
  princes: "Îles des Princes",
  bursa: "Excursion Bursa",
  shopping: "City tour & shopping",
  bosphore: "Croisière sur le Bosphore",
};

const DEFAULT_SUPPLEMENTS = [
  { key: "excursions", pricePerPax: 800 },
  { key: "princes", pricePerPax: 350 },
  { key: "bursa", pricePerPax: 250 },
  { key: "shopping", pricePerPax: 200 },
  { key: "bosphore", pricePerPax: 300 },
];

export function parseJSON<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val !== "string") return val as T;
  try {
    return (JSON.parse(val) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export const parsePrice = (str: unknown) =>
  parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

interface Hotel {
  hotelId?: string;
  cols?: unknown[];
}
export interface Departure {
  id?: unknown;
  from?: string;
  to?: string;
  /** Supplément (ou remise si négatif) par voyageur pour ce départ, en DH. */
  supplement?: unknown;
  /** Places vendables sur ce départ (voyageurs) ; vide = illimité. */
  capacity?: unknown;
  closed?: boolean;
  guaranteed?: boolean;
}
export interface PackageData {
  hotelCategories?: { label?: string; mode?: unknown; board?: string; hotels?: (Hotel & { name?: string; city?: string; stars?: unknown; nights?: unknown })[] }[];
  suppliments?: { key?: string; label?: string; pricePerPax?: unknown }[];
  basePrice?: unknown;
  departureDates?: Departure[];
}
interface Body {
  totalPax?: unknown;
  supplements?: unknown;
  hotels?: unknown;
  category?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
}

/** Le départ choisi parmi les dates du package (JJ/MM), s'il existe. */
export function findDeparture(pkgData: PackageData, dateFrom: unknown, dateTo?: unknown): Departure | null {
  const list = Array.isArray(pkgData.departureDates) ? pkgData.departureDates : [];
  return (
    list.find((d) => d.from === dateFrom && (!dateTo || !d.to || d.to === dateTo)) ??
    list.find((d) => d.from === dateFrom) ??
    null
  );
}

export const departureSupplement = (d: Departure | null) => Number(d?.supplement) || 0;

/**
 * Suppléments du package, avec leur libellé. Package sans suppléments : aucun,
 * sauf `legacy` (relecture d'une réservation existante) où l'ancienne liste
 * par défaut reste reconnue.
 */
export function supplementList(pkgData: PackageData, legacy = false) {
  if (Array.isArray(pkgData.suppliments) && pkgData.suppliments.length) {
    return pkgData.suppliments.map((s) => ({ key: s.key || s.label, label: s.label || s.key || "", pricePerPax: Number(s.pricePerPax) || 0 }));
  }
  return legacy ? DEFAULT_SUPPLEMENTS.map((s) => ({ ...s, label: SUPPLEMENT_LABELS[s.key] ?? s.key })) : [];
}

export interface SupplementLine {
  key: string;
  label: string;
  /** Nombre de voyageurs qui prennent ce supplément (pas forcément tous). */
  qty: number;
  pricePerPax: number;
  price: number;
}

/**
 * Suppléments d'une réservation en lignes normalisées (prix du catalogue).
 * Formats acceptés :
 *   - "bursa"                    ancien format : tous les voyageurs ;
 *   - { key: "bursa", qty: 2 }   nombre de voyageurs concernés (plafonné à pax) ;
 *   - { label, price }           ligne saisie au dashboard (montant libre),
 *                                ignorée quand `catalogOnly` (réservation en ligne).
 */
export function normalizeSupplements(pkgData: PackageData, raw: unknown, pax: number, catalogOnly = false): SupplementLine[] {
  const list: unknown[] = Array.isArray(raw) ? raw : parseJSON<unknown[]>(raw, []);
  if (!Array.isArray(list)) return [];
  // Réservation en ligne (catalogOnly) : seulement les suppléments du package.
  const catalog = supplementList(pkgData, !catalogOnly);
  const lines: SupplementLine[] = [];
  for (const item of list) {
    const obj = (typeof item === "object" && item !== null ? item : { key: item }) as Record<string, unknown>;
    const cat = obj.key !== undefined && obj.key !== "" ? catalog.find((s) => s.key === obj.key) : undefined;
    if (cat) {
      const wanted = obj.qty === undefined || obj.qty === null || obj.qty === "" ? pax : Math.floor(Number(obj.qty) || 0);
      const qty = Math.max(0, Math.min(wanted, pax || wanted));
      if (qty > 0) lines.push({ key: String(cat.key), label: cat.label, qty, pricePerPax: cat.pricePerPax, price: cat.pricePerPax * qty });
    } else if (!catalogOnly && (obj.label || obj.name)) {
      const price = Number(obj.price) || 0;
      lines.push({ key: "", label: String(obj.label || obj.name), qty: Number(obj.qty) || 0, pricePerPax: Number(obj.pricePerPax) || 0, price });
    }
  }
  return lines;
}

/** Hôtel de la formule correspondant à une ligne de réservation (id du catalogue, sinon nom). */
function matchHotel<T extends Hotel & { name?: string }>(hotels: T[], line: { hotelId?: string | null; name?: string }) {
  return hotels.find((h) => line.hotelId && h.hotelId === line.hotelId) ?? hotels.find((h) => !line.hotelId && line.name && h.name === line.name);
}

const roomSignature = (rooms: { type?: string; qty?: unknown }[] = []) =>
  rooms
    .filter((l) => Number(l.qty) > 0)
    .map((l) => `${l.type}:${Number(l.qty)}`)
    .sort()
    .join("|");

/**
 * Prix recalculé depuis le catalogue du package, comme BookingFlow.jsx :
 *   - mode par personne (aucune chambre tarifée) : basePrice × pax
 *   - mode chambres : Σ(prix du type × qté × pax/chambre) sur les hôtels choisis
 * plus les suppléments cochés × pax.
 *
 * Ne lève jamais. `verified: false` = forme de données non reconnue : la
 * réservation passe quand même (devis confirmé par téléphone, jamais un
 * paiement automatique) mais est marquée priceVerified:false pour l'admin.
 */
export function computeServerPrice(
  pkgData: PackageData,
  body: Body,
): { total: number | null; verified: boolean; reason?: string; departureSupplement?: number; pax?: number; supplements?: SupplementLine[] } {
  const base = computeBasePrice(pkgData, body);
  if (!base.verified || base.total === null) return base;
  // Suppléments : seulement ceux du catalogue, pour le nombre de voyageurs choisi.
  const supplements = normalizeSupplements(pkgData, body.supplements, base.pax, true);
  const suppTotal = supplements.reduce((a, s) => a + s.price, 0);
  // Supplément (ou remise) propre au départ choisi, par voyageur.
  const perPax = departureSupplement(findDeparture(pkgData, body.dateFrom, body.dateTo));
  return { total: base.total + suppTotal + perPax * base.pax, verified: true, departureSupplement: perPax, pax: base.pax, supplements };
}

function computeBasePrice(
  pkgData: PackageData,
  body: Body,
): { total: number | null; verified: boolean; reason?: string; pax: number } {
  const hotelCategories = pkgData.hotelCategories || [];
  const hasPricedRooms = hotelCategories.some((c) =>
    (c.hotels || []).some((h) => ROOM_TYPES.some((rt) => parsePrice(h.cols?.[rt.colIdx]) > 0)),
  );

  if (!hasPricedRooms) {
    const ppPrice = Number(pkgData.basePrice) || 0;
    const pax = Number(body.totalPax) || 0;
    return { total: ppPrice * pax, verified: true, pax };
  }

  const bodyHotels = parseJSON<{ hotelId?: string; name?: string; rooms?: { type?: string; qty?: unknown }[] }[]>(body.hotels, []);
  if (!Array.isArray(bodyHotels) || !bodyHotels.length) {
    return { total: null, verified: false, reason: "hotels payload vide ou invalide", pax: 0 };
  }

  const category = hotelCategories.find((c) => c.label === body.category);
  if (!category) return { total: null, verified: false, reason: `catégorie "${String(body.category)}" introuvable`, pax: 0 };
  const mode = formuleMode(category);

  // Séjour (une ville) : un seul hôtel, choisi parmi les alternatives.
  if (mode === "sejour" && bodyHotels.length !== 1) {
    return { total: null, verified: false, reason: "séjour : un seul hôtel attendu", pax: 0 };
  }
  // Circuit : le même groupe, donc les mêmes chambres, à chaque étape.
  if (mode === "circuit" && new Set(bodyHotels.map((h) => roomSignature(h.rooms))).size > 1) {
    return { total: null, verified: false, reason: "circuit : chambres différentes selon les étapes", pax: 0 };
  }

  let baseTotal = 0;
  let pax = 0;
  for (const [i, bh] of bodyHotels.entries()) {
    const hotel = matchHotel(category.hotels || [], bh);
    if (!hotel) return { total: null, verified: false, reason: `hôtel ${bh.hotelId ?? bh.name} absent de la catégorie`, pax: 0 };
    let hotelPax = 0;
    for (const line of bh.rooms || []) {
      const rt = ROOM_TYPES.find((r) => r.label === line.type);
      if (!rt) return { total: null, verified: false, reason: `type de chambre "${line.type}" inconnu`, pax: 0 };
      const linePax = (Number(line.qty) || 0) * rt.paxPerRoom;
      baseTotal += parsePrice(hotel.cols?.[rt.colIdx]) * linePax;
      hotelPax += linePax;
    }
    // Circuit : les voyageurs sont comptés une fois (première étape).
    if (mode === "sejour" || i === 0) pax += hotelPax;
  }

  return { total: baseTotal, verified: true, pax };
}

export interface LineItem {
  label: string;
  quantity: string;
  unit?: number;
  amount: number;
}

/**
 * Détail du prix d'une réservation pour le devis et la facture. La somme des
 * lignes vaut toujours le total du dossier : un écart (prix modifié à la main
 * dans le dashboard, remise) devient une ligne « Ajustement ».
 */
export function lineItems(r: Record<string, any>, pkgData: PackageData): LineItem[] {
  const pax = Number(r.totalPax) || 0;
  const items: LineItem[] = [];
  const hotels = parseJSON<{ name?: string; rooms?: { type?: string; qty?: unknown }[]; subtotal?: unknown; pax?: unknown }[]>(r.hotels, []);
  const category = (pkgData.hotelCategories || []).find((c) => c.label === r.category);
  if (Array.isArray(hotels) && hotels.length > 1 && category && formuleMode(category) === "circuit") {
    // Circuit : une seule ligne, les étapes dans l'ordre.
    const rooms = (hotels[0].rooms || []).map((l) => `${Number(l.qty) || 0} × ${l.type}`).join(", ");
    items.push({
      label: `Circuit ${r.packageTitle || ""}${r.category ? ` — formule ${r.category}` : ""} : ${hotels.map((h) => h.name || "hôtel").join(" → ")}`,
      quantity: `${rooms}${pax ? ` (${pax} pers.)` : ""}`,
      amount: hotels.reduce((a, h) => a + (Number(h.subtotal) || 0), 0),
    });
  } else if (Array.isArray(hotels) && hotels.length) {
    for (const h of hotels) {
      const rooms = (h.rooms || []).map((l) => `${Number(l.qty) || 0} × ${l.type}`).join(", ");
      items.push({
        label: `Forfait ${r.packageTitle || ""}${r.category ? ` — formule ${r.category}` : ""} : ${h.name || "hébergement"}`,
        quantity: `${rooms}${h.pax ? ` (${h.pax} pers.)` : ""}`,
        amount: Number(h.subtotal) || 0,
      });
    }
  } else if (pax) {
    const unit = Number(pkgData.basePrice) || 0;
    items.push({ label: `Forfait ${r.packageTitle || ""}`, quantity: `${pax} pers.`, unit, amount: unit * pax });
  }
  for (const s of normalizeSupplements(pkgData, r.supplements, pax)) {
    items.push({
      label: `Supplément : ${s.label}`,
      quantity: s.qty ? `${s.qty} pers.` : "",
      ...(s.pricePerPax ? { unit: s.pricePerPax } : {}),
      amount: s.price,
    });
  }
  const dep = Number(r.departureSupplement) || 0;
  if (dep) {
    items.push({ label: `${dep > 0 ? "Supplément" : "Réduction"} départ du ${r.dateFrom}`, quantity: `${pax} pers.`, unit: dep, amount: dep * pax });
  }
  const total = Number(r.totalEstimate) || 0;
  const sum = items.reduce((a, i) => a + i.amount, 0);
  if (Math.abs(total - sum) >= 1) {
    items.push({ label: total < sum ? "Remise / ajustement" : "Ajustement", quantity: "", amount: total - sum });
  }
  return items;
}
