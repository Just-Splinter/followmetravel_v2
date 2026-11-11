// Fiche agence : coordonnées, mentions légales, politique de paiement et
// d'annulation, CGV. Singleton dans `products` (data.kind = "agency"), comme
// le hero, l'omra et le contact — éditée dans Paramètres → Agence, lue par le
// site (WhatsApp, pied de page, CGV), l'API (PDF, échéancier, relances).
//
// Les valeurs par défaut doivent rester alignées avec api/src/agency/agency.ts.

export const AGENCY_KIND = "agency";

export const DEFAULT_CANCELLATION = [
  { daysBefore: 30, feePercent: 10 },
  { daysBefore: 15, feePercent: 30 },
  { daysBefore: 7, feePercent: 50 },
  { daysBefore: 0, feePercent: 100 },
];

export const DEFAULT_AGENCY = {
  tradeName: "Follow Me Travel",
  legalName: "",
  address: "",
  city: "",
  phones: ["+212 664 586 425", "+212 520 655 575"],
  whatsapp: "+212664586425",
  email: "contact@followmetravel.ma",
  website: "www.followmetravel.ma",
  licenceNumber: "",
  ice: "",
  rc: "",
  taxId: "",
  patente: "",
  capital: "",
  bankName: "",
  rib: "",
  invoiceMention: "",
  // Paiement : acompte à la confirmation, solde avant le départ.
  depositPercent: 30,
  depositDueDays: 3,
  balanceDaysBeforeDeparture: 30,
  reminderDaysBefore: 7,
  overdueReminderEveryDays: 7,
  maxOverdueReminders: 3,
  cancellationPolicy: DEFAULT_CANCELLATION,
  // Vide : la page /legal/cgv affiche le texte par défaut du site.
  cgvText: "",
  // Avant le lancement : les visiteurs ne voient que la page « Bientôt en ligne »
  // (l'équipe connectée voit le site complet). Titre / message vides = textes par défaut.
  comingSoon: false,
  launchDate: "",
  comingSoonTitle: "",
  comingSoonMessage: "",
  // Passeport valable au moins N mois après le retour (0 = pas de contrôle).
  passportValidityMonths: 6,
  // Fiche de réservation : valeurs par défaut (modifiables par dossier) et mention N.B.
  refundable: false,
  modifiable: false,
  reservationNote: "Selon la loi du bureau de change, l'agence déduit un montant de la dotation touristique des clients pour régler le paiement des hôtels et des services internationaux.",
  trustBadges: ["Agence de voyages agréée", "Assistance 7j/7 pendant le voyage", "Paiement en plusieurs fois", "Conseiller dédié"],
  // Chiffres affichés sur la page d'accueil — un chiffre vide n'est pas affiché.
  foundedYear: "",
  travelersCount: "",
  destinationsCount: "",
  googleRating: "",
  googleReviewsCount: "",
  googleReviewsUrl: "",
};

export function parseAgency(doc) {
  try {
    const data = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
    if (data?.kind !== AGENCY_KIND) return null;
    return { $id: doc.$id, ...DEFAULT_AGENCY, ...data };
  } catch {
    return null;
  }
}

export function isAgencyDoc(doc) {
  return parseAgency(doc) !== null;
}

/** La fiche agence depuis le tableau brut des products, sinon les valeurs par défaut. */
export function agencyFromPackages(packages) {
  for (const doc of packages || []) {
    const a = parseAgency(doc);
    if (a) return a;
  }
  return { ...DEFAULT_AGENCY };
}

export function agencyDocumentAttrs(info) {
  return {
    title: "Site — Agence",
    category: "destinations",
    status: "draft", // jamais affiché comme un package
    basePrice: 0,
    tags: [],
    data: JSON.stringify({ kind: AGENCY_KIND, ...info, $id: undefined }),
  };
}

/** Numéro WhatsApp au format wa.me (chiffres seulement, indicatif compris). */
export function whatsappNumber(agency) {
  const digits = String(agency?.whatsapp || "").replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `212${digits.slice(1)}`;
  return digits;
}

/** Valeur de réglage réellement renseignée (pas vide, pas un « [à compléter] » du modèle). */
export const isFilled = (v) => !!String(v ?? "").trim() && !/\[à compléter\]/i.test(String(v));

export function whatsappLink(agency, message) {
  const n = whatsappNumber(agency);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** Paliers triés du plus tôt au plus tard avant le départ. */
export function cancellationTiers(policy) {
  return [...(Array.isArray(policy) && policy.length ? policy : DEFAULT_CANCELLATION)]
    .map((t) => ({ daysBefore: Number(t.daysBefore) || 0, feePercent: Number(t.feePercent) || 0 }))
    .sort((a, b) => b.daysBefore - a.daysBefore);
}

/** Phrases lisibles : « Plus de 30 jours avant le départ : 10 % du prix ». */
export function cancellationLines(policy) {
  const tiers = cancellationTiers(policy);
  return tiers.map((t, i) => {
    const prev = tiers[i - 1];
    const range =
      i === 0
        ? `Plus de ${t.daysBefore} jours avant le départ`
        : t.daysBefore === 0
          ? `Moins de ${prev.daysBefore} jours avant le départ`
          : `De ${prev.daysBefore} à ${t.daysBefore} jours avant le départ`;
    return `${range} : ${t.feePercent === 100 ? "100 % du prix (aucun remboursement)" : `${t.feePercent} % du prix`}`;
  });
}

/**
 * Chiffres de la page d'accueil, uniquement ceux renseignés dans
 * Paramètres → Agence (jamais de valeur inventée).
 */
export function agencyStats(agency, year = new Date().getFullYear()) {
  const n = (v) => {
    const x = Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const founded = n(agency?.foundedYear);
  const years = founded >= 1950 && founded <= year ? year - founded : 0;
  return {
    years,
    travelers: n(agency?.travelersCount),
    destinations: n(agency?.destinationsCount),
    rating: Math.min(n(agency?.googleRating), 5),
    reviews: n(agency?.googleReviewsCount),
    reviewsUrl: String(agency?.googleReviewsUrl || "").trim(),
  };
}
