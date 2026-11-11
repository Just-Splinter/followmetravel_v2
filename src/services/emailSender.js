// Emails de réservation (created, confirmed, paid, cancelled, completed).
// L'API choisit le template (Paramètres → Notifications), calcule les
// variables et les destinataires à partir de la réservation en base : le
// front ne transmet que le déclencheur et l'id de la réservation.
import { request } from "./api";

/**
 * Fires the configured template email for one trigger, if the admin has
 * turned it on and picked a template in Paramètres → Notifications. Never
 * throws — sending a notification is a side effect of a reservation action,
 * never something that should roll back or surface as a user-facing error
 * (misconfigured template, SMTP not configured, network hiccup…).
 */
export async function sendTriggerEmail(triggerKey, { reservationId } = {}) {
  if (!reservationId) return;
  try {
    await request("POST", "/v1/emails/trigger", { body: { triggerKey, reservationId } });
  } catch (err) {
    console.error(`[emailSender] trigger "${triggerKey}" failed`, err);
  }
}

/**
 * Manual "send a test" action from the template editor — unlike
 * sendTriggerEmail this DOES throw, since a direct button click needs
 * visible success/failure feedback instead of a silent best-effort side
 * effect. Sends whatever is currently saved for `templateId` — the API
 * re-reads the template from the database, it can't see unsaved edits still
 * sitting in the editor's local state.
 */
export async function sendTestEmail(templateId, recipientEmail) {
  if (!templateId) {
    throw new Error("Enregistrez le template avant d'envoyer un test.");
  }
  if (!recipientEmail) {
    throw new Error("Adresse email requise.");
  }
  return request("POST", "/v1/emails/test", { body: { templateId, to: recipientEmail } });
}
