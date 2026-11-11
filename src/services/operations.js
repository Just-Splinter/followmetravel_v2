// Appels API des fonctions métier (planning, échéancier, documents, équipe,
// historique…) — voir api/src/finance, api/src/pdf, api/src/auth/users.controller.ts.
import { API_URL, request } from "./api";

// ── Disponibilité / planning / finance ────────────────────────────
export const getAvailability = (packageId) => request("GET", `/v1/packages/${encodeURIComponent(packageId)}/availability`);
/** Prochains départs publics (home du site) : dates, prix « dès », places restantes. */
export const getUpcomingDepartures = (days = 90, limit = 12) => request("GET", "/v1/departures/upcoming", { query: { days: String(days), limit: String(limit) } });
export const getPlanning = (from, to) => request("GET", "/v1/planning", { query: { ...(from ? { from } : {}), ...(to ? { to } : {}) } });
export const getReceivables = () => request("GET", "/v1/finance/receivables");
export const getReservationFinance = (id) => request("GET", `/v1/reservations/${encodeURIComponent(id)}/finance`);
export const runPaymentReminders = (dryRun) =>
  request("POST", "/v1/jobs/payment-reminders", { query: dryRun ? { dryRun: "true" } : {} });

// ── Documents PDF ─────────────────────────────────────────────────
// Remis au client : fiche de réservation (détail complet + conditions),
// facture (proforma tant qu'elle n'est pas émise, avec l'état de paiement)
// et conditions de vente à part.
export const DOCUMENTS = [
  { type: "reservation", label: "Fiche de réservation" },
  { type: "facture", label: "Facture" },
  { type: "cgv", label: "Conditions de vente" },
];
// Documents secondaires, toujours disponibles pour l'équipe.
export const OTHER_DOCUMENTS = [
  { type: "devis", label: "Devis" },
  { type: "contrat", label: "Contrat de vente" },
  { type: "programme", label: "Programme" },
  { type: "echeancier", label: "Échéancier" },
];

/** URL du PDF (ouverte dans un nouvel onglet : le cookie de session suit). */
export function documentUrl(reservationId, type, params = {}) {
  const url = new URL(`${API_URL}/v1/reservations/${encodeURIComponent(reservationId)}/documents/${type}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  return url.toString();
}
export const issueInvoice = (id) => request("POST", `/v1/reservations/${encodeURIComponent(id)}/invoice`);
/** Équipe : envoie au client la fiche, la facture et les conditions de vente (email + PDF). */
export const sendReservationDocuments = (id) => request("POST", `/v1/reservations/${encodeURIComponent(id)}/send-documents`);
/** Équipe : message libre au client (boîte de réception + email si configuré). */
export const sendClientMessage = (id, subject, message) =>
  request("POST", `/v1/reservations/${encodeURIComponent(id)}/message`, { body: { subject, message } });
/** Client : valide sa fiche de réservation et accepte les conditions de vente. */
export const validateReservation = (id) => request("POST", `/v1/reservations/${encodeURIComponent(id)}/validate`);

/**
 * Planning de voyage « Asfari Voyage » (Excel), téléchargé avec la session :
 * période (`from`/`to`) ou un départ (`packageId` + `start`).
 */
export async function downloadPlanningExcel(params = {}) {
  const url = new URL(`${API_URL}/v1/planning/export`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, { credentials: "include", headers: { "X-Fmt-Client": "web" } });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Export impossible (${res.status})`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "Asfari-Voyage-Planning.xlsx";
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Équipe ────────────────────────────────────────────────────────
export const ROLE_LABELS = { admin: "Administrateur", agent: "Conseiller", accounting: "Comptable" };
export const listUsers = (opts = {}) => request("GET", "/v1/users", { query: { ...(opts.all ? { scope: "all" } : {}), ...(opts.q ? { q: opts.q } : {}) } });
export const lookupUsers = (ids) => request("GET", "/v1/users/lookup", { query: { ids: ids.join(",") } });
export const createUser = (data) => request("POST", "/v1/users", { body: data });
export const updateUser = (id, data) => request("PATCH", `/v1/users/${encodeURIComponent(id)}`, { body: data });
export const deleteUser = (id) => request("DELETE", `/v1/users/${encodeURIComponent(id)}`);

// ── Historique / journal ──────────────────────────────────────────
export const listAudit = (filter = {}) =>
  request("GET", "/v1/audit", { query: Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])) });
export const addNote = (collection, documentId, message) => request("POST", "/v1/audit/notes", { body: { collection, documentId, message } });

// ── Prospects du site (newsletter, contact, devis) ───────────────
export const submitLead = (lead) => request("POST", "/v1/leads", { body: lead });
/** Client connecté : inscription newsletter de l'email du compte ({ subscribed }). */
export const getNewsletter = () => request("GET", "/v1/leads/newsletter");
export const setNewsletter = (subscribed) => request("PUT", "/v1/leads/newsletter", { body: { subscribed: !!subscribed } });

// ── Boîte de réception du client connecté (copies des emails de l'agence) ──
export const getInbox = () => request("GET", "/v1/inbox");
export const markMessageRead = (id) => request("POST", `/v1/inbox/${encodeURIComponent(id)}/read`);

// ── Catalogue / relances ──────────────────────────────────────────
export const bulkPrice = (payload) => request("POST", "/v1/packages/bulk-price", { body: payload });
export const sendAbandonFollowup = (userId, packageId) => request("POST", "/v1/emails/abandon-followup", { body: { userId, packageId } });
