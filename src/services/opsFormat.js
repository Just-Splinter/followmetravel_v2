// Formats et styles partagés par les pages de gestion (src/components/ops,
// src/components/reservation, src/pages/ops) — hors des fichiers de
// composants pour garder le fast refresh de Vite.
import { useEffect } from "react";
import { useInjectStyles } from "./reservationShared";
import { listUsers } from "./operations";
import { useState } from "react";

export const money = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(n) || 0);

/** AAAA-MM-JJ (ou ISO complet) → 12 nov. 2026 */
export const dateFr = (iso, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", opts);
};

export const STATUS_META = {
  pending: { label: "En attente", cls: "warn" },
  confirmed: { label: "Confirmée", cls: "ok" },
  paid: { label: "Payée", cls: "info" },
  cancelled: { label: "Annulée", cls: "danger" },
  completed: { label: "Terminée", cls: "muted" },
};

const OPS_CSS = `
.ops-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.ops-title { font-size: 24px; font-weight: 800; color: var(--adm-ink); margin: 0; letter-spacing: -.01em; }
.ops-sub { font-size: 13px; color: var(--adm-muted); margin: 4px 0 0; }
.ops-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.ops-card { background: #fff; border: 1px solid var(--adm-line); border-radius: 14px; padding: 18px 20px; box-shadow: 0 2px 12px rgba(0,0,0,.04); }
.ops-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.ops-muted { color: var(--adm-subtle); font-size: 12px; }
.ops-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 700; border: 1.5px solid; white-space: nowrap; }
.ops-badge.ok { color: var(--adm-success); background: rgba(22,163,74,.08); border-color: rgba(22,163,74,.25); }
.ops-badge.warn { color: var(--adm-warning); background: rgba(217,119,6,.08); border-color: rgba(217,119,6,.25); }
.ops-badge.danger { color: var(--adm-danger); background: rgba(220,38,38,.08); border-color: rgba(220,38,38,.25); }
.ops-badge.info { color: var(--adm-info); background: rgba(37,99,235,.08); border-color: rgba(37,99,235,.25); }
.ops-badge.muted { color: var(--adm-muted); background: var(--adm-surface-2); border-color: var(--adm-line); }
.ops-bar { height: 8px; background: var(--adm-surface-2); border-radius: 99px; overflow: hidden; min-width: 90px; }
.ops-bar > span { display: block; height: 100%; border-radius: 99px; background: var(--adm-brand); transition: width .4s; }
.ops-link { background: none; border: none; color: var(--adm-brand); font-weight: 700; cursor: pointer; font-family: inherit; font-size: inherit; padding: 0; text-decoration: none; }
.ops-link:hover { text-decoration: underline; }
.ops-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 16px; }
.ops-form label { display: flex; flex-direction: column; gap: 5px; font-size: 11px; font-weight: 700; color: var(--adm-muted); text-transform: uppercase; letter-spacing: .04em; }
.ops-form input, .ops-form select, .ops-form textarea { font: inherit; font-size: 13px; text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--adm-text); border: 1.5px solid var(--adm-line); border-radius: 9px; padding: 9px 11px; background: #fff; outline: none; }
.ops-form input:focus, .ops-form select:focus, .ops-form textarea:focus { border-color: var(--adm-brand); box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.ops-form .full { grid-column: 1 / -1; }
.ops-section { font-size: 12px; font-weight: 800; color: var(--adm-ink); text-transform: uppercase; letter-spacing: .06em; margin: 22px 0 10px; }
.ops-kanban { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(250px, 1fr); gap: 14px; overflow-x: auto; padding-bottom: 8px; }
.ops-col { background: var(--adm-surface-2); border-radius: 14px; padding: 12px; min-height: 200px; }
.ops-col-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; font-weight: 800; font-size: 13px; color: var(--adm-ink); }
.ops-tile { background: #fff; border: 1px solid var(--adm-line); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; transition: all .2s; }
.ops-tile:hover { border-color: var(--adm-brand); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.06); }
.ops-timeline { list-style: none; padding: 0; margin: 0; }
.ops-timeline li { position: relative; padding: 0 0 14px 22px; border-left: 2px solid var(--adm-line); margin-left: 6px; }
.ops-timeline li::before { content: ''; position: absolute; left: -7px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid var(--dot, var(--adm-subtle)); }
.ops-alert { border-radius: 10px; padding: 10px 14px; font-size: 13px; display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; }
.ops-alert.warn { background: var(--adm-warning-bg); border: 1px solid var(--adm-warning-line); color: var(--adm-warning-fg); }
.ops-alert.danger { background: var(--adm-danger-bg); border: 1px solid var(--adm-danger-line); color: var(--adm-danger-fg); }
.ops-alert.info { background: var(--adm-info-bg); border: 1px solid var(--adm-info-line); color: var(--adm-info-fg); }
.ops-alert.ok { background: var(--adm-success-bg); border: 1px solid var(--adm-success-line); color: var(--adm-success-fg); }
@media (max-width: 900px) { .res-kpis { grid-template-columns: repeat(2, 1fr) !important; } }
`;

export function useOpsStyles() {
  useInjectStyles();
  useEffect(() => {
    if (document.getElementById("ops-styles")) return;
    const el = document.createElement("style");
    el.id = "ops-styles";
    el.textContent = OPS_CSS;
    document.head.appendChild(el);
  }, []);
}

// Équipe (liste mise en cache pour la session) — attribution des dossiers, historique.
let teamPromise = null;
export function useTeam() {
  const [team, setTeam] = useState([]);
  useEffect(() => {
    teamPromise ??= listUsers().then((r) => r.users).catch(() => []);
    let alive = true;
    teamPromise.then((users) => alive && setTeam(users));
    return () => {
      alive = false;
    };
  }, []);
  return team;
}
