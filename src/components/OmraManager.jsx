import { useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import {
  parseOmra,
  omraDocumentAttrs,
  emptyOmra,
  exampleOmra,
} from "../services/omra";

/* ─── Field helpers (CMS look) ───────────────────────────────────────────── */
const L = ({ children }) => (
  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "10px 0 4px" }}>
    {children}
  </label>
);
const inputStyle = {
  width: "100%", padding: "9px 11px", border: "1px solid #e2e8f0",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff",
};

function OmraModal({ pkg, onSave, onClose }) {
  const [form, setForm] = useState(() => pkg || emptyOmra(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setHotel = (which, k, v) =>
    setForm((f) => ({ ...f, [which]: { ...(f[which] || {}), [k]: v } }));
  const setDate = (i, k, v) =>
    setForm((f) => ({ ...f, dates: f.dates.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));
  const setPrice = (i, v) =>
    setForm((f) => ({ ...f, pricing: f.pricing.map((p, j) => (j === i ? { ...p, price: v } : p)) }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="em-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="em-modal" style={{ maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div className="em-modal-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 0" }}>
          <b style={{ fontSize: 16 }}>{pkg ? "Modifier le forfait Omra" : "Nouveau forfait Omra"}</b>
          <button className="cms-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <div>
              <L>Titre</L>
              <input style={inputStyle} value={form.title || ""} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <L>Titre (arabe)</L>
              <input style={{ ...inputStyle, direction: "rtl" }} value={form.titleAr || ""} onChange={(e) => set("titleAr", e.target.value)} />
            </div>
            <div>
              <L>Année</L>
              <input style={inputStyle} type="number" value={form.year || ""} onChange={(e) => set("year", Number(e.target.value))} />
            </div>
            <div>
              <L>Statut</L>
              <select style={inputStyle} value={form.status || "published"} onChange={(e) => set("status", e.target.value)}>
                <option value="published">published</option>
                <option value="draft">draft</option>
              </select>
            </div>
            <div>
              <L>Ville de départ</L>
              <input style={inputStyle} value={form.departureCity || ""} onChange={(e) => set("departureCity", e.target.value)} />
            </div>
            <div>
              <L>Durée (ex. 12 jours / 11 nuits)</L>
              <input style={inputStyle} value={form.duration || ""} onChange={(e) => set("duration", e.target.value)} />
            </div>
            <div>
              <L>Nuits à Makkah</L>
              <input style={inputStyle} type="number" value={form.nightsMakkah ?? ""} onChange={(e) => set("nightsMakkah", Number(e.target.value))} />
            </div>
            <div>
              <L>Nuits à Madinah</L>
              <input style={inputStyle} type="number" value={form.nightsMadinah ?? ""} onChange={(e) => set("nightsMadinah", Number(e.target.value))} />
            </div>
          </div>

          <L>Dates de départ (JJ/MM → JJ/MM, libellé optionnel)</L>
          {(form.dates || []).map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr auto", gap: 8, marginBottom: 6 }}>
              <input style={inputStyle} placeholder="10/03" value={d.from} onChange={(e) => setDate(i, "from", e.target.value)} />
              <input style={inputStyle} placeholder="22/03" value={d.to} onChange={(e) => setDate(i, "to", e.target.value)} />
              <input style={inputStyle} placeholder="Libellé (ex. Ramadan)" value={d.label || ""} onChange={(e) => setDate(i, "label", e.target.value)} />
              <button className="cms-icon-btn danger" onClick={() => set("dates", form.dates.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="em-btn-secondary" style={{ marginTop: 2 }} onClick={() => set("dates", [...(form.dates || []), { from: "", to: "", label: "" }])}>
            + Ajouter une date
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginTop: 8 }}>
            {["makkahHotel", "madinahHotel"].map((which) => (
              <div key={which}>
                <L>{which === "makkahHotel" ? "Hôtel Makkah" : "Hôtel Madinah"}</L>
                <input style={inputStyle} placeholder="Nom" value={form[which]?.name || ""} onChange={(e) => setHotel(which, "name", e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 8, marginTop: 6 }}>
                  <input style={inputStyle} type="number" min={1} max={5} placeholder="Étoiles" value={form[which]?.stars ?? ""} onChange={(e) => setHotel(which, "stars", Number(e.target.value))} />
                  <input style={inputStyle} placeholder="Distance (ex. 150 m du Haram)" value={form[which]?.distance || ""} onChange={(e) => setHotel(which, "distance", e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <L>Tarifs par personne (DH)</L>
          {(form.pricing || []).map((p, i) => (
            <div key={p.key || i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{p.label} <span style={{ color: "#94a3b8" }}>({p.labelAr})</span></span>
              <input style={inputStyle} type="number" placeholder="0" value={p.price} onChange={(e) => setPrice(i, e.target.value)} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>Enfant (optionnel)</span>
            <input style={inputStyle} type="number" placeholder="0" value={form.childPrice || ""} onChange={(e) => set("childPrice", e.target.value)} />
          </div>

          <L>Inclus (une ligne par élément)</L>
          <textarea
            style={{ ...inputStyle, minHeight: 110 }}
            value={(form.includes || []).join("\n")}
            onChange={(e) => set("includes", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          />

          {err && <p className="cms-status-bar error" style={{ marginTop: 12 }}>⚠ {err}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="em-btn-secondary" onClick={onClose}>Annuler</button>
            <button className="em-primary-btn" onClick={save} disabled={saving}>
              {saving ? "⏳ Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Manager ────────────────────────────────────────────────────────────── */
export default function OmraManager() {
  const { packages, packageActions } = useTravelData();
  const list = useMemo(
    () =>
      (packages || [])
        .map((doc) => {
          const o = parseOmra(doc);
          return o ? { ...o, __doc: doc } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [packages]
  );
  const [editing, setEditing] = useState(null); // null | "new" | pkg
  const [deleting, setDeleting] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const save = async (form) => {
    if (editing !== "new" && editing?.$id) {
      await packageActions.update(editing.$id, omraDocumentAttrs(form));
    } else {
      await packageActions.create(omraDocumentAttrs(form));
    }
  };

  const seedExample = async () => {
    setSeeding(true);
    try {
      await packageActions.create(omraDocumentAttrs(exampleOmra()));
    } finally {
      setSeeding(false);
    }
  };

  const remove = async () => {
    await packageActions.remove(deleting);
    setDeleting(null);
  };

  return (
    <div className="cms-table-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Forfaits Omra (page /omra)</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
            Stockés dans la collection <code>products</code> (kind: omra) — tarifs par personne selon l'occupation de la chambre.
          </div>
        </div>
        {list.length === 0 && (
          <button className="em-btn-secondary" onClick={seedExample} disabled={seeding}>
            {seeding ? "⏳…" : "⇪ Créer un exemple"}
          </button>
        )}
        <button className="em-primary-btn" onClick={() => setEditing("new")}>+ Ajouter un forfait</button>
      </div>

      {list.length === 0 ? (
        <div className="em-empty">
          <div className="em-empty-icon">🕋</div>
          <p className="em-empty-title">Aucun forfait Omra — créez-en un ou partez de l'exemple.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {list.map((o) => (
            <div
              key={o.$id}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600 }}>{o.title} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {o.year}</span></div>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                  {(o.dates || []).filter((d) => d.from).map((d) => `${d.from}→${d.to}`).join(" · ") || "Aucune date"}
                  {" — "}
                  {(o.pricing || []).filter((p) => Number(p.price) > 0).map((p) => `${p.label.split(" ").pop()}: ${p.price} DH`).join(" · ") || "Aucun tarif"}
                </div>
              </div>
              <span
                className="cms-badge"
                style={o.status === "draft"
                  ? { background: "rgba(255,117,14,0.1)", color: "#c4733a" }
                  : { background: "#f0fdf4", color: "#15803d" }}
              >
                {o.status}
              </span>
              <div className="cms-actions">
                <button className="cms-icon-btn" onClick={() => setEditing(o)}>✎</button>
                <button className="cms-icon-btn danger" onClick={() => setDeleting(o.$id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <OmraModal
          pkg={editing === "new" ? null : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <div className="em-modal-backdrop" style={{ alignItems: "center" }} onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="em-confirm">
            <div className="em-confirm-icon">🗑️</div>
            <div className="em-confirm-title">Supprimer ce forfait Omra ?</div>
            <p className="em-confirm-text">Le forfait sera retiré de la page Omra. Les réservations existantes ne sont pas affectées.</p>
            <div className="em-confirm-actions">
              <button className="em-btn-secondary" onClick={() => setDeleting(null)}>Annuler</button>
              <button className="em-btn-danger" onClick={remove}>✕ Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
