import { useCallback, useEffect, useMemo, useState } from "react";
import { useDetailModal } from "../../services/detailModal";
import { AlertTriangle, BellRing, CalendarClock, Send, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { hasRole } from "../../services/roles";
import { getReceivables, runPaymentReminders } from "../../services/operations";
import { dateFr, money, useTeam } from "../../services/opsFormat";
import { Badge, Empty, ErrorNote, Kpis, Loading, Page, StatusBadge } from "../../components/ops/OpsUI";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "overdue", label: "En retard" },
  { key: "week", label: "À 7 jours" },
  { key: "month", label: "À 30 jours" },
];

const KIND_LABEL = (k) => (k === "upcoming" ? "Rappel avant échéance" : k.startsWith("overdue") ? `Relance de retard n°${k.split("-")[1]}` : k);

export default function ReceivablesPage() {
  const { user } = useAuth();
  const team = useTeam();
  const canRun = hasRole(user, "admin", "accounting");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [mine, setMine] = useState(false);
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    getReceivables().then((d) => {
      setError(null);
      setData(d);
    }).catch(setError);
  }, []);
  useEffect(load, [load]);

  const items = useMemo(() => {
    const list = data?.items || [];
    return list.filter((i) => {
      if (mine && i.assignedTo !== user?.$id) return false;
      const d = i.next?.daysToDue;
      if (filter === "overdue") return i.overdue > 0;
      if (filter === "week") return d !== undefined && d >= 0 && d <= 7;
      if (filter === "month") return d !== undefined && d >= 0 && d <= 30;
      return true;
    });
  }, [data, filter, mine, user]);

  const reminders = async (dryRun) => {
    setRunning(true);
    try {
      const r = await runPaymentReminders(dryRun);
      setRun(r);
      if (!dryRun) load();
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  };

  const nameOf = (id) => team.find((u) => u.$id === id)?.name || "";
  const { openReservation, openClient } = useDetailModal();

  return (
    <Page
      title="Échéancier & encaissements"
      subtitle="Tous les dossiers avec un reste à payer, du plus urgent au moins urgent. Les rappels partent automatiquement chaque matin (Paramètres → Agence)."
      actions={
        canRun && (
          <>
            <button className="res-btn ghost" disabled={running} onClick={() => reminders(true)}><BellRing size={15} /> Simuler les relances du jour</button>
            <button className="res-btn primary" disabled={running} onClick={() => reminders(false)}><Send size={15} /> Envoyer maintenant</button>
          </>
        )
      }
    >
      <ErrorNote error={error} />
      {run && (
        <div className={`ops-alert ${run.dryRun ? "info" : run.sent ? "info" : "warn"}`}>
          <BellRing size={16} />
          <div>
            <strong>{run.dryRun ? `Simulation : ${run.count} relance(s) partiraient aujourd'hui.` : `${run.sent} relance(s) envoyée(s) sur ${run.count}.`}</strong>
            {run.report.map((r) => (
              <div key={`${r.reservationId}-${r.installment}-${r.kind}`} style={{ fontSize: 12.5 }}>
                {r.ref} — {r.installment} — {KIND_LABEL(r.kind)}{r.reason && r.reason !== "dry-run" ? ` (${r.reason})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <Kpis
        items={[
          { label: "Reste à encaisser", value: money(data?.summary.remaining), icon: Wallet },
          { label: "En retard", value: money(data?.summary.overdue), icon: AlertTriangle, color: "#dc2626", bg: "rgba(220,38,38,.1)", sub: `${data?.summary.overdueCount ?? 0} dossier(s)` },
          { label: "Dossiers à suivre", value: data?.total ?? "—", icon: CalendarClock, color: "#2563eb", bg: "rgba(37,99,235,.1)" },
        ]}
      />
      <div className="res-toolbar">
        <div className="res-filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={`res-pill ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
          <button className={`res-pill ${mine ? "active" : ""}`} onClick={() => setMine((v) => !v)}>Mes dossiers</button>
        </div>
      </div>
      <div className="res-table-wrap">
        {!data ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty icon={Wallet} title="Rien à encaisser avec ces filtres" />
        ) : (
          <div className="res-table-scroll">
            <table className="res-table">
              <thead><tr><th>Dossier</th><th>Client</th><th>Voyage</th><th>Prochaine échéance</th><th>Reste</th><th>En retard</th><th>Conseiller</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.reservationId} className="res-row is-clickable" onClick={() => openReservation(i.reservationId)}>
                    <td><button className="adm-link" onClick={(e) => { e.stopPropagation(); openReservation(i.reservationId); }}>{i.ref}</button><div style={{ marginTop: 4 }}><StatusBadge status={i.status} /></div></td>
                    <td><button className="adm-link res-client-name" onClick={(e) => { e.stopPropagation(); openClient({ email: i.email, name: i.client }); }}>{i.client}</button><div className="res-client-email">{i.email}</div></td>
                    <td><div className="res-pkg-title">{i.packageTitle}</div><div className="res-pkg-dates">Départ {dateFr(i.travelStart)}</div></td>
                    <td>
                      {i.next ? (
                        <>
                          <strong>{i.next.label}</strong> · {money(i.next.remaining)}
                          <div className="ops-muted">
                            {dateFr(i.next.dueDate)} — {i.next.daysToDue < 0 ? <Badge cls="danger">{-i.next.daysToDue} j de retard</Badge> : i.next.daysToDue === 0 ? <Badge cls="warn">aujourd'hui</Badge> : `dans ${i.next.daysToDue} j`}
                          </div>
                        </>
                      ) : "—"}
                      {i.mismatch && <div><Badge cls="warn" title="Le prix a changé depuis la saisie de l'échéancier">Échéancier à revoir</Badge></div>}
                    </td>
                    <td><strong>{money(i.remaining)}</strong><div className="ops-muted">sur {money(i.total)}</div></td>
                    <td>{i.overdue > 0 ? <strong style={{ color: "#dc2626" }}>{money(i.overdue)}</strong> : "—"}</td>
                    <td className="ops-muted">{nameOf(i.assignedTo) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}
