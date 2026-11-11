import { useEffect, useMemo, useState } from "react";
import { useDetailModal } from "../../services/detailModal";
import { CheckCircle, MailWarning, Send, ShoppingCart, UserX } from "lucide-react";
import db, { Collections, Query } from "../../services/database";
import { lookupUsers, sendAbandonFollowup } from "../../services/operations";
import { dateFr } from "../../services/opsFormat";
import { Badge, Empty, ErrorNote, Kpis, Loading, Page } from "../../components/ops/OpsUI";

const DAYS = 30;

/**
 * Réservations abandonnées (événement analytics « abandon » : formulaire de
 * réservation ouvert puis quitté). Un visiteur connecté peut être relancé
 * par email ; un anonyme compte seulement dans les statistiques.
 */
export default function FollowupsPage() {
  const { openPackage, openClient } = useDetailModal();
  const [events, setEvents] = useState(null);
  const [users, setUsers] = useState({});
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState(null);

  useEffect(() => {
    const since = new Date(Date.now() - DAYS * 864e5).toISOString();
    Promise.all([
      db.list(Collections.EVENTS, [Query.equal("event", "abandon"), Query.greaterThanEqual("createdAt", since), Query.orderDesc("createdAt"), Query.limit(2000)]),
      db.listAll(Collections.RESERVATIONS, [Query.greaterThanEqual("$createdAt", since)]),
    ])
      .then(async ([ev, res]) => {
        setEvents(ev.documents);
        setBookings(res.documents);
        const ids = [...new Set(ev.documents.map((e) => e.userId).filter(Boolean))];
        if (ids.length) {
          const found = await lookupUsers(ids);
          setUsers(Object.fromEntries(found.users.map((u) => [u.$id, u])));
        }
      })
      .catch(setError);
  }, []);

  // Un abandon par (visiteur, package), le plus récent ; « a réservé » si une
  // réservation du même compte sur le même package a suivi.
  const rows = useMemo(() => {
    if (!events) return [];
    const map = new Map();
    for (const e of events) {
      const who = e.userId || `session:${e.sessionId}`;
      const key = `${who}|${e.targetId}`;
      if (!map.has(key)) map.set(key, { ...e, who, count: 0 });
      map.get(key).count += 1;
    }
    return [...map.values()].map((r) => ({
      ...r,
      user: r.userId ? users[r.userId] : null,
      booked: bookings.some((b) => b.userId === r.userId && b.packageId === r.targetId && (b.$createdAt || "") >= (r.createdAt || "")),
    }));
  }, [events, users, bookings]);

  const identified = rows.filter((r) => r.user);
  const recovered = rows.filter((r) => r.booked).length;

  const relaunch = async (r) => {
    setSending(r.who + r.targetId);
    try {
      await sendAbandonFollowup(r.userId, r.targetId);
      setSent((s) => ({ ...s, [r.who + r.targetId]: "ok" }));
    } catch (e) {
      setSent((s) => ({ ...s, [r.who + r.targetId]: e.message || "Échec" }));
    } finally {
      setSending(null);
    }
  };

  return (
    <Page
      title="Relances — réservations non finalisées"
      subtitle={`Visiteurs qui ont ouvert le formulaire de réservation sans l'envoyer, sur les ${DAYS} derniers jours. Template : Paramètres → Notifications → « Réservation non finalisée ».`}
    >
      <ErrorNote error={error} />
      <Kpis
        items={[
          { label: "Abandons", value: rows.length, icon: ShoppingCart, color: "#d97706", bg: "rgba(217,119,6,.1)" },
          { label: "Clients identifiés", value: identified.length, icon: MailWarning, sub: "relançables par email" },
          { label: "Anonymes", value: rows.length - identified.length, icon: UserX, color: "#64748b", bg: "#f1f5f9" },
          { label: "Ont réservé ensuite", value: recovered, icon: CheckCircle, color: "#16a34a", bg: "rgba(22,163,74,.1)" },
        ]}
      />
      <div className="res-table-wrap">
        {!events ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon={ShoppingCart} title="Aucune réservation abandonnée sur la période" />
        ) : (
          <div className="res-table-scroll">
            <table className="res-table">
              <thead><tr><th>Date</th><th>Visiteur</th><th>Voyage</th><th>Tentatives</th><th>Suite</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const k = r.who + r.targetId;
                  return (
                    <tr key={k} className="res-row">
                      <td>{dateFr(r.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        {r.user ? (
                          <><button className="adm-link res-client-name" onClick={() => openClient({ email: r.user.email, name: r.user.name })}>{r.user.name || r.user.email}</button><div className="res-client-email">{r.user.email}</div></>
                        ) : (
                          <span className="ops-muted">Visiteur anonyme · {r.device || "?"}</span>
                        )}
                      </td>
                      <td>
                        {r.targetId ? <button className="adm-link" onClick={() => openPackage(r.targetId)}>{r.label || r.targetId}</button> : r.label}
                      </td>
                      <td>{r.count}</td>
                      <td>{r.booked ? <Badge cls="ok">A réservé</Badge> : <Badge cls="warn">Pas de réservation</Badge>}</td>
                      <td style={{ textAlign: "right" }}>
                        {r.user && !r.booked && (
                          sent[k] === "ok" ? <Badge cls="ok">Relancé ✓</Badge> : (
                            <>
                              {sent[k] && <div className="ops-muted" style={{ color: "#dc2626", maxWidth: 260 }}>{sent[k]}</div>}
                              <button className="res-btn ghost small" disabled={sending === k} onClick={() => relaunch(r)}><Send size={13} /> Relancer</button>
                            </>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}
