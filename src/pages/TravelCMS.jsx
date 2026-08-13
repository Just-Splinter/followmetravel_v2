import { useState, useEffect } from "react";
import { useTravelData } from "../context/TravelDataContext";
import HeroSlidesManager from "../components/HeroSlidesManager";
import OmraManager from "../components/OmraManager";
import ContactImagesManager from "../components/ContactImagesManager";
import { parseHeroSlide } from "../services/heroSlides";
import { parseOmra } from "../services/omra";
import "../styles/Analyticsdashboard.css";
import "../styles/TravelCMS.css";

// ─── Schemas (unchanged logic, same as before) ──────────────────────────────
const SCHEMAS = {
  hero: {
    label: "Hero slide", icon: "🎬", custom: true, dataKey: "packages",
    countOf: (docs) => (docs || []).filter((d) => parseHeroSlide(d)).length,
  },
  omra: {
    label: "Omra", icon: "🕋", custom: true, dataKey: "packages",
    countOf: (docs) => (docs || []).filter((d) => parseOmra(d)).length,
  },
  contact: {
    label: "Contact", icon: "📍", custom: true, dataKey: "packages",
    countOf: () => 3,
  },
  destinations: {
    label: "Destination", actionsKey: "destinationActions", dataKey: "destinations",
    icon: "🗺️",
    fields: [
      { key: "emoji", label: "Image URL", type: "url" },
      { key: "name", label: "Name", type: "text" },
      { key: "listing", label: "Listing count", type: "text" },
      { key: "rating", label: "Rating", type: "text" },
      { key: "gradient", label: "Gradient CSS", type: "text" },
      { key: "status", label: "Status", type: "select", opts: ["published", "draft"] },
    ],
    cols: ["name", "listing", "rating", "status"], nameKey: "name",
  },
  tours: {
    label: "Tour", actionsKey: "tourActions", dataKey: "tours",
    icon: "✈️",
    fields: [
      { key: "emoji", label: "Image URL", type: "url" },
      { key: "name", label: "Name", type: "text" },
      { key: "loc", label: "Location", type: "text" },
      { key: "nights", label: "Duration", type: "text" },
      { key: "price", label: "Price", type: "text" },
      { key: "offer", label: "Offer", type: "text" },
      { key: "status", label: "Status", type: "select", opts: ["published", "draft"] },
    ],
    cols: ["name", "loc", "nights", "price", "status"], nameKey: "name",
  },
  adventures: {
    label: "Adventure", actionsKey: "adventureActions", dataKey: "adventures",
    icon: "🏔️",
    fields: [
      { key: "emoji", label: "Image URL", type: "url" },
      { key: "name", label: "Title", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "gradient", label: "Gradient", type: "text" },
      { key: "status", label: "Status", type: "select", opts: ["published", "draft"] },
    ],
    cols: ["name", "category", "status"], nameKey: "name",
  },
  team: {
    label: "Team member", actionsKey: "teamActions", dataKey: "team",
    icon: "👤",
    fields: [
      { key: "emoji", label: "Photo URL", type: "url" },
      { key: "name", label: "Full name", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "status", label: "Status", type: "select", opts: ["active", "inactive"] },
    ],
    cols: ["name", "role", "email", "status"], nameKey: "name",
  },
  testimonials: {
    label: "Testimonial", actionsKey: "testimonialActions", dataKey: "testimonials",
    icon: "💬",
    fields: [
      { key: "emoji", label: "Avatar URL", type: "url" },
      { key: "name", label: "Name", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "text", label: "Review", type: "textarea" },
      { key: "rating", label: "Rating 1-5", type: "text" },
      { key: "status", label: "Status", type: "select", opts: ["published", "draft"] },
    ],
    cols: ["name", "role", "rating", "status"], nameKey: "name",
  }
};

const BADGE_COLORS = {
  published: { bg: "#f0fdf4", color: "#15803d" },
  active: { bg: "#f0fdf4", color: "#15803d" },
  draft: { bg: "rgba(255,117,14,0.1)", color: "#c4733a" },
  inactive: { bg: "#fef2f2", color: "#dc2626" },
};

const PAGE_SIZE = 8;

