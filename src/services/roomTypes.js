// Canonical room-type vocabulary. `label` is what actually ends up on a
// reservation's `rooms[].type` (see BookingFlow.jsx submit()) — the hotel
// catalog's room inventory must use the exact same labels, otherwise
// availability can never be matched against real bookings.
export const ROOM_TYPES = [
  { key: "triple", label: "Triple", colIdx: 0, paxPerRoom: 3 },
  { key: "double", label: "Double", colIdx: 1, paxPerRoom: 2 },
  { key: "single", label: "Single", colIdx: 2, paxPerRoom: 1 },
  { key: "child", label: "2–5 ans", colIdx: 3, paxPerRoom: 1 },
];

// Fixed columns the package editor puts before the price columns:
// "Hôtel", "Ville", "Nuits", "★" (see PackageeditorPage's priceColStart).
const PRICE_COL_START = 4;

// "2–5 ans" (en dash) / "2-5 ans" (hyphen) / " Triple " must all match the
// same classic type — headers are free text typed by an admin.
export const normLabel = (s) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const CLASSIC_BY_LABEL = new Map(ROOM_TYPES.map((rt) => [normLabel(rt.label), rt]));

/**
 * The price columns a hotel-category (a "formule") actually prices, derived
 * from the package data instead of the fixed four-column vocabulary.
 *
 * `hotelCategories[]` shape written by the editor (PackageeditorPage,
 * HotelCategoryItem):
 *   { id, label, basePrice, note,
 *     tableHeaders: ["Hôtel","Ville","Nuits","★", ...priceColumnLabels],
 *     hotels: [{ id, hotelId?, name, city, nights, stars,
 *                cols: [...priceStrings],      // parallel to the price headers
 *                allotment: [...quotas],       // indexed by the same colIdx
 *                blockWhenFull }] }
 *
 * The editor lets an admin add / rename / remove price columns freely, so
 * `cols` can be longer or shorter than four and carry custom labels
 * ("Baby 1-2"). Legacy documents may have no `tableHeaders` at all, or a
 * shorter fixed prefix — the price columns are therefore taken as the LAST
 * `cols.length` headers (same rule PackagesPage's HotelsTab already uses).
 *
 * Returns `[{ key, label, colIdx, paxPerRoom }]`:
 *  - `label`  the header text, falling back to the classic label for that
 *             position when headers are missing/blank.
 *  - `paxPerRoom` the classic occupancy when the label names a classic type
 *             ("Triple" → 3), otherwise 1: nothing in the package data or in
 *             the hotel catalog (`rooms` is `[{type, price}]`) encodes the
 *             occupancy of a custom column.
 * Falls back to ROOM_TYPES when the category prices no columns at all, so
 * an empty formule still renders the four classic headers as before.
 */
export function roomTypesFor(category) {
  const hotels = category?.hotels || [];
  const headers = category?.tableHeaders || [];
  const colCount = hotels.reduce((max, h) => Math.max(max, h?.cols?.length || 0), 0);
  if (!colCount) {
    return headers.length > PRICE_COL_START
      ? roomTypesFromHeaders(headers.slice(PRICE_COL_START))
      : ROOM_TYPES;
  }
  // Price headers are the last `colCount` entries — robust whether the doc
  // came from the current editor (4-column prefix) or an older shape.
  const hasHeaders = headers.length >= colCount;
  const priceHeaders = hasHeaders ? headers.slice(headers.length - colCount) : [];
  // With no headers to go by (true legacy documents) keep rendering at least
  // the four classic columns, exactly as the hardcoded version did — a doc
  // that prices only three still shows an empty "2–5 ans" column.
  const count = hasHeaders ? colCount : Math.max(colCount, ROOM_TYPES.length);
  return roomTypesFromHeaders(Array.from({ length: count }, (_, i) => priceHeaders[i]));
}

function roomTypesFromHeaders(priceHeaders) {
  return priceHeaders.map((header, colIdx) => {
    const classicAtPos = ROOM_TYPES[colIdx];
    const label = String(header ?? "").trim() || classicAtPos?.label || `Chambre ${colIdx + 1}`;
    const classic = CLASSIC_BY_LABEL.get(normLabel(label));
    return {
      key: `c${colIdx}`,
      label,
      colIdx,
      paxPerRoom: classic ? classic.paxPerRoom : 1,
    };
  });
}

/** The columns of one hotel row that carry a real price (> 0). */
export function pricedRoomTypes(category, hotel, parse = parsePriceCell) {
  return roomTypesFor(category).filter((rt) => parse(hotel?.cols?.[rt.colIdx]) > 0);
}

/** "1 200,50" / "1200" / undefined → number. Mirrors BookingFlow's parsePrice. */
export function parsePriceCell(str) {
  return parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
