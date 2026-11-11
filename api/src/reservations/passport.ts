import { badRequest } from "../common/errors";
import { parseJSON } from "./pricing";

// Validité des passeports : au moins N mois après la date de retour
// (Paramètres → Agence, `passportValidityMonths` ; 0 = pas de contrôle).
// Même règle que src/services/travelers.js (passportExpiryIssue).

interface Traveler {
  fullName?: string;
  passportNumber?: string;
  passportExpiry?: string;
}

export function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Message d'erreur si le passeport expire trop tôt, sinon null. */
export function passportExpiryIssue(expiry: unknown, travelEnd: unknown, months: number): string | null {
  if (!months || typeof expiry !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(expiry)) return null;
  if (typeof travelEnd !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(travelEnd)) return null;
  const min = addMonthsIso(travelEnd, months);
  if (expiry.slice(0, 10) >= min) return null;
  return expiry.slice(0, 10) < travelEnd.slice(0, 10)
    ? "passeport expiré avant la date de retour"
    : `passeport valable moins de ${months} mois après le retour (minimum : ${min.split("-").reverse().join("/")})`;
}

/**
 * Refuse les passeports qui expirent trop tôt. Seules les dates saisies ou
 * modifiées sont contrôlées (`current` = voyageurs déjà enregistrés) : une
 * autre correction sur un dossier existant n'est pas bloquée par un passeport
 * déjà connu de l'équipe.
 */
export function assertPassports(next: unknown, current: unknown, travelEnd: unknown, months: number) {
  if (!months) return;
  const list = parseJSON<Traveler[]>(next, []);
  const before = parseJSON<Traveler[]>(current, []);
  if (!Array.isArray(list)) return;
  const problems: string[] = [];
  list.forEach((t, i) => {
    if (!t?.passportExpiry) return;
    const prev = Array.isArray(before) ? before[i] : undefined;
    if (prev?.passportExpiry === t.passportExpiry) return;
    const issue = passportExpiryIssue(t.passportExpiry, travelEnd, months);
    if (issue) problems.push(`${t.fullName || `Voyageur ${i + 1}`} : ${issue}`);
  });
  if (problems.length) {
    throw badRequest(`Passeport non accepté — ${problems.join(" ; ")}. Il doit être valable au moins ${months} mois après la date de retour.`, "passport_expiry");
  }
}
