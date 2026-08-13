import { useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import {
  contactFromPackages,
  contactDocumentAttrs,
  DEFAULT_OFFICE_IMAGES,
} from "../services/siteContact";

const inputStyle = {
  width: "100%", padding: "9px 11px", border: "1px solid #e2e8f0",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff",
};

/** Dashboard — Contact tab: the three office photos shown on /contact. */
export default function ContactImagesManager() {
  const { packages, packageActions } = useTravelData();
  const existing = useMemo(() => contactFromPackages(packages), [packages]);
  const [images, setImages] = useState(() => {
    const imgs = existing?.images || [];
    return [0, 1, 2].map((i) => imgs[i] || "");
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (i, v) => setImages((prev) => prev.map((x, j) => (j === i ? v : x)));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const attrs = contactDocumentAttrs({ images });
      if (existing?.$id) await packageActions.update(existing.$id, attrs);
      else await packageActions.create(attrs);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cms-table-card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Page contact — photos de l'agence</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
          Trois images affichées sur la page /contact (URL d'image ou chemin local). Champ vide = image par défaut.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {images.map((url, i) => (
          <div key={i}>
            <div
              style={{
                aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden",
                border: "1px solid #e2e8f0", background: "#f8fafc", marginBottom: 8,
              }}
            >
              <img
                src={url?.trim() || DEFAULT_OFFICE_IMAGES[i]}
                alt={`Bureau ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { e.currentTarget.style.opacity = 0.2; }}
                onLoad={(e) => { e.currentTarget.style.opacity = 1; }}
              />
            </div>
            <input
              style={inputStyle}
              placeholder={`Image ${i + 1} — ${DEFAULT_OFFICE_IMAGES[i]}`}
              value={url}
              onChange={(e) => set(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      {err && <p className="cms-status-bar error" style={{ marginTop: 14 }}>⚠ {err}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="em-primary-btn" onClick={save} disabled={saving}>
          {saving ? "⏳ Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
