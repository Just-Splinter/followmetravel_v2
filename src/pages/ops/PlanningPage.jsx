import { useCallback, useEffect, useMemo, useState } from "react";
import { useDetailModal } from "../../services/detailModal";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, FileDown, Plane, TrendingUp, Users, Wallet } from "lucide-react";
import db, { Collections, Query } from "../../services/database";
import { downloadPlanningExcel, getPlanning } from "../../services/operations";
import { travelersStatus } from "../../services/travelers";
import { dateFr, money } from "../../services/opsFormat";
import { Badge, Empty, ErrorNote, FillBar, Kpis, Loading, Page, StatusBadge } from "../../components/ops/OpsUI";

const iso = (d) => d.toISOString().slice(0, 10);
const PERIODS = [
  { key: "3m", label: "3 mois", days: 92 },
  { key: "6m", label: "6 mois", days: 183 },
  { key: "12m", label: "12 mois", days: 366 },
];

/** Réservations d'un départ (ids fournis par le planning). */
async function loadReservations(ids) {
  if (!ids.length) return [];
  const res = await db.listAll(Collections.RESERVATIONS, [Query.equal("$id", ids)]);
  return res.documents;
}

function DepartureDetail({ dep }) {
  const { openReservation, openClient } = useDetailModal();
  const [reservations, setReservations] = useState(null);
  useEffect(() => {
    let alive = true;
    loadReservations(dep.reservationIds).then((r) => alive && setReservations(r));
    return () => {
      alive = false;
    };
  }, [dep.reservationIds]);

  // Planning Excel « Asfari Voyage » du départ : voyageurs, passeports,
  // rooming list et paiements (remplace les exports CSV).
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadPlanningExcel({ packageId: dep.packageId, start: dep.start });
    } catch (e) {
      alert(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!reservations) return <div style={{ padding: 16 }}><span className="res-spinner" /></div>;
  const incomplete = reservations.filter((r) => !travelersStatus(r).complete).length;

  return (
    <div style={{ padding: "12px 16px 18px", background: "#f8fafc" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13 }}>{reservations.length} dossier(s)</strong>
        {incomplete > 0 && <Badge cls="warn"><AlertTriangle size={11} /> {incomplete} dossier(s) avec voyageurs ou passeports incomplets</Badge>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="res-btn ghost small" disabled={!reservations.length || exporting} onClick={exportExcel} title="Voyageurs, passeports, rooming list et paiements du départ">
            <FileDown size={13} /> {exporting ? "Export…" : "Planning Excel"}
          </button>
        </span>
      </div>
      {reservations.length === 0 ? (
        <p className="ops-muted">Aucune réservation sur ce départ pour l'instant.</p>
      ) : (
        <table className="res-table">
          <thead><tr><th>Dossier</th><th>Client</th><th>Voyageurs</th><th>Statut</th><th>Total</th><th>Passeports</th></tr></thead>
          <tbody>
            {reservations.map((r) => {
              const t = travelersStatus(r);
              return (
                <tr key={r.$id} className="res-row is-clickable" onClick={() => openReservation(r.$id)}>
                  <td><button className="adm-link" onClick={(e) => { e.stopPropagation(); openReservation(r.$id); }}>{r.ref}</button></td>
                  <td><button className="adm-link" onClick={(e) => { e.stopPropagation(); openClient({ email: r.userEmail, name: r.userName }); }}>{r.userName || r.userEmail}</button></td>
                  <td>{r.totalPax}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{money(r.totalEstimate)}</td>
                  <td>{t.complete ? <Badge cls="ok">Complets</Badge> : <Badge cls="warn">{t.missing ? `${t.missing} à saisir` : `${t.issues.length} à vérifier`}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function PlanningPage() {
  const { openPackage } = useDetailModal();
  const [period, setPeriod] = useState("6m");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period).days;
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const to = new Date();
    to.setDate(to.getDate() + days);
    return { from: iso(from), to: iso(to) };
  }, [period]);

  const load = useCallback(() => {
    getPlanning(range.from, range.to).then((d) => {
      setError(null);
      setData(d);
    }).catch(setError);
  }, [range]);

  const exportAll = async () => {
    setExporting(true);
    try {
      await downloadPlanningExcel(range);
    } catch (e) {
      setError(e);
    } finally {
      setExporting(false);
    }
  };
  useEffect(load, [load]);

  const rows = useMemo(
    () => (data?.departures || []).filter((d) => d.packageStatus !== "draft" || d.dossiers > 0).filter((d) => !hideEmpty || d.dossiers > 0),
    [data, hideEmpty],
  );
  const today = iso(new Date());
  const totals = rows.reduce(
    (t, d) => ({ pax: t.pax + d.pax, revenue: t.revenue + d.revenue, remaining: t.remaining + d.remaining, overdue: t.overdue + d.overdue, margin: t.margin + d.margin }),
    { pax: 0, revenue: 0, remaining: 0, overdue: 0, margin: 0 },
  );

  return (
    <Page
      title="Planning des départs"
      subtitle="Remplissage, encaissements et marge par date de départ. Les places et suppléments se règlent dans l'éditeur de package (onglet Dates)."
      actions={
        <>
          <div className="res-filters">
            {PERIODS.map((p) => (
              <button key={p.key} className={`res-pill ${period === p.key ? "active" : ""}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <button className={`res-pill ${hideEmpty ? "active" : ""}`} onClick={() => setHideEmpty((v) => !v)}>Avec réservations</button>
          <button className="res-btn primary small" disabled={exporting} onClick={exportAll} title="Tous les dossiers de la période : voyageurs, passeports, hébergement, paiements">
            <FileDown size={13} /> {exporting ? "Export…" : "Planning Asfari Voyage (Excel)"}
          </button>
        </>
      }
    >
      <ErrorNote error={error} />
      <Kpis
        items={[
          { label: "Départs", value: rows.length, icon: Plane, color: "#2563eb", bg: "rgba(37,99,235,.1)" },
          { label: "Voyageurs vendus", value: totals.pax, icon: Users, color: "#7c3aed", bg: "rgba(124,58,237,.1)" },
          { label: "Chiffre d'affaires", value: money(totals.revenue), icon: TrendingUp },
          { label: "Reste à encaisser", value: money(totals.remaining), icon: Wallet, color: totals.overdue ? "#dc2626" : "#16a34a", bg: totals.overdue ? "rgba(220,38,38,.1)" : "rgba(22,163,74,.1)", sub: totals.overdue ? `dont ${money(totals.overdue)} en retard` : "" },
          { label: "Marge", value: money(totals.margin), icon: TrendingUp, color: "#0891b2", bg: "rgba(15,118,110,.1)" },
        ]}
      />
      <div className="res-table-wrap">
        {!data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon={CalendarDays} title="Aucun départ sur la période">Ajoutez des dates de départ dans l'éditeur de package.</Empty>
        ) : (
          <div className="res-table-scroll">
            <table className="res-table">
              <thead>
                <tr><th /><th>Départ</th><th>Voyage</th><th>Remplissage</th><th>Dossiers</th><th>CA</th><th>Encaissé</th><th>Reste</th><th>Marge</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const isOpen = open === d.key;
                  const past = d.start < today;
                  return [
                    <tr key={d.key} className="res-row" style={{ cursor: "pointer", opacity: past ? 0.6 : 1 }} onClick={() => setOpen(isOpen ? null : d.key)}>
                      <td>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                      <td>
                        <strong>{dateFr(d.start, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</strong>
                        <div className="ops-muted">→ {dateFr(d.end)}</div>
                      </td>
                      <td>
                        <div className="res-pkg-title">
                          {d.packageId ? (
                            <button className="adm-link" onClick={(e) => { e.stopPropagation(); openPackage(d.packageId); }}>{d.packageTitle}</button>
                          ) : d.packageTitle}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {d.guaranteed && <Badge cls="ok">Départ garanti</Badge>}
                          {d.closed && <Badge cls="danger">Fermé / complet</Badge>}
                          {d.packageStatus === "draft" && <Badge cls="muted">Brouillon</Badge>}
                          {d.supplement !== 0 && <Badge cls="info">{d.supplement > 0 ? "+" : ""}{money(d.supplement)} / pers.</Badge>}
                        </div>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{d.pax}{d.capacity ? ` / ${d.capacity}` : ""} <span className="ops-muted">voyageurs</span></div>
                        {d.capacity ? <FillBar value={d.pax} max={d.capacity} /> : <span className="ops-muted">places illimitées</span>}
                      </td>
                      <td>{d.dossiers}</td>
                      <td>{money(d.revenue)}</td>
                      <td>{money(d.paid)}</td>
                      <td>
                        {money(d.remaining)}
                        {d.overdue > 0 && <div><Badge cls="danger">{money(d.overdue)} en retard</Badge></div>}
                      </td>
                      <td style={{ color: d.margin < 0 ? "#dc2626" : "#0891b2", fontWeight: 700 }}>{money(d.margin)}</td>
                    </tr>,
                    isOpen && (
                      <tr key={`${d.key}-detail`}>
                        <td colSpan={9} style={{ padding: 0 }}><DepartureDetail dep={d} /></td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}
