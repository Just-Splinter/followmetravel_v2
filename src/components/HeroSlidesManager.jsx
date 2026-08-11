import { useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import storage from "../services/storage";
import {
  DEFAULT_HERO_SLIDES,
  HERO_KIND,
  parseHeroSlide,
  heroSlideDocumentAttrs,
  slideBg,
  slideCard,
} from "../services/heroSlides";

// Downscale an image blob on a canvas and re-encode as webp before upload —
// the source photos are 4K+ originals, far larger than the hero needs.
async function downscaleToWebp(blob, maxW, quality) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const out = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
  if (!out) throw new Error("Encodage webp impossible");
  return out;
}

async function uploadImage(blob, filename, maxW, quality) {
  const webp = await downscaleToWebp(blob, maxW, quality);
  const file = new File([webp], filename.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  const res = await storage.upload(file);
  return { fileId: res.$id, url: String(storage.getView(res.$id)) };
}

const isAuthError = (e) =>
  e?.cause?.code === 401 || /not authorized|missing.*permission/i.test(e?.message || "");

const AUTH_HINT =
  "Écriture refusée par Appwrite : connectez-vous au dashboard (compte admin) puis réessayez.";

// ─── Slide form modal ────────────────────────────────────────────────────────
function SlideModal({ slide, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: slide?.name ?? "",
    cardLabel: slide?.cardLabel ?? "",
    description: slide?.description ?? "",
    dots: slide?.dots ?? 4,
    order: slide?.order ?? 1,
    status: slide?.status ?? "published",
    bgFileId: slide?.bgFileId ?? null,
    bgUrl: slide?.bgUrl ?? slide?.bg ?? null,
    cardFileId: slide?.cardFileId ?? null,
    cardUrl: slide?.cardUrl ?? slide?.card ?? null,
  }));
  const [busy, setBusy] = useState(null); // "bg" | "card" | "save"
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pickImage = (kind) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(kind);
    setError(null);
    const maxW = kind === "bg" ? 2560 : 1000;
    uploadImage(file, file.name, maxW, kind === "bg" ? 0.82 : 0.85)
      .then(({ fileId, url }) => {
        if (kind === "bg") setForm((p) => ({ ...p, bgFileId: fileId, bgUrl: url }));
        else setForm((p) => ({ ...p, cardFileId: fileId, cardUrl: url }));
      })
      .catch((err) => setError(isAuthError(err) ? AUTH_HINT : err.message))
      .finally(() => setBusy(null));
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Le nom est requis."); return; }
    setBusy("save");
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(isAuthError(err) ? AUTH_HINT : err.message);
    } finally {
      setBusy(null);
    }
  };

  const ImgPicker = ({ kind, url, label }) => (
    <div className="em-field" style={{ flex: 1 }}>
      <label className="em-field-label">{label}</label>
      <label
        style={{
          display: "block", height: 110, borderRadius: 10, overflow: "hidden",
          border: "1.5px dashed #cbd5e1", cursor: "pointer", position: "relative",
          background: "#f8fafc",
        }}
      >
        {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <span
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, fontWeight: 600,
            color: url ? "#fff" : "#64748b",
            background: url ? "rgba(15,23,42,0.35)" : "transparent",
          }}
        >
          {busy === kind ? "Envoi…" : url ? "Remplacer" : "Choisir une image"}
        </span>
        <input type="file" accept="image/*" hidden onChange={pickImage(kind)} />
      </label>
    </div>
  );

  return (
    <div className="em-modal-backdrop" style={{ alignItems: "center" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="em-modal" style={{ maxWidth: 640 }}>
        <div className="em-modal-header">
          <span className="cms-modal-title" style={{ flex: 1 }}>
            {slide?.$id ? "Modifier" : "Ajouter"} un slide hero
          </span>
          <button className="em-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="em-modal-body">
          <div style={{ display: "flex", gap: 12 }}>
            <div className="em-field" style={{ flex: 1 }}>
              <label className="em-field-label">Destination (titre)</label>
              <input className="em-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Thailand" />
            </div>
            <div className="em-field" style={{ flex: 1 }}>
              <label className="em-field-label">Libellé de la carte</label>
              <input className="em-input" value={form.cardLabel} onChange={(e) => set("cardLabel", e.target.value)} placeholder="Buddha temple, Thailand" />
            </div>
          </div>

          <div className="em-field">
            <label className="em-field-label">Description</label>
            <textarea className="em-textarea" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <ImgPicker kind="bg" url={form.bgUrl} label="Image de fond (paysage)" />
            <ImgPicker kind="card" url={form.cardUrl} label="Image de la carte (portrait)" />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div className="em-field" style={{ flex: 1 }}>
              <label className="em-field-label">Ordre</label>
              <input className="em-input" type="number" min={1} value={form.order} onChange={(e) => set("order", Number(e.target.value))} />
            </div>
            <div className="em-field" style={{ flex: 1 }}>
              <label className="em-field-label">Points (1–5)</label>
              <input className="em-input" type="number" min={1} max={5} value={form.dots} onChange={(e) => set("dots", Math.max(1, Math.min(5, Number(e.target.value))))} />
            </div>
            <div className="em-field" style={{ flex: 1 }}>
              <label className="em-field-label">Statut</label>
              <select className="em-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="published">published</option>
                <option value="draft">draft</option>
              </select>
            </div>
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0 0" }}>⚠ {error}</p>}
        </div>

        <div className="cms-modal-footer">
          <button className="em-btn-secondary" onClick={onClose}>Annuler</button>
          <button className="em-primary-btn" onClick={save} disabled={busy !== null}>
            {busy === "save" ? "Enregistrement…" : "✓ Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manager ─────────────────────────────────────────────────────────────────
export default function HeroSlidesManager() {
  const { packages, packageActions } = useTravelData();
  const [editing, setEditing] = useState(null);   // slide object | "new"
  const [deleting, setDeleting] = useState(null); // $id
  const [importing, setImporting] = useState(null); // progress string
  const [importError, setImportError] = useState(null);

  const slides = useMemo(
    () =>
      (packages || [])
        .map(parseHeroSlide)
        .filter(Boolean)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [packages]
  );

  const saveSlide = async (form) => {
    if (editing && editing !== "new" && editing.$id) {
      await packageActions.update(editing.$id, {
        data: JSON.stringify({ kind: HERO_KIND, ...form }),
      });
    } else {
      await packageActions.create(heroSlideDocumentAttrs(form));
    }
  };

  const removeSlide = async () => {
    try {
      await packageActions.remove(deleting);
    } finally {
      setDeleting(null);
    }
  };

  const importDefaults = async () => {
    setImportError(null);
    const existing = new Set(slides.map((s) => s.name.toLowerCase()));
    const todo = DEFAULT_HERO_SLIDES.filter((s) => !existing.has(s.name.toLowerCase()));
    if (todo.length === 0) { setImportError("Les 5 slides par défaut existent déjà."); return; }
    try {
      for (let i = 0; i < todo.length; i++) {
        const s = todo[i];
        setImporting(`${s.name} (${i + 1}/${todo.length}) — images…`);
        const bgBlob = await fetch(s.bgLocal).then((r) => { if (!r.ok) throw new Error(`Image locale introuvable : ${s.bgLocal}`); return r.blob(); });
        const cardBlob = await fetch(s.cardLocal).then((r) => { if (!r.ok) throw new Error(`Image locale introuvable : ${s.cardLocal}`); return r.blob(); });
        const bg = await uploadImage(bgBlob, `hero-${s.name}-bg`, 2560, 0.82);
        const card = await uploadImage(cardBlob, `hero-${s.name}-card`, 1000, 0.85);
        setImporting(`${s.name} (${i + 1}/${todo.length}) — document…`);
        const { bgLocal, cardLocal, ...rest } = s;
        await packageActions.create(
          heroSlideDocumentAttrs({ ...rest, bgFileId: bg.fileId, bgUrl: bg.url, cardFileId: card.fileId, cardUrl: card.url })
        );
      }
    } catch (err) {
      setImportError(isAuthError(err) ? AUTH_HINT : `Import interrompu : ${err.message}`);
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="cms-table-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Slides du hero (page d'accueil)</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
            Stockés dans la collection <code>products</code> (kind: hero-slide), images dans Appwrite Storage.
          </div>
        </div>
        <button className="em-btn-secondary" onClick={importDefaults} disabled={!!importing}>
          {importing ? `⏳ ${importing}` : "⇪ Importer les slides par défaut"}
        </button>
        <button className="em-primary-btn" onClick={() => setEditing("new")}>+ Ajouter un slide</button>
      </div>

      {importError && <p className="cms-status-bar error" style={{ marginBottom: 12 }}>⚠ {importError}</p>}

      {slides.length === 0 ? (
        <div className="em-empty">
          <div className="em-empty-icon">🎬</div>
          <p className="em-empty-title">Aucun slide — importez les slides par défaut ou ajoutez-en un.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {slides.map((s) => (
            <div
              key={s.$id}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: 10,
                border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff",
              }}
            >
              <img src={slideBg(s)} alt="" style={{ width: 88, height: 50, objectFit: "cover", borderRadius: 8 }} />
              <img src={slideCard(s)} alt="" style={{ width: 34, height: 50, objectFit: "cover", borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.order}. {s.name}</div>
                <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.cardLabel} — {s.description}
                </div>
              </div>
              <span
                className="cms-badge"
                style={s.status === "draft"
                  ? { background: "rgba(255,117,14,0.1)", color: "#c4733a" }
                  : { background: "#f0fdf4", color: "#15803d" }}
              >
                {s.status}
              </span>
              <div className="cms-actions">
                <button className="cms-icon-btn" onClick={() => setEditing(s)}>✎</button>
                <button className="cms-icon-btn danger" onClick={() => setDeleting(s.$id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <SlideModal
          slide={editing === "new" ? null : editing}
          onSave={saveSlide}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <div className="em-modal-backdrop" style={{ alignItems: "center" }} onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="em-confirm">
            <div className="em-confirm-icon">🗑️</div>
            <div className="em-confirm-title">Supprimer ce slide ?</div>
            <p className="em-confirm-text">Le slide sera retiré du hero. Les images restent dans le Storage.</p>
            <div className="em-confirm-actions">
              <button className="em-btn-secondary" onClick={() => setDeleting(null)}>Annuler</button>
              <button className="em-btn-danger" onClick={removeSlide}>✕ Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
