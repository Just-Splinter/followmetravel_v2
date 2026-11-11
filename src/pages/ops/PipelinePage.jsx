import { useEffect, useMemo, useState } from "react";
import { useDetailModal } from "../../services/detailModal";
import { KanbanSquare } from "lucide-react";
import db, { Collections, Query } from "../../services/database";
import { dateFr, money } from "../../services/opsFormat";
import { ErrorNote, Loading, Page } from "../../components/ops/OpsUI";

const parse = (raw) => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const paidOf = (r) => parse(r.payments).reduce((s, p) => s + (Number(p.amount) || 0), 0);

/**
 * Étape commerciale d'un dossier, déduite du statut, des paiements et des
 * dates de voyage — pas de saisie en plus pour l'équipe.
 */
function stageOf(r, today) {
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "completed") return "done";
  const total = Number(r.totalEstimate) || 0;
  const paid = paidOf(r);
  if (r.travelStart && r.travelStart <= today) return "travelling";
  if (r.status === "pending") return "request";
  if (paid <= 0) return "confirmed";
  if (paid < total) return "deposit";
  return "settled";
}

const STAGES = [
  { key: "lead", label: "Prospects", hint: "Clients enregistrés sans réservation", color: "#64748b" },
  { key: "request", label: "Demandes", hint: "À rappeler / confirmer", color: "#d97706" },
  { key: "confirmed", label: "Confirmées", hint: "Acompte attendu", color: "#2563eb" },
  { key: "deposit", label: "Acompte versé", hint: "Solde à encaisser", color: "#7c3aed" },
  { key: "settled", label: "Soldées", hint: "Prêtes au départ", color: "#16a34a" },
  { key: "travelling", label: "En voyage / rentrés", hint: "À clôturer (avis client)", color: "#0891b2" },
  { key: "done", label: "Terminées", hint: "30 derniers jours", color: "#94a3b8" },
];

export default function PipelinePage() {
  const { openReservation, openClient } = useDetailModal();
  const [reservations, setReservations] = useState(null);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);
  // Instant de référence figé au chargement de la page (rendu pur).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    Promise.all([
      db.listAll(Collections.RESERVATIONS, [Query.orderDesc("$createdAt")]),
      db.listAll(Collections.CLIENTS, [Query.orderDesc("$createdAt")]),
    ])
      .then(([r, c]) => {
        setReservations(r.documents);
        setClients(c.documents);
      })
      .catch(setError);
  }, []);

  const today = new Date(now).toISOString().slice(0, 10);
  const columns = useMemo(() => {
    const cols = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    if (!reservations) return cols;
    const monthAgo = new Date(now - 30 * 864e5).toISOString();
    const bookedEmails = new Set(reservations.map((r) => (r.userEmail || "").toLowerCase()).filter(Boolean));
    for (const c of clients) {
      if (!bookedEmails.has((c.email || "").toLowerCase())) cols.lead.push({ kind: "client", doc: c });
    }
    for (const r of reservations) {
      const stage = stageOf(r, today);
      if (stage === "cancelled") continue;
      if (stage === "done" && (r.$updatedAt || "") < monthAgo) continue;
      cols[stage].push({ kind: "reservation", doc: r });
    }
    return cols;
  }, [reservations, clients, today, now]);

  const cancelled = (reservations || []).filter((r) => r.status === "cancelled").length;

  return (
    <Page title="Pipeline commercial" subtitle={`Où en est chaque dossier, de la demande au retour de voyage.${cancelled ? ` ${cancelled} dossier(s) annulé(s) non affiché(s).` : ""}`}>
      <ErrorNote error={error} />
      {!reservations ? (
        <Loading />
      ) : (
        <div className="ops-kanban">
          {STAGES.map((s) => {
            const list = columns[s.key];
            const amount = list.reduce((sum, x) => sum + (x.kind === "reservation" ? Number(x.doc.totalEstimate) || 0 : 0), 0);
            return (
              <div key={s.key} className="ops-col" style={{ borderTop: `3px solid ${s.color}` }}>
                <div className="ops-col-head">
                  <span>{s.label} <span className="ops-muted">({list.length})</span></span>
                  {amount > 0 && <span className="ops-muted">{money(amount)}</span>}
                </div>
                <div className="ops-muted" style={{ marginBottom: 10 }}>{s.hint}</div>
                {list.length === 0 && <div className="ops-muted" style={{ textAlign: "center", padding: 20 }}><KanbanSquare size={18} /></div>}
                {list.map(({ kind, doc }) =>
                  kind === "client" ? (
                    <div key={doc.$id} className="ops-tile" role="button" tabIndex={0} onClick={() => openClient({ email: doc.email, name: doc.name })} onKeyDown={(e) => e.key === "Enter" && openClient({ email: doc.email, name: doc.name })}>
                      <strong style={{ fontSize: 13 }}>{doc.name}</strong>
                      <div className="ops-muted">{[doc.phone, doc.email].filter(Boolean).join(" · ")}</div>
                      {doc.notes && <div style={{ fontSize: 12, marginTop: 4, color: "#475569" }}>{doc.notes}</div>}
                    </div>
                  ) : (
                    <div key={doc.$id} className="ops-tile" role="button" tabIndex={0} onClick={() => openReservation(doc.$id)} onKeyDown={(e) => e.key === "Enter" && openReservation(doc.$id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>{doc.userName || "—"}</strong>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{money(doc.totalEstimate)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{doc.packageTitle}</div>
                      <div className="ops-muted">{doc.ref} · départ {dateFr(doc.travelStart) || doc.dateFrom} · {doc.totalPax} pers.</div>
                      {s.key === "deposit" && <div className="ops-muted">Réglé {money(paidOf(doc))}</div>}
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
