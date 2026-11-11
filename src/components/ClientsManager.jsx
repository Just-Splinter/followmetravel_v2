import { useState, useEffect, useMemo, useCallback } from "react";
import { useReservation } from "../context/ReservationContext";
import { useClients } from "../context/ClientsContext";
import { mergeClients } from "../services/clients";
import { DetailDrawer } from "./ReservationsManager";
import { useInjectStyles as useInjectReservationStyles, STATUS_TRIGGER } from "../services/reservationShared";
import { sendTriggerEmail } from "../services/emailSender";
import AddClientModal from "./AddClientModal";
import {
  Search, X, Users, Wallet, TrendingUp, Eye, Plus,
  Mail, Phone, Calendar, Package, CheckCircle, UserPlus,
  Clock, CreditCard, XCircle, Flag,
} from "lucide-react";

const STATUS_MAP = {
  pending: { label: "En attente", color: "#d97706", bg: "rgba(217,119,6,0.08)", icon: Clock },
  confirmed: { label: "Confirmée", color: "#16a34a", bg: "rgba(22,163,74,0.08)", icon: CheckCircle },
  paid: { label: "Payée", color: "#2563eb", bg: "rgba(37,99,235,0.08)", icon: CreditCard },
  cancelled: { label: "Annulée", color: "#dc2626", bg: "rgba(220,38,38,0.08)", icon: XCircle },
  completed: { label: "Terminée", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", icon: Flag },
};
const PROSPECT_BADGE = { label: "Prospect", color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: UserPlus };

const CL_CSS = `
.cl-root { min-height: 100vh; background: #f8fafc; font-family: 'Inter', system-ui, sans-serif; color: #1e293b; }
.cl-container { max-width: 1320px; margin: 0 auto; padding: 28px 32px; }
.cl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.cl-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.cl-kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; }
.cl-kpi-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,117,14,.1); color: #ff750e; }
.cl-kpi-label { font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 4px; }
.cl-kpi-value { font-size: 21px; font-weight: 800; color: #1e293b; line-height: 1; }
.cl-search-wrap { max-width: 380px; margin-bottom: 18px; }
.cl-search { display: flex; align-items: center; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0 14px; transition: all .2s; }
.cl-search:focus-within { border-color: #ff750e; box-shadow: 0 0 0 3px rgba(255,117,14,.1); }
.cl-search input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; flex: 1; padding: 10px 8px; font-family: inherit; }
.cl-table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.04); }
.cl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cl-table th { padding: 13px 16px; text-align: left; font-weight: 700; color: #64748b; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; border-bottom: 1.5px solid #e2e8f0; background: #f8fafc; white-space: nowrap; }
.cl-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.cl-row { cursor: pointer; transition: background .15s; }
.cl-row:hover { background: rgba(255,117,14,.03); }
.cl-row:last-child td { border-bottom: none; }
.cl-name { font-weight: 700; color: #1e293b; font-size: 13px; }
.cl-sub { color: #94a3b8; font-size: 11.5px; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.cl-count { font-size: 15px; font-weight: 800; color: #1e293b; text-align: center; display: block; }
.cl-total { font-weight: 800; color: #ff750e; font-size: 13px; }
.cl-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
.cl-empty { padding: 60px 20px; text-align: center; color: #94a3b8; }
.cl-add-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; border: none; background: linear-gradient(135deg,#ff750e,#ff750e); color: #fff; box-shadow: 0 2px 8px rgba(255,117,14,.25); white-space: nowrap; }
.cl-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,117,14,.35); }

.cl-drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 1000; display: flex; justify-content: flex-end; }
.cl-drawer { width: 100%; max-width: 520px; height: 100%; background: #fff; overflow-y: auto; box-shadow: -12px 0 40px rgba(0,0,0,.15); animation: clSlideIn .25s ease; }
@keyframes clSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.cl-drawer-header { padding: 24px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 12px; }
.cl-drawer-body { padding: 24px; }
.cl-drawer-close { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 6px; border-radius: 6px; }
.cl-drawer-close:hover { background: #f1f5f9; color: #1e293b; }
.cl-res-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
.cl-res-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.cl-res-ref { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #94a3b8; }
.cl-res-view-btn { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; background: none; border: none; color: #ff750e; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0; font-family: inherit; }
.cl-res-view-btn:hover { text-decoration: underline; }
`;

function useInjectClientsStyles() {
  useEffect(() => {
    if (document.getElementById("cl-global-styles")) return;
    const el = document.createElement("style");
    el.id = "cl-global-styles";
    el.textContent = CL_CSS;
    document.head.appendChild(el);
  }, []);
}

const fmt = (n) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(n || 0);

function ClientDrawer({ client, onClose, onOpenReservation }) {
  if (!client) return null;
  const isProspect = client.count === 0;
  return (
    <div className="cl-drawer-backdrop" onClick={onClose}>
      <div className="cl-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cl-drawer-header">
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: "#1e293b" }}>{client.userName}</p>
            {client.userEmail && (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                <Mail size={13} /> {client.userEmail}
              </p>
            )}
            {client.phone && (
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                <Phone size={13} /> {client.phone}
              </p>
            )}
          </div>
          <button className="cl-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="cl-drawer-body">
          {client.notes && (
            <div style={{ background: "#fffbeb", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12.5, color: "#92400e" }}>
              {client.notes}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Réservations</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{client.count}</div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Total estimé</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ff750e" }}>{fmt(client.totalEstimate)}</div>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
            Historique des réservations
          </p>

          {isProspect ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Aucune réservation pour l'instant.</p>
          ) : (
            client.reservations.map((r) => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
              const Icon = st.icon;
              return (
                <div key={r.$id} className="cl-res-card">
                  <div className="cl-res-card-top">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                        <Package size={13} /> {r.packageTitle || "—"}
                      </div>
                      <div className="cl-res-ref">{r.ref}</div>
                    </div>
                    <span className="cl-badge" style={{ background: st.bg, color: st.color }}>
                      <Icon size={11} /> {st.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} /> {r.dateFrom} → {r.dateTo} · {r.totalPax} pers.
                    </span>
                    <b style={{ color: "#1e293b" }}>{fmt(r.totalEstimate)}</b>
                  </div>
                  <button className="cl-res-view-btn" onClick={() => onOpenReservation(r)}>
                    <Eye size={12} /> Voir le détail complet
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientsManager() {
  useInjectClientsStyles();
  useInjectReservationStyles(); // DetailDrawer below needs .res-* classes even if ReservationsManager never mounts
  const { reservations, setReservations, findAllReservations, updateReservation } = useReservation();
  const { clients: clientDocs, findAllClients, createClient } = useClients();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [viewRes, setViewRes] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([findAllReservations(), findAllClients()]).finally(() => setLoading(false));
  }, [findAllReservations, findAllClients]);

  const clients = useMemo(() => mergeClients(clientDocs, reservations), [clientDocs, reservations]);
  const selected = useMemo(() => clients.find((c) => c.key === selectedKey) || null, [clients, selectedKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.userName.toLowerCase().includes(q) ||
      c.userEmail.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.lastReservation?.$createdAt || 0) - new Date(a.lastReservation?.$createdAt || 0)),
    [filtered]
  );

  const kpi = {
    total: clients.length,
    ca: clients.reduce((s, c) => s + c.totalEstimate, 0),
    avg: clients.length ? clients.reduce((s, c) => s + c.totalEstimate, 0) / clients.length : 0,
  };

  const handleCreateClient = async (data) => {
    await createClient(data);
  };

  // Mirrors ReservationsManager.jsx's handleSave/handleStatusChange — this
  // page has its own ReservationProvider instance (per-route in Starter.jsx),
  // so edits made here don't share state with that page; each re-fetches on
  // its own mount.
  const handleSaveReservation = async (data) => {
    try {
      const result = await updateReservation(data.$id, data);
      setReservations((rs) => rs.map((r) => (r.$id === result.$id ? { ...r, ...result } : r)));
      setViewRes((v) => (v?.$id === result.$id ? { ...v, ...result } : v));
      return result;
    } catch {
      throw new Error("Erreur de sauvegarde");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = reservations.find((r) => r.$id === id);
      if (!res) return;
      const result = await updateReservation(id, { ...res, status: newStatus });
      setReservations((rs) => rs.map((r) => (r.$id === id ? { ...r, status: newStatus, ...result } : r)));
      setViewRes((v) => (v?.$id === id ? { ...v, status: newStatus } : v));
      notify(`Statut → ${STATUS_MAP[newStatus]?.label || newStatus}`);

      const triggerKey = STATUS_TRIGGER[newStatus];
      if (triggerKey) {
        sendTriggerEmail(triggerKey, { reservationId: id });
      }
    } catch {
      notify("Erreur lors du changement de statut");
    }
  };

  return (
    <div className="cl-root">
      <div className="cl-container">
        <div className="cl-head">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#1e293b" }}>Clients</h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>
              Clients ajoutés manuellement et clients issus d'une réservation — cliquez une ligne pour voir le détail.
            </p>
          </div>
          <button className="cl-add-btn" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Ajouter client
          </button>
        </div>

        <div className="cl-kpis">
          <div className="cl-kpi-card">
            <div className="cl-kpi-icon"><Users size={20} /></div>
            <div><div className="cl-kpi-label">Clients</div><div className="cl-kpi-value">{kpi.total}</div></div>
          </div>
          <div className="cl-kpi-card">
            <div className="cl-kpi-icon"><Wallet size={20} /></div>
            <div><div className="cl-kpi-label">CA estimé (hors annulées)</div><div className="cl-kpi-value">{fmt(kpi.ca)}</div></div>
          </div>
          <div className="cl-kpi-card">
            <div className="cl-kpi-icon"><TrendingUp size={20} /></div>
            <div><div className="cl-kpi-label">Panier moyen / client</div><div className="cl-kpi-value">{fmt(kpi.avg)}</div></div>
          </div>
        </div>

        <div className="cl-search-wrap">
          <div className="cl-search">
            <Search size={16} style={{ color: "#94a3b8" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un client (nom, email, téléphone)…" />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="cl-table-wrap">
          {loading ? (
            <div className="cl-empty">Chargement…</div>
          ) : sorted.length === 0 ? (
            <div className="cl-empty">Aucun client pour l'instant — ajoutez-en un ou attendez la première réservation.</div>
          ) : (
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th style={{ textAlign: "center" }}>Réservations</th>
                  <th>Total estimé</th>
                  <th>Statut</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const st = c.count === 0 ? PROSPECT_BADGE : (STATUS_MAP[c.lastReservation?.status] || STATUS_MAP.pending);
                  const Icon = st.icon;
                  return (
                    <tr key={c.key} className="cl-row" onClick={() => setSelectedKey(c.key)}>
                      <td>
                        <div className="cl-name">{c.userName}</div>
                      </td>
                      <td>
                        {c.userEmail && <div className="cl-sub"><Mail size={11} /> {c.userEmail}</div>}
                        {c.phone && <div className="cl-sub"><Phone size={11} /> {c.phone}</div>}
                      </td>
                      <td><span className="cl-count">{c.count}</span></td>
                      <td><span className="cl-total">{c.count ? fmt(c.totalEstimate) : "—"}</span></td>
                      <td>
                        <span className="cl-badge" style={{ background: st.bg, color: st.color }}>
                          <Icon size={11} /> {st.label}
                        </span>
                      </td>
                      <td><Eye size={15} style={{ color: "#94a3b8" }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ClientDrawer client={selected} onClose={() => setSelectedKey(null)} onOpenReservation={setViewRes} />

      <DetailDrawer
        open={!!viewRes}
        res={viewRes}
        onClose={() => setViewRes(null)}
        onSave={handleSaveReservation}
        onStatusChange={handleStatusChange}
        notify={notify}
      />

      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={handleCreateClient} notify={notify} />

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: "#1e293b", color: "#fff",
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 1100,
          boxShadow: "0 8px 24px rgba(0,0,0,.2)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
