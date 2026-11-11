// Logique des emails de réservation, portée depuis le front pour qu'elle
// tourne côté serveur (un client ne peut plus choisir les destinataires).
// À garder alignée avec src/services/emailSettings.js (EMAIL_TRIGGERS,
// singleton de réglages) et le catalogue de variables de
// src/services/emailVariables.js. buildReservationParams n'existe plus que
// côté serveur.

export const EMAIL_SETTINGS_KIND = "email-settings";

export const EMAIL_TRIGGERS: Record<string, { audience: "client" | "admin" }> = {
  reservation_created_client: { audience: "client" },
  reservation_created_admin: { audience: "admin" },
  reservation_confirmed: { audience: "client" },
  reservation_paid: { audience: "client" },
  reservation_cancelled: { audience: "client" },
  reservation_completed: { audience: "client" },
  payment_reminder: { audience: "client" },
  booking_abandoned: { audience: "client" },
};

export interface EmailSettings {
  adminEmails?: string;
  triggers?: Record<string, { enabled?: boolean; templateId?: string }>;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Le singleton de réglages (document `products` avec data.kind = "email-settings"). */
export function emailSettingsFromProducts(products: Record<string, unknown>[]): EmailSettings | null {
  for (const doc of products) {
    const data = parseJson<Record<string, unknown> | null>(doc.data, null);
    if (data?.kind === EMAIL_SETTINGS_KIND) return data as EmailSettings;
  }
  return null;
}

export function triggerConfig(settings: EmailSettings | null, key: string) {
  return settings?.triggers?.[key] || { enabled: false, templateId: "" };
}

export function splitEmails(str: unknown): string[] {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** Adresses valides d'un champ « a@x.ma, b@y.ma » ; les entrées malformées sont ignorées. */
export function validEmails(str: unknown): string[] {
  return splitEmails(str).filter((e) => EMAIL.test(e));
}

/** Adresse d'un en-tête « Nom <adresse> » ou d'une adresse seule. */
export function addressOf(from: string): string {
  return (/<([^>]+)>/.exec(from)?.[1] ?? from).trim();
}

/**
 * Champs d'envoi d'un template (fromName, fromEmail, replyTo, ccEmails,
 * bccEmails — édités dans Emailmanager.jsx).
 *
 * L'adresse d'expédition reste celle de la boîte SMTP (MAIL_FROM) : un
 * fromEmail arbitraire échouerait SPF/DKIM et finirait en spam ou refusé.
 * Le template choisit le NOM affiché, et son fromEmail sert d'adresse de
 * réponse quand replyTo est vide.
 */
export function templateEnvelope(data: Record<string, unknown>, senderAddress: string) {
  const fromName = String(data.fromName ?? "").replace(/[\r\n"<>]/g, "").trim();
  const fromEmail = validEmails(data.fromEmail)[0];
  const replyTo =
    validEmails(data.replyTo)[0] ||
    (fromEmail && fromEmail.toLowerCase() !== senderAddress.toLowerCase() ? fromEmail : undefined);
  return {
    fromName: fromName || undefined,
    replyTo,
    cc: validEmails(data.ccEmails),
    bcc: validEmails(data.bccEmails),
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  cancelled: "Annulée",
  completed: "Terminée",
};

type Participant = { fullName?: string; phone?: string; email?: string };

/** Réservation → variables {{...}} des templates (cf. src/services/emailVariables.js). */
export function buildReservationParams(r: Record<string, any>): Record<string, string> {
  const participants = parseJson<Participant[]>(r.participants, []);
  const lead = (Array.isArray(participants) ? participants : []).find((p) => p?.fullName || p?.phone || p?.email) || null;
  const payments = parseJson<{ amount?: number }[]>(r.payments, []);
  const totalPaid = (Array.isArray(payments) ? payments : []).reduce((s, p) => s + Number(p.amount || 0), 0);
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

/** Adresse du client d'une réservation (compte, sinon participant principal). */
export function reservationClientEmail(r: Record<string, any>): string {
  if (r.userEmail) return String(r.userEmail);
  const participants = parseJson<Participant[]>(r.participants, []);
  return (Array.isArray(participants) ? participants : []).find((p) => p?.email)?.email || "";
}

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const VARIABLE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Remplit un template (subject / preheader / html de email_templates).
 * Les valeurs viennent en partie des clients (nom, téléphone) : échappées
 * dans le HTML. Variable inconnue → chaîne vide.
 */
export function renderTemplate(
  tpl: { subject?: string; preheader?: string; html?: string },
  params: Record<string, string>,
) {
  const fill = (text: string, escape: boolean) =>
    text.replace(VARIABLE, (_m, key: string) => {
      const value = params[key] ?? "";
      return escape ? escapeHtml(value) : value;
    });

  const subject = fill(tpl.subject || "", false).replace(/[\r\n]+/g, " ").trim();
  const preheader = fill(tpl.preheader || "", true);
  let html = fill(tpl.html || "", true);
  if (preheader) {
    // Texte d'aperçu affiché par les clients mail, invisible dans le corps.
    html = `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>${html}`;
  }
  return { subject, html };
}
