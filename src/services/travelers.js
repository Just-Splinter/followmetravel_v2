// Voyageurs d'une réservation : champs attendus pour émettre billets, visas
// et rooming list, et contrôle de validité des passeports.

export const CIVILITIES = ["M.", "Mme", "Enfant"];

export const TRAVELER_FIELDS = [
  { key: "civility", label: "Civilité" },
  { key: "fullName", label: "Nom complet (comme sur le passeport)" },
  { key: "birthDate", label: "Date de naissance", type: "date" },
  { key: "nationality", label: "Nationalité" },
  { key: "passportNumber", label: "N° de passeport" },
  { key: "passportExpiry", label: "Expiration du passeport", type: "date" },
  { key: "phone", label: "Téléphone" },
  { key: "email", label: "Email" },
];

export function parseTravelers(raw) {
  try {
    const list = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const addMonths = (iso, months) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const ISO = /^\d{4}-\d{2}-\d{2}/;

/**
 * Passeport qui expire trop tôt : message, sinon null. Il doit être valable
 * au moins `months` mois après la date de retour (Paramètres → Agence ;
 * 0 = pas de contrôle). Même règle que l'API (api/src/reservations/passport.ts),
 * qui refuse l'enregistrement.
 */
export function passportExpiryIssue(expiry, travelEnd, months = 6) {
  if (!months || !ISO.test(expiry || "") || !ISO.test(travelEnd || "")) return null;
  const min = addMonths(travelEnd.slice(0, 10), months);
  if (expiry.slice(0, 10) >= min) return null;
  return expiry.slice(0, 10) < travelEnd.slice(0, 10)
    ? "passeport expiré avant la date de retour"
    : `passeport valable moins de ${months} mois après le retour (minimum : ${min.split("-").reverse().join("/")})`;
}

/** Problème de passeport d'un voyageur (manquant ou trop court), ou null. */
export function passportIssue(traveler, travelEnd, months = 6) {
  // `docNumber` : champ des réservations antérieures (passeport ou CIN).
  if (!traveler?.passportNumber && !traveler?.docNumber) return "Passeport à renseigner";
  if (!traveler.passportExpiry) return "Date d'expiration du passeport manquante";
  const issue = passportExpiryIssue(traveler.passportExpiry, travelEnd, months);
  return issue ? issue.charAt(0).toUpperCase() + issue.slice(1) : null;
}

/** Résumé pour un dossier : voyageurs incomplets ou passeports à problème. */
export function travelersStatus(reservation) {
  const travelers = parseTravelers(reservation?.participants);
  const pax = Number(reservation?.totalPax) || travelers.length;
  const issues = travelers.map((t) => passportIssue(t, reservation?.travelEnd)).filter(Boolean);
  const missing = Math.max(0, pax - travelers.filter((t) => t?.fullName).length);
  return { travelers, pax, missing, issues, complete: missing === 0 && issues.length === 0 };
}
