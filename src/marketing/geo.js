/* Place resolution for map pins — cities take priority over countries.
   CMS documents carry no coordinates, so names are matched against this
   gazetteer (accent-insensitive, FR/EN spellings). */
const CITIES = {
  casablanca: [33.5731, -7.5898],
  marrakech: [31.6295, -8.0086],
  agadir: [30.4278, -9.5981],
  dakhla: [23.6848, -15.958],
  istanbul: [41.0082, 28.9784],
  bursa: [40.1885, 29.061],
  antalya: [36.8969, 30.7133],
  dubai: [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773],
  caire: [30.0444, 31.2357],
  cairo: [30.0444, 31.2357],
  bali: [-8.4095, 115.1889],
  jakarta: [-6.2088, 106.8456],
  bangkok: [13.7563, 100.5018],
  phuket: [7.8804, 98.3923],
  "kuala lumpur": [3.139, 101.6869],
  paris: [48.8566, 2.3522],
  madrid: [40.4168, -3.7038],
  barcelone: [41.3874, 2.1686],
  barcelona: [41.3874, 2.1686],
  seville: [37.3891, -5.9845],
  kerala: [10.8505, 76.2711],
  singapour: [1.3521, 103.8198],
  singapore: [1.3521, 103.8198],
};

const COUNTRIES = {
  maroc: [31.7917, -7.0926],
  morocco: [31.7917, -7.0926],
  turquie: [38.9637, 35.2433],
  turkey: [38.9637, 35.2433],
  espagne: [40.4637, -3.7492],
  spain: [40.4637, -3.7492],
  egypte: [26.8206, 30.8025],
  egypt: [26.8206, 30.8025],
  emirats: [23.4241, 53.8478],
  uae: [23.4241, 53.8478],
  indonesie: [-2.5489, 118.0149],
  indonesia: [-2.5489, 118.0149],
  thailande: [15.87, 100.9925],
  thailand: [15.87, 100.9925],
  malaisie: [4.2105, 101.9758],
  malaysia: [4.2105, 101.9758],
  france: [46.6034, 1.8883],
  inde: [20.5937, 78.9629],
  india: [20.5937, 78.9629],
  turquia: [38.9637, 35.2433],
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Resolve the most specific known place mentioned in the given texts.
 *  Returns { key, latlng, city } or null. */
export function resolvePlace(...texts) {
  const hay = norm(texts.filter(Boolean).join(" "));
  for (const [key, latlng] of Object.entries(CITIES)) {
    if (hay.includes(key)) return { key, latlng, city: true };
  }
  for (const [key, latlng] of Object.entries(COUNTRIES)) {
    if (hay.includes(key)) return { key, latlng, city: false };
  }
  return null;
}
