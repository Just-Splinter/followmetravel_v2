// Fiches de synthèse affichées dans la modale de détail commune : package,
// hôtel, client. La réservation, elle, réutilise le détail complet de la
// page Réservations (DetailDrawer).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, CalendarDays, ExternalLink, Hotel, Mail, MapPin, Package, Phone, Users } from "lucide-react";
import db, { Collections, Query } from "../../services/database";
import { getAvailability } from "../../services/operations";
import { hotelUsage } from "../../services/hotelUsage";
import { parseHotelRoomTypes } from "../../context/HotelsContext";
import { dateFr, money } from "../../services/opsFormat";
import { Badge, StatusBadge } from "../ops/OpsUI";
import { packagePath } from "../../marketing/seo";

const parse = (raw, fallback = {}) => {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw ?? fallback;
  } catch {
    return fallback;
  }
};

function Facts({ items }) {
  return (
    <dl className="qv-facts">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>
      ))}
    </dl>
  );
}

function useDoc(collection, id) {
  const [state, setState] = useState({ doc: null, error: null });
  useEffect(() => {
    let alive = true;
    db.get(collection, id)
      .then((doc) => alive && setState({ doc, error: null }))
      .catch((error) => alive && setState({ doc: null, error }));
    return () => {
      alive = false;
    };
  }, [collection, id]);
  return state;
}

const Loading = () => <div className="res-empty"><span className="res-spinner" /></div>;
const Failed = ({ error }) => <div className="ops-alert danger">{error?.message || "Introuvable."}</div>;

