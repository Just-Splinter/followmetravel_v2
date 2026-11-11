// Type d'une formule — miroir de src/services/formules.js (garder aligné).
//
//   séjour  — une seule ville : les hôtels sont des alternatives, le client en choisit UN.
//   circuit — plusieurs villes : hôtels successifs, le même groupe passe par chacun.

export type FormuleMode = "sejour" | "circuit";

interface FormuleLike {
  mode?: unknown;
  hotels?: { city?: unknown; nights?: unknown }[];
}

const cityKey = (city: unknown) =>
  String(city ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();

export function formuleMode(category: FormuleLike | null | undefined): FormuleMode {
  if (category?.mode === "sejour" || category?.mode === "circuit") return category.mode;
  const cities = new Set((category?.hotels || []).map((h) => cityKey(h.city)).filter(Boolean));
  return cities.size > 1 ? "circuit" : "sejour";
}

export function formuleNights(category: FormuleLike | null | undefined): number {
  const nights = (category?.hotels || []).map((h) => Number(h.nights) || 0);
  if (!nights.length) return 0;
  return formuleMode(category) === "circuit" ? nights.reduce((a, b) => a + b, 0) : Math.max(...nights);
}
