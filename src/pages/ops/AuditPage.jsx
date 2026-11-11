import { useCallback, useEffect, useState } from "react";
import { useDetailModal } from "../../services/detailModal";
import { ScrollText } from "lucide-react";
import { listAudit } from "../../services/operations";
import { Badge, Empty, ErrorNote, Loading, Page } from "../../components/ops/OpsUI";

const PAGE = 50;
const ACTIONS = {
  create: ["ok", "Création"], update: ["info", "Modification"], delete: ["danger", "Suppression"],
  note: ["warn", "Note"], email: ["muted", "Email"], document: ["muted", "Document"],
};
const COLLECTIONS = {
  reservations: "Réservation", products: "Package / réglage", hotels: "Hôtel", clients: "Client", users: "Compte",
  email_templates: "Template email", destinations: "Destination", tours: "Circuit", adventures: "Aventure",
  team: "Équipe (site)", testimonials: "Avis", news: "Actualité",
};

const summarize = (e) => {
  if (e.message) return e.message;
  if (!e.changes || typeof e.changes !== "object") return "";
  return Object.entries(e.changes)
    .map(([k, v]) => (Array.isArray(v) && typeof v[1] !== "object" && String(v[1]).length < 60 ? `${k} : ${v[0] ?? "—"} → ${v[1] ?? "—"}` : k))
    .join(" · ");
};

// Collections qui ont une fiche dans la modale de détail.
const OPENABLE = { reservations: "openReservation", products: "openPackage", hotels: "openHotel" };

export default function AuditPage() {
  const detail = useDetailModal();
  const [collection, setCollection] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    listAudit({ collection, limit: PAGE, offset: page * PAGE }).then((d) => {
      setError(null);
      setData(d);
    }).catch(setError);
  }, [collection, page]);
  useEffect(load, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <Page title="Journal d'activité" subtitle="Qui a modifié quoi, et quand — réservations, paiements, catalogue, comptes, emails envoyés.">
      <ErrorNote error={error} />
      <div className="res-toolbar">
        <select className="res-select" value={collection} onChange={(e) => { setCollection(e.target.value); setPage(0); }}>
          <option value="">Toutes les données</option>
          {Object.entries(COLLECTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="res-table-wrap">
        {!data ? (
          <Loading />
        ) : data.entries.length === 0 ? (
          <Empty icon={ScrollText} title="Aucune activité enregistrée" />
        ) : (
          <>
            <div className="res-table-scroll">
              <table className="res-table">
                <thead><tr><th>Date</th><th>Par</th><th>Action</th><th>Élément</th><th>Détail</th></tr></thead>
                <tbody>
                  {data.entries.map((e) => {
                    const [cls, label] = ACTIONS[e.action] || ["muted", e.action];
                    return (
                      <tr key={e.id} className="res-row">
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{e.userName || <span className="ops-muted">système</span>}</td>
                        <td><Badge cls={cls}>{label}</Badge></td>
                        <td>
                          {COLLECTIONS[e.collection] || e.collection}
                          <div className="ops-muted">
                            {OPENABLE[e.collection] && e.action !== "delete"
                              ? <button className="adm-link" onClick={() => detail[OPENABLE[e.collection]](e.documentId)}>{e.documentId}</button>
                              : e.documentId}
                          </div>
                        </td>
                        <td style={{ fontSize: 12.5, maxWidth: 520 }}>{summarize(e)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="res-pagination">
              <span className="ops-muted">{data.total} entrée(s)</span>
              <div className="res-page-nav">
                <button className="res-page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
                <span className="ops-muted">page {page + 1} / {pages}</span>
                <button className="res-page-btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