// ── Package ────────────────────────────────────────────────────────
export function PackageQuickView({ id, onClose }) {
  const navigate = useNavigate();
  const { doc, error } = useDoc(Collections.PRODUCTS, id);
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    getAvailability(id).then((a) => setAvailability(a.departures)).catch(() => setAvailability([]));
  }, [id]);
  if (error) return <Failed error={error} />;
  if (!doc) return <Loading />;
  const blob = parse(doc.data);
  const categories = blob.hotelCategories || [];

  return (
    <div className="qv">
      <div className="qv-head">
        {blob.heroBg && <img src={blob.heroBg} alt="" className="qv-cover" />}
        <div>
          <h2>{doc.title}</h2>
          <p className="ops-muted">{[blob.durationLabel, doc.country, doc.continent].filter(Boolean).join(" · ")}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Badge cls={["active", "published"].includes(doc.status) ? "ok" : "muted"}>{doc.status}</Badge>
            {doc.publishAt && <Badge cls="info">En ligne le {dateFr(doc.publishAt)}</Badge>}
            {doc.unpublishAt && <Badge cls="warn">Retiré le {dateFr(doc.unpublishAt)}</Badge>}
          </div>
        </div>
      </div>
      <Facts items={[["Prix à partir de", money(doc.basePrice)], ["Formules", categories.map((c) => c.label).join(", ") || "Prix par personne"], ["Départs", (blob.departureDates || []).length]]} />

      <h4 className="qv-h"><CalendarDays size={14} /> Départs</h4>
      {!availability ? <Loading /> : availability.length === 0 ? <p className="ops-muted">Aucune date de départ.</p> : (
        <table className="res-table">
          <thead><tr><th>Départ</th><th>Supplément</th><th>Places</th><th>État</th></tr></thead>
          <tbody>
            {availability.map((d) => (
              <tr key={`${d.from}-${d.to}`}>
                <td><strong>{dateFr(d.start)}</strong> → {dateFr(d.end)}</td>
                <td>{d.supplement ? `${d.supplement > 0 ? "+" : ""}${money(d.supplement)}` : "—"}</td>
                <td>{d.booked}{d.capacity ? ` / ${d.capacity}` : ""}</td>
                <td>{d.closed ? <Badge cls="danger">Complet / fermé</Badge> : d.guaranteed ? <Badge cls="ok">Garanti</Badge> : <Badge cls="muted">Ouvert</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {categories.length > 0 && (
        <>
          <h4 className="qv-h"><Hotel size={14} /> Hôtels par formule</h4>
          {categories.map((c) => (
            <p key={c.id ?? c.label} className="qv-line"><strong>{c.label}</strong> : {(c.hotels || []).map((h) => h.name).filter(Boolean).join(", ") || "—"}</p>
          ))}
        </>
      )}

      <div className="qv-actions">
        <a className="res-btn" href={packagePath(doc.$id, doc.title)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Voir sur le site</a>
        <button className="res-btn primary" onClick={() => { onClose(); navigate("/dashboard/packages"); }}><Package size={14} /> Gérer dans Packages</button>
      </div>
    </div>
  );
}

// ── Hôtel ──────────────────────────────────────────────────────────
export function HotelQuickView({ id, onClose }) {
  const navigate = useNavigate();
  const { doc, error } = useDoc(Collections.HOTELS, id);
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    db.listAll(Collections.PRODUCTS).then((r) => setUsage(hotelUsage(r.documents)[id] || [])).catch(() => setUsage([]));
  }, [id]);
  if (error) return <Failed error={error} />;
  if (!doc) return <Loading />;
  const rooms = parseHotelRoomTypes(doc.rooms);
  return (
    <div className="qv">
      <div className="qv-head">
        {doc.image && <img src={doc.image} alt="" className="qv-cover" />}
        <div>
          <h2>{doc.name}</h2>
          <p className="ops-muted"><MapPin size={12} /> {[doc.city, doc.address].filter(Boolean).join(" · ")}</p>
          <p style={{ color: "#fbbf24", margin: "4px 0 0" }}>{"★".repeat(Number(doc.stars) || 0)}</p>
        </div>
      </div>
      <h4 className="qv-h"><BedDouble size={14} /> Types de chambre (tarifs catalogue)</h4>
      {rooms.length === 0 ? <p className="ops-muted">Aucun type de chambre.</p> : (
        <Facts items={rooms.map((r) => [r.type, money(r.price)])} />
      )}
      <h4 className="qv-h"><Package size={14} /> Utilisé dans</h4>
      {!usage ? <Loading /> : usage.length === 0 ? <p className="ops-muted">Aucun package.</p> : usage.map((u) => (
        <p key={u.packageId} className="qv-line"><strong>{u.title}</strong> <span className="ops-muted">{u.formules.join(", ")}</span></p>
      ))}
      <div className="qv-actions">
        <button className="res-btn primary" onClick={() => { onClose(); navigate("/dashboard/hotel"); }}><Hotel size={14} /> Gérer dans Hôtels</button>
      </div>
    </div>
  );
}

// ── Client ─────────────────────────────────────────────────────────
export function ClientQuickView({ email, name, onOpenReservation, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!email) return;
    Promise.all([
      db.list(Collections.CLIENTS, [Query.equal("email", email), Query.limit(1)]),
      db.listAll(Collections.RESERVATIONS, [Query.equal("userEmail", email), Query.orderDesc("$createdAt")]),
    ])
      .then(([c, r]) => setData({ client: c.documents[0] || null, reservations: r.documents }))
      .catch(setError);
  }, [email]);
  if (error) return <Failed error={error} />;
  // Sans email (client saisi par téléphone), pas de recherche : fiche vide.
  const loaded = email ? data : { client: null, reservations: [] };
  if (!loaded) return <Loading />;
  const { client, reservations } = loaded;
  const lead = parse(reservations[0]?.participants, []).find((p) => p?.phone) || {};
  const total = reservations.filter((r) => r.status !== "cancelled").reduce((s, r) => s + (Number(r.totalEstimate) || 0), 0);
  return (
    <div className="qv">
      <div className="qv-head">
        <div className="qv-avatar"><Users size={22} /></div>
        <div>
          <h2>{client?.name || name || reservations[0]?.userName || email}</h2>
          <p className="ops-muted">
            {email && <><Mail size={12} /> <a href={`mailto:${email}`}>{email}</a></>}
            {(client?.phone || lead.phone) && <> · <Phone size={12} /> <a href={`tel:${client?.phone || lead.phone}`}>{client?.phone || lead.phone}</a></>}
          </p>
        </div>
      </div>
      <Facts items={[["Réservations", reservations.length], ["Montant total", money(total)], client?.source && ["Origine", client.source]]} />
      {client?.notes && <><h4 className="qv-h">Notes</h4><p className="qv-line" style={{ whiteSpace: "pre-wrap" }}>{client.notes}</p></>}
      <h4 className="qv-h">Réservations</h4>
      {reservations.length === 0 ? <p className="ops-muted">Aucune réservation.</p> : (
        <table className="res-table">
          <thead><tr><th>Dossier</th><th>Voyage</th><th>Départ</th><th>Statut</th><th>Total</th></tr></thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.$id} className="is-clickable" onClick={() => onOpenReservation(r.$id)}>
                <td><button className="adm-link" onClick={(e) => { e.stopPropagation(); onOpenReservation(r.$id); }}>{r.ref}</button></td>
                <td>{r.packageTitle}</td>
                <td>{dateFr(r.travelStart) !== "—" ? dateFr(r.travelStart) : r.dateFrom}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{money(r.totalEstimate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="qv-actions">
        <button className="res-btn primary" onClick={() => { onClose(); navigate("/dashboard/clients"); }}><Users size={14} /> Ouvrir dans Clients</button>
      </div>
    </div>
  );
}
