// Type d'une formule (`hotelCategories[i]` d'un package) :
//
//   séjour  — une seule ville : les hôtels de la formule sont des ALTERNATIVES
//             (Istanbul : Grand Ant ou Grand Ons…). Le client en choisit un.
//   circuit — plusieurs villes : les hôtels sont des ÉTAPES successives
//             (Bangkok puis Phuket). Le même groupe passe par chacun.
//
// `category.mode` force le type ; sinon il est déduit des villes saisies.
// Miroir côté API : api/src/reservations/formules.ts (garder aligné).

export const FORMULE_MODES = [
  { value: "", label: "Automatique (selon les villes)" },
  { value: "sejour", label: "Séjour — une ville, le client choisit un hôtel" },
  { value: "circuit", label: "Circuit — plusieurs villes, hôtels successifs" },
];

const cityKey = (city) =>
  String(city || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();

/** "sejour" | "circuit" */
export function formuleMode(category) {
  if (category?.mode === "sejour" || category?.mode === "circuit") return category.mode;
  const cities = new Set((category?.hotels || []).map((h) => cityKey(h.city)).filter(Boolean));
  return cities.size > 1 ? "circuit" : "sejour";
}

/** Nuits de la formule : somme des étapes d'un circuit, durée du séjour sinon. */
export function formuleNights(category) {
  const nights = (category?.hotels || []).map((h) => Number(h.nights) || 0);
  if (!nights.length) return 0;
  return formuleMode(category) === "circuit" ? nights.reduce((a, b) => a + b, 0) : Math.max(...nights);
}
