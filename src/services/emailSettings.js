// Email-notification settings live in the `products` collection as a
// singleton document with data.kind = "email-settings" — the same
// backend-without-a-new-collection pattern as hero slides, omra and the
// contact page (see siteContact.js). Configures, per lifecycle event,
// whether a template email should fire and which template to use.

export const EMAIL_SETTINGS_KIND = "email-settings";

/**
 * Every point in the app that can send a template email. `audience`
 * decides where the email goes: "client" uses the reservation's own
 * email/user id, "admin" uses the agency address(es) configured below
 * (adminEmails) instead of anything caller-supplied.
 */
export const EMAIL_TRIGGERS = [
  {
    key: "reservation_created_client",
    label: "Nouvelle réservation reçue",
    audience: "client",
    hint: "Envoyé au client dès qu'il soumet une réservation.",
  },
  {
    key: "reservation_created_admin",
    label: "Nouvelle réservation — alerte agence",
    audience: "admin",
    hint: "Envoyé à l'agence dès qu'une réservation est créée.",
  },
  {
    key: "reservation_confirmed",
    label: "Réservation confirmée",
    audience: "client",
    hint: 'Envoyé au client quand le statut passe à "Confirmée".',
  },
  {
    key: "reservation_paid",
    label: "Paiement reçu",
    audience: "client",
    hint: 'Envoyé au client quand le statut passe à "Payée".',
  },
  {
    key: "reservation_cancelled",
    label: "Réservation annulée",
    audience: "client",
    hint: 'Envoyé au client quand le statut passe à "Annulée".',
  },
  {
    key: "reservation_completed",
    label: "Voyage terminé",
    audience: "client",
    hint: 'Envoyé au client quand le statut passe à "Terminée".',
  },
  {
    key: "payment_reminder",
    label: "Rappel de paiement",
    audience: "client",
    hint: "Envoyé automatiquement chaque matin avant une échéance, puis en cas de retard (réglages dans Paramètres → Agence). Échéancier PDF joint.",
  },
  {
    key: "booking_abandoned",
    label: "Réservation non finalisée",
    audience: "client",
    hint: "Envoyé à la main depuis Relances, à un client connecté qui a abandonné sa réservation.",
  },
];

export function parseEmailSettings(doc) {
  try {
    const data = typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data;
    if (data?.kind !== EMAIL_SETTINGS_KIND) return null;
    return { $id: doc.$id, ...data };
  } catch {
    return null;
  }
}

/** The singleton settings from the raw products array (or null). */
export function emailSettingsFromPackages(packages) {
  for (const doc of packages || []) {
    const s = parseEmailSettings(doc);
    if (s) return s;
  }
  return null;
}

export function emailSettingsDocumentAttrs(info) {
  return {
    title: "Site — Notifications email",
    category: "destinations",
    status: "draft", // never surfaces as a package anywhere
    basePrice: 0,
    tags: [],
    data: JSON.stringify({ kind: EMAIL_SETTINGS_KIND, ...info, $id: undefined }),
  };
}

/** {enabled, templateId} for one trigger — safe default when unconfigured. */
export function triggerConfig(settings, key) {
  return settings?.triggers?.[key] || { enabled: false, templateId: "" };
}

export function splitEmails(str) {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
