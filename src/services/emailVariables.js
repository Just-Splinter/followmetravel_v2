// Reference catalog for the email template editor's variable picker — every
// entry here names a variable, where it *would* come from, and a realistic
// preview value. Nothing in this repo actually sends these emails (no
// Appwrite Function, no messaging integration) — templates are edited and
// previewed here, but {{variable}} substitution with live data would happen
// wherever a future send step lives. This list only covers data that
// genuinely exists elsewhere in the app (reservation, participant, package,
// account fields) — see BookingFlow.jsx/OmraBooking.jsx (the reservation
// payload), ReservationsManager.jsx (the fields shown per reservation) and
// PackageeditorPage.jsx (the package fields) for where each one is sourced.
export const EMAIL_VARIABLE_GROUPS = [
  {
    label: "Client",
    variables: [
      { key: "client_name", description: "Nom du compte connecté (Google ou email/mot de passe)", preview: "Sara Amrani" },
      { key: "client_email", description: "Email du compte connecté", preview: "sara.amrani@example.com" },
      { key: "participant_name", description: "Nom du participant principal de la réservation", preview: "Sara Amrani" },
      { key: "participant_phone", description: "Téléphone du participant principal", preview: "06 12 34 56 78" },
    ],
  },
  {
    label: "Réservation",
    variables: [
      { key: "reservation_ref", description: "Référence de la réservation", preview: "RES-2026-0142" },
      { key: "reservation_status", description: "Statut (en attente, confirmée, payée, terminée, annulée)", preview: "En attente" },
      { key: "reservation_date_from", description: "Date de départ (JJ/MM)", preview: "15/06" },
      { key: "reservation_date_to", description: "Fin de la fenêtre de départ (JJ/MM)", preview: "22/06" },
      { key: "reservation_pax", description: "Nombre total de voyageurs", preview: "4" },
      { key: "reservation_category", description: "Formule choisie (ex: 4 Étoiles)", preview: "4 Étoiles" },
      { key: "reservation_total", description: "Montant total estimé (DH)", preview: "18 500" },
      { key: "reservation_paid", description: "Montant déjà réglé (DH)", preview: "5 000" },
      { key: "reservation_remaining", description: "Reste à payer (DH)", preview: "13 500" },
      { key: "reservation_created_at", description: "Date de la demande", preview: "12 mars 2026" },
    ],
  },
  {
    label: "Package / Voyage",
    variables: [
      { key: "package_title", description: "Titre du package réservé", preview: "Voyage organisé à Dakhla" },
      { key: "package_destination", description: "Destination", preview: "Dakhla" },
      { key: "package_country", description: "Pays", preview: "Maroc" },
      { key: "package_duration", description: "Durée affichée (ex: 08 Jours / 07 Nuits)", preview: "08 Jours / 07 Nuits" },
      { key: "package_price", description: "Prix de base affiché sur la fiche package", preview: "4 990" },
      { key: "package_phone", description: "Téléphone de contact configuré sur le package", preview: "0664 586 425" },
      { key: "package_website", description: "Site web configuré sur le package", preview: "www.followmetravel.ma" },
    ],
  },
  {
    label: "Voyage & échéances",
    variables: [
      { key: "reservation_travel_start", description: "Date de départ réelle (JJ/MM/AAAA)", preview: "15/06/2027" },
      { key: "reservation_travel_end", description: "Date de retour réelle (JJ/MM/AAAA)", preview: "22/06/2027" },
      { key: "installment_label", description: "Échéance concernée (rappel de paiement)", preview: "Acompte 30 %" },
      { key: "installment_amount", description: "Montant restant de l'échéance (DH)", preview: "5 550" },
      { key: "installment_due_date", description: "Date limite de l'échéance", preview: "20/05/2027" },
      { key: "installment_days_late", description: "Jours de retard (0 si à venir)", preview: "3" },
      { key: "package_url", description: "Lien vers la fiche du voyage (relance d'abandon)", preview: "https://followmetravel.ma/packages/view?pkgId=…" },
    ],
  },
  {
    label: "Entreprise",
    variables: [
      { key: "company_name", description: "Nom de l'agence", preview: "Follow Me Travel" },
      { key: "site_url", description: "URL du site public", preview: "https://followmetravel.ma" },
      { key: "agency_phone", description: "Téléphones de l'agence (fiche agence)", preview: "+212 664 586 425" },
      { key: "agency_whatsapp", description: "Numéro WhatsApp", preview: "+212664586425" },
      { key: "agency_email", description: "Email de l'agence", preview: "contact@followmetravel.ma" },
      { key: "client_space_url", description: "Lien vers l'espace client (valider ou annuler la réservation)", preview: "https://www.followmetravel.ma/profil#reservations" },
      { key: "agency_rib", description: "Banque et RIB pour les virements", preview: "Banque — 000 000 …" },
    ],
  },
];

/** Flat lookup by key, e.g. to validate a template only uses known variables. */
export const EMAIL_VARIABLE_KEYS = EMAIL_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => v.key));

/** key -> {key, description, preview} — for looking up one variable's catalog entry by name. */
export const EMAIL_VARIABLE_INDEX = Object.fromEntries(
  EMAIL_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => [v.key, v]))
);
