// Omra packages live in the Appwrite `products` collection as documents whose
// `data` JSON carries { kind: "omra", ... } — the same backend-without-a-new-
// collection pattern as hero slides (products is the only guest-readable
// collection with a large JSON attribute). The dashboard Omra tab manages
// them; every package UI must exclude them via isOmraDoc.

export const OMRA_KIND = "omra";

/** Parse a products document into an omra package, or null if it isn't one. */
export function parseOmra(doc) {
  try {
    const data = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
    if (data?.kind !== OMRA_KIND) return null;
    return { $id: doc.$id, title: doc.title, status: doc.status, ...data };
  } catch {
    return null;
  }
}

/** True when a products document is an omra package (hide from package UIs). */
export function isOmraDoc(doc) {
  return parseOmra(doc) !== null;
}

/** Published omra packages from the raw products array, in display order. */
export function omraFromPackages(packages) {
  return (packages || [])
    .map(parseOmra)
    .filter(Boolean)
    .filter((o) => o.status !== "draft")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Top-level attributes for an omra package's products document. */
export function omraDocumentAttrs(pkg) {
  const lowest = (pkg.pricing || [])
    .map((p) => Number(p.price) || 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b)[0];
  return {
    title: pkg.title || `Omra ${pkg.year || ""}`.trim(),
    category: "omra",
    status: pkg.status === "draft" ? "draft" : "published",
    basePrice: lowest ?? 0,
    tags: [],
    data: JSON.stringify({ kind: OMRA_KIND, ...pkg, $id: undefined, title: undefined }),
  };
}

/** Display year for the section title — earliest package year, else next year
 *  guess from today (Omra seasons are announced ahead). */
export function omraYear(list) {
  const years = (list || []).map((o) => Number(o.year)).filter(Boolean);
  if (years.length) return Math.min(...years);
  return new Date().getFullYear();
}

/** Blank package for the dashboard form. */
export function emptyOmra(year) {
  return {
    year,
    title: `Omra ${year}`,
    titleAr: `عمرة ${year}`,
    status: "published",
    order: 1,
    departureCity: "Casablanca",
    duration: "",
    nightsMakkah: 5,
    nightsMadinah: 4,
    dates: [{ from: "", to: "", label: "" }],
    makkahHotel: { name: "", stars: 4, distance: "" },
    madinahHotel: { name: "", stars: 4, distance: "" },
    pricing: [
      { key: "quad", label: "Chambre quadruple", labelAr: "غرفة رباعية", price: "" },
      { key: "triple", label: "Chambre triple", labelAr: "غرفة ثلاثية", price: "" },
      { key: "double", label: "Chambre double", labelAr: "غرفة ثنائية", price: "" },
    ],
    childPrice: "",
    includes: [
      "Billet d'avion aller-retour",
      "Visa Omra",
      "Hébergement Makkah & Madinah",
      "Transferts en bus climatisé",
      "Accompagnement religieux (mutawwif)",
      "Visites des sites saints",
    ],
    notes: "",
  };
}

/** Example package seeded by the dashboard button. */
export function exampleOmra() {
  const y = new Date().getFullYear();
  return {
    ...emptyOmra(y),
    title: `Omra Ramadan ${y}`,
    titleAr: `عمرة رمضان ${y}`,
    duration: "12 jours / 11 nuits",
    nightsMakkah: 6,
    nightsMadinah: 5,
    dates: [
      { from: "10/03", to: "22/03", label: "Début Ramadan" },
      { from: "20/03", to: "01/04", label: "Les dix dernières nuits" },
    ],
    makkahHotel: { name: "Swissôtel Al Maqam", stars: 5, distance: "150 m du Haram" },
    madinahHotel: { name: "Anwar Al Madinah Mövenpick", stars: 5, distance: "200 m de la Mosquée" },
    pricing: [
      { key: "quad", label: "Chambre quadruple", labelAr: "غرفة رباعية", price: "18500" },
      { key: "triple", label: "Chambre triple", labelAr: "غرفة ثلاثية", price: "21500" },
      { key: "double", label: "Chambre double", labelAr: "غرفة ثنائية", price: "25500" },
    ],
    childPrice: "12500",
  };
}