// ─── FormModal ───────────────────────────────────────────────────────────────
function FormModal({ schema, record, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const init = {};
    schema.fields.forEach((f) => { init[f.key] = record?.[f.key] ?? ""; });
    return init;
  });
  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="em-modal-backdrop" style={{ alignItems: "center" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="em-modal" style={{ maxWidth: 520 }}>
        <div className="em-modal-header">
          <span className="cms-modal-title" style={{ flex: 1 }}>
            {record ? "Edit" : "Add"} {schema.label.toLowerCase()}
          </span>
          <button className="em-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="em-modal-body">
          {schema.fields.map((f) => (
            <div key={f.key} className="em-field">
              <label className="em-field-label" htmlFor={`f_${f.key}`}>{f.label}</label>
              {f.type === "select" ? (
                <select
                  id={`f_${f.key}`}
                  className="em-select"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  {f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={`f_${f.key}`}
                  className="em-textarea"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={`f_${f.key}`}
                  type={f.type}
                  className="em-input"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="cms-modal-footer">
          <button className="em-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="em-primary-btn" onClick={() => onSave(form)}>✓ Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteModal ─────────────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onClose }) {
  return (
    <div className="em-modal-backdrop" style={{ alignItems: "center" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="em-confirm">
        <div className="em-confirm-icon">🗑️</div>
        <div className="em-confirm-title">Delete this record?</div>
        <p className="em-confirm-text">
          This action cannot be undone. The record will be permanently removed from the database.
        </p>
        <div className="em-confirm-actions">
          <button className="em-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="em-btn-danger" onClick={onConfirm}>✕ Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TravelCMS component ─────────────────────────────────────────────────
export default function TravelCMS() {
  const ctx = useTravelData();
  const [col, setCol] = useState("destinations");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [formRecord, setForm] = useState(null);
  const [delId, setDelId] = useState(null);
  const [creating, setCreating] = useState(false);

  const schema = SCHEMAS[col];
  const data = ctx[schema.dataKey] ?? [];
  const actions = ctx[schema.actionsKey];

  const filtered = data.filter((r) =>
    (r[schema.nameKey] ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [col, search]);

  const handleSave = async (form) => {
    if (creating) await actions.create(form);
    else await actions.update(formRecord.$id, form);
    setForm(null);
  };

  const handleDelete = async () => {
    await actions.remove(delId);
    setDelId(null);
  };

  const openCreate = () => { setCreating(true); setForm({}); };
  const openEdit = (r) => { setCreating(false); setForm(r); };

  return (
    <div className="cms-root">

      <div className="em-header">
        <div className="cms-header-inner">
          <div>
            <h1 className="cms-title">Contenu du site</h1>
            <p className="cms-subtitle">Hero, destinations, voyages, équipe et avis affichés sur le site public</p>
          </div>
          {!schema.custom && (
            <button className="em-primary-btn" onClick={openCreate}>
              + Add {schema.label.toLowerCase()}
            </button>
          )}
        </div>

        <div className="em-categories">
          {Object.entries(SCHEMAS).map(([key, s]) => {
            const active = col === key;
            return (
              <button
                key={key}
                className={`em-category-tab ${active ? "active" : ""}`}
                onClick={() => { setCol(key); setSearch(""); }}
              >
                <span>{s.icon}</span>
                <span>{s.label}s</span>
                <span className="em-category-count">
                  {s.countOf ? s.countOf(ctx[s.dataKey]) : (ctx[s.dataKey] ?? []).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status messages */}
      {ctx.loading && <p className="cms-status-bar loading">⏳ Loading…</p>}
      {ctx.error && <p className="cms-status-bar error">⚠ {ctx.error.message}</p>}

      <div className="em-main">
        {schema.custom ? (
          col === "omra" ? <OmraManager /> : col === "contact" ? <ContactImagesManager /> : <HeroSlidesManager />
        ) : (
        <div className="cms-table-card">

          <div className="cms-table-head">
            <div className="em-search-wrap" style={{ maxWidth: 280 }}>
              <div className="em-search">
                <span style={{ fontSize: 14, color: "#94a3b8" }}>🔍</span>
                <input
                  placeholder={`Search ${schema.label.toLowerCase()}s…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {slice.length === 0 ? (
            <div className="em-empty">
              <div className="em-empty-icon">📭</div>
              <p className="em-empty-title">No {schema.label.toLowerCase()}s found</p>
            </div>
          ) : (
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th className="cms-th" style={{ width: 52 }}></th>
                    <th className="cms-th">{schema.label}</th>
                    {schema.cols.slice(1).map((c) => (
                      <th key={c} className="cms-th">{c}</th>
                    ))}
                    <th className="cms-th" style={{ width: 90, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r) => {
                    const nk = schema.nameKey;
                    return (
                      <tr key={r.$id} className="cms-row">
                        <td className="cms-td" style={{ paddingRight: 8 }}>
                          {r.emoji
                            ? <img src={r.emoji} className="cms-thumb" alt="" onError={(e) => { e.target.style.display = "none"; }} />
                            : <div className="cms-thumb-empty">📷</div>}
                        </td>

                        <td className="cms-td">
                          <span className="cms-name">{r[nk] || "—"}</span>
                        </td>

                        {schema.cols.slice(1).map((c) => (
                          <td key={c} className={c === "status" ? "cms-td" : "cms-td cms-td-muted"}>
                            {c === "status"
                              ? <span className="cms-badge" style={BADGE_COLORS[r[c]] || { background: "rgba(0,0,0,0.05)", color: "#64748b" }}>{r[c] || "—"}</span>
                              : r[c] || "—"}
                          </td>
                        ))}

                        <td className="cms-td" style={{ textAlign: "right" }}>
                          <div className="cms-actions">
                            <button className="cms-icon-btn" onClick={() => openEdit(r)}>✎</button>
                            <button className="cms-icon-btn danger" onClick={() => setDelId(r.$id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="cms-pagination">
              <span className="cms-pagination-info">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`cms-page-btn ${p === page ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {formRecord !== null && (
        <FormModal
          schema={schema}
          record={creating ? null : formRecord}
          onSave={handleSave}
          onClose={() => setForm(null)}
        />
      )}
      {delId && (
        <DeleteModal
          onConfirm={handleDelete}
          onClose={() => setDelId(null)}
        />
      )}
    </div>
  );
}
