// Fires the Appwrite Function that turns an email_templates document into
// an actual sent email, wherever a reservation lifecycle event happens
// (created, confirmed, paid, cancelled, completed). Fully decoupled from
// React context on purpose — createReservation lives under a light
// ReservationProvider-only route (no TravelDataProvider, to avoid its six
// bootstrap fetches — see Starter.jsx), so this reads the settings
// singleton with its own one-off request instead of expecting it from a
// context that a caller may not have mounted.
import db, { Collections } from "./database";
import functionService from "./functions";
import { EMAIL_TRIGGERS, emailSettingsFromPackages, triggerConfig, splitEmails } from "./emailSettings";

const EMAIL_FUNCTION_ID = import.meta.env.VITE_APPWRITE_EMAIL_FUNCTION_ID;

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée",
  completed: "Terminée",
};

function parseArray(raw) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Maps a reservation document to the {{variable}} names in emailVariables.js. */
export function buildReservationParams(reservation) {
  const r = reservation || {};
  const participants = parseArray(r.participants);
  const lead = participants.find((p) => p?.fullName || p?.phone || p?.email) || null;
  const payments = parseArray(r.payments);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalEstimate = Number(r.totalEstimate || 0);

  return {
    client_name: r.userName || lead?.fullName || "",
    client_email: r.userEmail || lead?.email || "",
    participant_name: lead?.fullName || r.userName || "",
    participant_phone: lead?.phone || "",
    reservation_ref: r.ref || "",
    reservation_status: STATUS_LABELS[r.status] || r.status || "",
    reservation_date_from: r.dateFrom || "",
    reservation_date_to: r.dateTo || "",
    reservation_pax: r.totalPax != null ? String(r.totalPax) : "",
    reservation_category: r.category || "",
    reservation_total: totalEstimate ? String(totalEstimate) : "",
    reservation_paid: totalPaid ? String(totalPaid) : "",
    reservation_remaining: totalEstimate ? String(Math.max(0, totalEstimate - totalPaid)) : "",
    reservation_created_at: r.$createdAt
      ? new Date(r.$createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
      : "",
    package_title: r.packageTitle || "",
  };
}

/**
 * Fires the configured template email for one trigger, if the admin has
 * turned it on and picked a template in Paramètres → Notifications. Never
 * throws — sending a notification is a side effect of a reservation action,
 * never something that should roll back or surface as a user-facing error
 * (misconfigured template, function not deployed yet, network hiccup…).
 */
export async function sendTriggerEmail(triggerKey, { params, targetEmails, userIds } = {}) {
  if (!EMAIL_FUNCTION_ID) return; // fonction pas encore déployée/configurée
  try {
    const { documents } = await db.listAll(Collections.PRODUCTS);
    const settings = emailSettingsFromPackages(documents);
    const cfg = triggerConfig(settings, triggerKey);
    if (!cfg.enabled || !cfg.templateId) return;

    const trigger = EMAIL_TRIGGERS.find((t) => t.key === triggerKey);
    const isAdminAudience = trigger?.audience === "admin";
    const resolvedTargets = isAdminAudience ? splitEmails(settings?.adminEmails) : (targetEmails || []).filter(Boolean);
    const resolvedUsers = isAdminAudience ? [] : (userIds || []).filter(Boolean);

    if (resolvedTargets.length === 0 && resolvedUsers.length === 0) return;

    await functionService.execute(EMAIL_FUNCTION_ID, {
      templateId: cfg.templateId,
      params,
      targetEmails: resolvedTargets,
      userIds: resolvedUsers,
    });
  } catch (err) {
    console.error(`[emailSender] trigger "${triggerKey}" failed`, err);
  }
}

/**
 * Manual "send a test" action from the template editor — unlike
 * sendTriggerEmail this DOES throw, since a direct button click needs
 * visible success/failure feedback instead of a silent best-effort side
 * effect. Sends whatever is currently saved for `templateId` — the function
 * re-reads the template from the database, it can't see unsaved edits still
 * sitting in the editor's local state.
 */
export async function sendTestEmail(templateId, recipientEmail) {
  if (!EMAIL_FUNCTION_ID) {
    throw new Error("Fonction d'envoi non configurée (VITE_APPWRITE_EMAIL_FUNCTION_ID manquant).");
  }
  if (!templateId) {
    throw new Error("Enregistrez le template avant d'envoyer un test.");
  }
  if (!recipientEmail) {
    throw new Error("Adresse email requise.");
  }
  return functionService.execute(EMAIL_FUNCTION_ID, {
    templateId,
    targetEmails: [recipientEmail],
  });
}
