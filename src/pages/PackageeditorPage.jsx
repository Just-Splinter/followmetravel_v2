import { useState, useCallback, useRef } from "react";
import { ReservationModal } from "../components/Reservationmodal____";
import { AIAgentPanel } from "../components/AIAgent";
import { usePackages } from "../context/PackagesContext";
import { Lightbox } from "./PackageViewerPage";
import StorageService from "../services/storage";
import { toast } from "react-toastify";
import {
  Save, Check, X, Plus, Upload,
  Eye, Image as ImageIcon,
  Calendar, Hotel, List, Tag, Settings
} from "lucide-react";

import '../styles/PackageeditorPage.css'

// ─── Palettes ─────────────────────────────────────────────────────
const PALETTES = [
  { id: "orange", label: "Orange Solaire", swatch: "#F59E42", theme: { gold: "#F59E42", goldLight: "#FFD8A8", dark: "#5E3B14", cream: "#FFF9F2", textDark: "#5A3712", textMuted: "#A06B35", navy: "#D97706", borderGold: "rgba(245,158,66,.22)" } },
  { id: "apricot", label: "Abricot", swatch: "#FFB36B", theme: { gold: "#FFB36B", goldLight: "#FFE3C2", dark: "#744116", cream: "#FFF8F0", textDark: "#6B3D14", textMuted: "#AE7C52", navy: "#F08C36", borderGold: "rgba(255,179,107,.25)" } },
  { id: "peach", label: "Pêche", swatch: "#FFBC99", theme: { gold: "#FFBC99", goldLight: "#FFE5D6", dark: "#734229", cream: "#FFF9F6", textDark: "#68361E", textMuted: "#A8755B", navy: "#F28B65", borderGold: "rgba(255,188,153,.24)" } },
  { id: "sand", label: "Sable", swatch: "#E8C98B", theme: { gold: "#E8C98B", goldLight: "#F9E9C8", dark: "#725C2C", cream: "#FFFDF8", textDark: "#5D491F", textMuted: "#A18A5B", navy: "#D4AF37", borderGold: "rgba(232,201,139,.25)" } },
  { id: "coral", label: "Corail", swatch: "#FF8E72", theme: { gold: "#FF8E72", goldLight: "#FFD2C5", dark: "#743528", cream: "#FFF7F5", textDark: "#67291D", textMuted: "#A96C5D", navy: "#F9735B", borderGold: "rgba(255,142,114,.25)" } },
  { id: "champagne", label: "Champagne", swatch: "#EACD9C", theme: { gold: "#EACD9C", goldLight: "#FAF1DD", dark: "#655232", cream: "#FFFDF9", textDark: "#55431F", textMuted: "#9E8B66", navy: "#D9B66A", borderGold: "rgba(234,205,156,.24)" } },
  { id: "sky", label: "Bleu Ciel", swatch: "#8CCFFF", theme: { gold: "#8CCFFF", goldLight: "#DDF3FF", dark: "#28506C", cream: "#F8FCFF", textDark: "#20435D", textMuted: "#6F93A8", navy: "#4EA5E9", borderGold: "rgba(140,207,255,.24)" } },
  { id: "mint", label: "Menthe", swatch: "#8FE0C0", theme: { gold: "#8FE0C0", goldLight: "#DDF9EF", dark: "#295A4A", cream: "#F8FFFC", textDark: "#204A3C", textMuted: "#6A9A8A", navy: "#49BE96", borderGold: "rgba(143,224,192,.24)" } },
  { id: "lavender", label: "Lavande", swatch: "#C5B3FF", theme: { gold: "#C5B3FF", goldLight: "#EEE8FF", dark: "#51407A", cream: "#FCFBFF", textDark: "#463767", textMuted: "#8A7CA7", navy: "#9B84F5", borderGold: "rgba(197,179,255,.24)" } },
  { id: "custom", label: "Personnalisé", swatch: null, theme: null },
];

const FONT_FAMILIES_DISPLAY = [
  { label: "Georgia (défaut)", value: "Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
  { label: "Lora", value: "Lora, Georgia, serif" },
];

const FONT_FAMILIES_BODY = [
  { label: "Nunito Sans (défaut)", value: "'Nunito Sans', 'Segoe UI', sans-serif" },
  { label: "DM Sans", value: "'DM Sans', sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
];

const DEFAULT_CUSTOM_THEME = {
  gold: "#C8A45A", goldLight: "#E8C97A", dark: "#1a1209",
  cream: "#FDF8EE", textDark: "#2a1f0a", textMuted: "#7a6a50",
  navy: "#1a3a5c", borderGold: "rgba(200,164,90,0.27)",
  fontDisplay: "Georgia, serif",
  fontBody: "'Nunito Sans', 'Segoe UI', sans-serif",
  fontSizeBase: 14, fontSizeHero: 42, fontSizeTitle: 12,
};



// ─── Helpers ──────────────────────────────────────────────────────
let _uid = 2000;
const uid = () => ++_uid;

function getTheme(pkg) {
  if (pkg.paletteId === "custom") {
    return { ...DEFAULT_CUSTOM_THEME, ...(pkg.customTheme || {}) };
  }
  const palette = PALETTES.find(p => p.id === pkg.paletteId);
  const base = palette?.theme || PALETTES[0].theme;
  return {
    fontDisplay: DEFAULT_CUSTOM_THEME.fontDisplay,
    fontBody: DEFAULT_CUSTOM_THEME.fontBody,
    fontSizeBase: DEFAULT_CUSTOM_THEME.fontSizeBase,
    fontSizeHero: DEFAULT_CUSTOM_THEME.fontSizeHero,
    fontSizeTitle: DEFAULT_CUSTOM_THEME.fontSizeTitle,
    ...base,
  };
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.27)`;
}

// ─── Shared UI Components ─────────────────────────────────────────
function ImageUploadZone({ value, onChange, label, height = 100 }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setProgress(10);
      setProgress(30);
      const uploaded = await StorageService.upload(file);
      setProgress(90);
      onChange(StorageService.getView(uploaded.$id));
      setProgress(100);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'upload");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 300);
      e.target.value = "";
    }
  };

  return (
    <div className="ed-upload-zone">
      {label && <label className="ed-field-label">{label}</label>}
      <div
        onClick={() => !uploading && inputRef.current.click()}
        className={`ed-upload-box ${value ? "has-image" : ""} ${uploading ? "uploading" : ""}`}
        style={{
          height,
          backgroundImage: value ? `url(${value})` : "none",
        }}
      >
        {!value && !uploading && (
          <div className="ed-upload-placeholder">
            <div className="ed-upload-placeholder-icon">🖼️</div>
            <div className="ed-upload-placeholder-text">Upload image</div>
          </div>
        )}
        {value && !uploading && (
          <div className="ed-upload-overlay">Changer</div>
        )}
        {uploading && (
          <div className="ed-upload-progress">
            <div className="ed-upload-progress-label">Upload...</div>
            <div className="ed-upload-progress-bar">
              <div className="ed-upload-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="ed-upload-progress-percent">{progress}%</div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      </div>
      {value && !uploading && (
        <button className="ed-upload-remove" onClick={() => onChange(null)}>
          ✕ Supprimer l'image
        </button>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div className="ed-field">
      {label && <label className="ed-field-label">{label}</label>}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="ed-input"
      />
    </div>
  );
}

function AddBtn({ label, onClick, icon }) {
  return (
    <button onClick={onClick} className="ed-add-btn">
      {icon || <Plus size={14} />} {label}
    </button>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick} className="ed-remove-btn" aria-label="Supprimer">
      <X size={14} />
    </button>
  );
}

function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ed-accordion ${open ? "open" : ""}`}>
      <button className="ed-accordion-header" onClick={() => setOpen(o => !o)}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon} {title}
        </span>
        <span className="ed-accordion-chevron">▶</span>
      </button>
      {open && <div className="ed-accordion-body">{children}</div>}
    </div>
  );
}

// ─── Palette Sidebar ──────────────────────────────────────────────
function PaletteSidebar({ pkg, update, onClose }) {
  const [customOpen, setCustomOpen] = useState(false);
  const currentId = pkg.paletteId || "orange";

  const handlePaletteSelect = (p) => {
    update("paletteId", p.id);
    if (p.id === "custom") {
      setCustomOpen(true);
    } else {
      setCustomOpen(false);
    }
  };

  const updateCustom = (key, val) => {
    const updated = { ...(pkg.customTheme || DEFAULT_CUSTOM_THEME), [key]: val };
    if (key === "gold") {
      updated.borderGold = hexToRgb(val);
    }
    update("customTheme", updated);
  };

  const ct = { ...DEFAULT_CUSTOM_THEME, ...(pkg.customTheme || {}) };

  return (
    <div className="ed-palette-sidebar">
      <div className="ed-palette-close" onClick={onClose} title="Fermer">
        <X size={14} />
      </div>

      <div className="ed-palette-list">
        {PALETTES.filter(p => p.id !== "custom").map(p => (
          <button
            key={p.id}
            title={p.label}
            onClick={() => handlePaletteSelect(p)}
            className={`ed-palette-swatch ${currentId === p.id ? "active" : ""}`}
            style={{ background: p.swatch, color: p.swatch }}
          />
        ))}

        <button
          title={currentId === "custom" ? (customOpen ? "Fermer" : "Ouvrir") : "Personnalisé"}
          onClick={() => {
            if (currentId === "custom") {
              setCustomOpen(o => !o);
            } else {
              handlePaletteSelect(PALETTES.find(p => p.id === "custom"));
            }
          }}
          className={`ed-palette-swatch ${currentId === "custom" ? "active ed-palette-swatch-custom" : "ed-palette-swatch-custom"}`}
          style={currentId === "custom" ? { background: ct.gold, color: ct.dark } : {}}
        >
          {currentId === "custom" && (
            <span style={{ fontSize: 10, fontWeight: 700 }}>
              {customOpen ? "✕" : "✎"}
            </span>
          )}
        </button>
      </div>

      {currentId === "custom" && customOpen && (
        <div className="ed-palette-flyout">
          <div className="ed-palette-flyout-header">
            <div className="ed-palette-flyout-title">Couleurs personnalisées</div>
            <button className="ed-palette-flyout-close" onClick={() => setCustomOpen(false)}>
              <X size={14} />
            </button>
          </div>

          {[
            { key: "gold", label: "Couleur principale (or)" },
            { key: "goldLight", label: "Couleur claire" },
            { key: "dark", label: "Fond sombre" },
            { key: "cream", label: "Fond clair (crème)" },
            { key: "textDark", label: "Texte principal" },
            { key: "textMuted", label: "Texte secondaire" },
            { key: "navy", label: "Accent foncé" },
          ].map(({ key, label }) => (
            <div key={key} className="ed-color-row">
              <input
                type="color"
                value={ct[key] || "#000000"}
                onChange={e => updateCustom(key, e.target.value)}
                className="ed-color-input"
              />
              <span className="ed-color-label">{label}</span>
            </div>
          ))}

          <div className="ed-typography-section">
            <div className="ed-typography-title">Typographie</div>

            <div className="ed-field">
              <label className="ed-field-label">Police titres</label>
              <select
                value={ct.fontDisplay || DEFAULT_CUSTOM_THEME.fontDisplay}
                onChange={e => updateCustom("fontDisplay", e.target.value)}
                className="ed-select"
              >
                {FONT_FAMILIES_DISPLAY.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="ed-field">
              <label className="ed-field-label">Police corps</label>
              <select
                value={ct.fontBody || DEFAULT_CUSTOM_THEME.fontBody}
                onChange={e => updateCustom("fontBody", e.target.value)}
                className="ed-select"
              >
                {FONT_FAMILIES_BODY.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="ed-font-sizes">
              {[
                { key: "fontSizeBase", label: "Corps" },
                { key: "fontSizeTitle", label: "Titre" },
                { key: "fontSizeHero", label: "Hero" },
              ].map(({ key, label }) => (
                <div key={key} className="ed-font-size-item">
                  <label className="ed-font-size-label">{label}</label>
                  <div className="ed-font-size-input-wrap">
                    <input
                      type="number"
                      min={8}
                      max={80}
                      value={ct[key] || DEFAULT_CUSTOM_THEME[key]}
                      onChange={e => updateCustom(key, Number(e.target.value))}
                      className="ed-font-size-input"
                    />
                    <span className="ed-font-size-unit">px</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ed-preview-card">
            <div className="ed-preview-label">Aperçu rapide</div>
            <div
              className="ed-preview-box"
              style={{
                fontFamily: ct.fontBody || DEFAULT_CUSTOM_THEME.fontBody,
                fontSize: ct.fontSizeBase || DEFAULT_CUSTOM_THEME.fontSizeBase,
              }}
            >
              <div style={{ background: ct.navy, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: (ct.fontSizeTitle || 12) + 1, color: ct.goldLight, fontWeight: 700, letterSpacing: 1, fontFamily: ct.fontDisplay || DEFAULT_CUSTOM_THEME.fontDisplay }}>DEST</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Agence</span>
              </div>
              <div style={{ background: ct.cream, padding: "10px 12px" }}>
                <div style={{ fontSize: ct.fontSizeTitle || 12, color: ct.textDark, marginBottom: 4, fontFamily: ct.fontDisplay || DEFAULT_CUSTOM_THEME.fontDisplay }}>Titre du package</div>
                <div style={{ fontSize: (ct.fontSizeBase || 14) - 2, color: ct.textMuted }}>Description courte</div>
                <div style={{ display: "inline-block", marginTop: 8, background: ct.gold, borderRadius: 4, padding: "4px 10px", fontSize: 9, color: ct.dark, fontWeight: 700 }}>
                  Réserver
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor Sections ──────────────────────────────────────────────
function HeroEditor({ pkg, update }) {
  return (
    <Accordion title="En-tête & Hero" icon={<Tag size={14} />}>
      <ImageUploadZone label="Image de fond (Hero)" value={pkg.heroBg} onChange={v => update("heroBg", v)} height={120} />
      <div className="ed-field-row">
        <Field label="Agence 1" value={pkg.agency1} onChange={v => update("agency1", v)} />
        <Field label="Sous-titre" value={pkg.agency1Sub} onChange={v => update("agency1Sub", v)} />
      </div>
      <div className="ed-field-row">
        <Field label="Agence 2" value={pkg.agency2} onChange={v => update("agency2", v)} />
        <Field label="Sous-titre" value={pkg.agency2Sub} onChange={v => update("agency2Sub", v)} />
      </div>
      <Field label="Durée (badge)" value={pkg.durationLabel} onChange={v => update("durationLabel", v)} />
      <div className="ed-field-row">
        <Field label="Destination" value={pkg.destination} onChange={v => update("destination", v)} />
        <Field label="Accent" value={pkg.destinationAccent} onChange={v => update("destinationAccent", v)} />
      </div>
      <Field label="Sous-titre italique" value={pkg.subtitleItalic} onChange={v => update("subtitleItalic", v)} />
      <Field label="Tagline" value={pkg.tagline} onChange={v => update("tagline", v)} />
      <Field label="Période" value={pkg.periodLabel} onChange={v => update("periodLabel", v)} />
      <Field label="Label 'à partir de'" value={pkg.priceFromLabel} onChange={v => update("priceFromLabel", v)} />
      <div className="ed-field-row">
        <Field label="Prix" value={pkg.basePrice} onChange={v => update("basePrice", v)} />
        <Field label="Devise" value={pkg.currency} onChange={v => update("currency", v)} />
      </div>
    </Accordion>
  );
}

function GalleryEditor({ pkg, update }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setProgress(0);
    setCurrent(0);
    setTotal(files.length);

    try {
      const uploadedItems = [];
      for (let i = 0; i < files.length; i++) {
        setCurrent(i + 1);
        const file = files[i];
        const uploaded = await StorageService.upload(file);
        uploadedItems.push({
          id: uid(),
          fileId: uploaded.$id,
          url: StorageService.getView(uploaded.$id),
          caption: file.name.replace(/\.[^.]+$/, ""),
        });
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      update("gallery", [...(pkg.gallery || []), ...uploadedItems]);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      setProgress(0);
      setCurrent(0);
      setTotal(0);
      e.target.value = "";
    }
  };

  const updateCaption = (id, value) => {
    update("gallery", (pkg.gallery || []).map(g => g.id === id ? { ...g, caption: value } : g));
  };

  const removeImage = (id) => {
    update("gallery", (pkg.gallery || []).filter(g => g.id !== id));
  };

  return (
    <Accordion title="Galerie d'images" icon={<ImageIcon size={14} />}>
      <div className="ed-gallery-hint">
        Ajoutez des photos qui seront affichées dans la galerie.
      </div>

      {uploading && (
        <div className="ed-gallery-upload-status">
          <div className="ed-gallery-upload-header">
            <span>Upload en cours...</span>
            <span>{current}/{total}</span>
          </div>
          <div className="ed-gallery-progress-bar">
            <div className="ed-gallery-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="ed-gallery-progress-percent">{progress}%</div>
        </div>
      )}

      <div className="ed-gallery-grid">
        {(pkg.gallery || []).map(img => (
          <div key={img.id} className="ed-gallery-item">
            <img src={img.url} alt={img.caption} className="ed-gallery-item-img" />
            <button className="ed-gallery-item-remove" onClick={() => removeImage(img.id)}>
              <X size={12} />
            </button>
            <input
              value={img.caption}
              placeholder="Légende..."
              onChange={e => updateCaption(img.id, e.target.value)}
              className="ed-gallery-item-caption"
            />
          </div>
        ))}
      </div>

      <button
        disabled={uploading}
        onClick={() => inputRef.current.click()}
        className="ed-gallery-add-btn"
      >
        <Upload size={14} />
        {uploading ? `Upload ${current}/${total}...` : "Ajouter des images"}
      </button>
      <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFiles} />
    </Accordion>
  );
}

function SectionsEditor({ pkg, update }) {
  const [openSection, setOpenSection] = useState(null);
  const sections = pkg.sections || [];

  const updateSection = (sId, field, val) =>
    update("sections", sections.map(s => s.id === sId ? { ...s, [field]: val } : s));

  const addSection = () => {
    const newSection = { id: uid(), title: "Nouvelle section", icon: "📌", badge: "", items: [] };
    update("sections", [...sections, newSection]);
    setOpenSection(newSection.id);
  };

  const removeSection = (sId) => {
    update("sections", sections.filter(s => s.id !== sId));
    if (openSection === sId) setOpenSection(null);
  };

  const updateItem = (sId, iId, field, val) =>
    update("sections", sections.map(s =>
      s.id === sId ? { ...s, items: s.items.map(i => i.id === iId ? { ...i, [field]: val } : i) } : s
    ));

  const addItem = (sId) =>
    update("sections", sections.map(s =>
      s.id === sId ? { ...s, items: [...s.items, { id: uid(), icon: "⭐", text: "Nouvel élément" }] } : s
    ));

  const removeItem = (sId, iId) =>
    update("sections", sections.map(s =>
      s.id === sId ? { ...s, items: s.items.filter(i => i.id !== iId) } : s
    ));

  const moveSection = (sId, dir) => {
    const idx = sections.findIndex(s => s.id === sId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const arr = [...sections];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    update("sections", arr);
  };

  return (
    <Accordion title="Sections" icon={<List size={14} />}>
      <div className="ed-gallery-hint">
        Créez autant de sections que vous voulez (Inclus, Options, Transport, etc.).
      </div>
      {sections.map((section, idx) => (
        <div key={section.id} className={`ed-section-item ${openSection === section.id ? "open" : ""}`}>
          <div className="ed-section-header" onClick={() => setOpenSection(openSection === section.id ? null : section.id)}>
            <span className="ed-section-icon">{section.icon || "📌"}</span>
            <span className="ed-section-title">{section.title}</span>
            <span className="ed-section-count">{section.items.length} élém.</span>
            <button
              className="ed-section-move-btn"
              onClick={e => { e.stopPropagation(); moveSection(section.id, -1); }}
              disabled={idx === 0}
            >
              ▲
            </button>
            <button
              className="ed-section-move-btn"
              onClick={e => { e.stopPropagation(); moveSection(section.id, 1); }}
              disabled={idx === sections.length - 1}
            >
              ▼
            </button>
            <RemoveBtn onClick={e => { e.stopPropagation(); removeSection(section.id); }} />
          </div>
          {openSection === section.id && (
            <div className="ed-section-body">
              <div className="ed-field-row" style={{ marginTop: 12 }}>
                <Field label="Icône" value={section.icon} onChange={v => updateSection(section.id, "icon", v)} />
                <Field label="Titre" value={section.title} onChange={v => updateSection(section.id, "title", v)} />
              </div>
              <Field label="Badge (optionnel)" value={section.badge || ""} placeholder="ex: Pack 800 DH" onChange={v => updateSection(section.id, "badge", v)} />
              <div className="ed-section-items-label">Éléments</div>
              {section.items.map(item => (
                <div key={item.id} className="ed-section-item-row">
                  <input
                    value={item.icon}
                    onChange={e => updateItem(section.id, item.id, "icon", e.target.value)}
                    className="ed-section-item-icon-input"
                  />
                  <input
                    value={item.text}
                    onChange={e => updateItem(section.id, item.id, "text", e.target.value)}
                    className="ed-section-item-text-input"
                  />
                  <RemoveBtn onClick={() => removeItem(section.id, item.id)} />
                </div>
              ))}
              <AddBtn label="Ajouter un élément" onClick={() => addItem(section.id)} />
            </div>
          )}
        </div>
      ))}
      <AddBtn label="Ajouter une section" onClick={addSection} />
    </Accordion>
  );
}

function SupplimentsCard({ pkg, update }) {
  const [openId, setOpenId] = useState(null);
  const suppliments = pkg.suppliments || [];

  const updateSup = (id, field, value) =>
    update("suppliments", suppliments.map(s => s.id === id ? { ...s, [field]: value } : s));

  const addSup = () => {
    const newSup = { id: uid(), key: "new", label: "Nouveau supplément", icon: "⭐", pricePerPax: 0 };
    update("suppliments", [...suppliments, newSup]);
    setOpenId(newSup.id);
  };

  const removeSup = (id) => {
    update("suppliments", suppliments.filter(s => s.id !== id));
    if (openId === id) setOpenId(null);
  };

  const moveSup = (id, dir) => {
    const idx = suppliments.findIndex(s => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= suppliments.length) return;
    const arr = [...suppliments];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    update("suppliments", arr);
  };

  return (
    <Accordion title="Suppléments" icon={<Plus size={14} />}>
      <div className="ed-gallery-hint">
        Gérez les options payantes par personne (excursions, packs, activités…)
      </div>

      {suppliments.map((s) => (
        <div key={s.id} className={`ed-section-item ${openId === s.id ? "open" : ""}`}>
          <div className="ed-section-header" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
            <span className="ed-section-icon">{s.icon}</span>
            <span className="ed-section-title">{s.label}</span>
            <span className="ed-section-count">{s.pricePerPax} DH/pax</span>
            <button className="ed-section-move-btn" onClick={e => { e.stopPropagation(); moveSup(s.id, -1); }}>▲</button>
            <button className="ed-section-move-btn" onClick={e => { e.stopPropagation(); moveSup(s.id, 1); }}>▼</button>
            <RemoveBtn onClick={e => { e.stopPropagation(); removeSup(s.id); }} />
          </div>
          {openId === s.id && (
            <div className="ed-section-body">
              <div className="ed-field-row" style={{ marginTop: 12 }}>
                <Field label="Icon" value={s.icon} onChange={v => updateSup(s.id, "icon", v)} />
                <Field label="Key" value={s.key} onChange={v => updateSup(s.id, "key", v)} />
              </div>
              <Field label="Label" value={s.label} onChange={v => updateSup(s.id, "label", v)} />
              <Field label="Prix par pax (DH)" type="number" value={s.pricePerPax} onChange={v => updateSup(s.id, "pricePerPax", Number(v))} />
            </div>
          )}
        </div>
      ))}
      <AddBtn label="Ajouter un supplément" onClick={addSup} />
    </Accordion>
  );
}

function DaysEditor({ pkg, update }) {
  const [openDay, setOpenDay] = useState(null);

  const updateDay = (dayId, field, val) =>
    update("days", pkg.days.map(d => d.id === dayId ? { ...d, [field]: val } : d));

  const addDay = () => {
    const n = pkg.days.length + 1;
    update("days", [...pkg.days, { id: uid(), num: String(n).padStart(2, "0"), title: `Jour ${n}`, badge: "", theme: "Thème", image: null, activities: [] }]);
  };

  const removeDay = (id) => update("days", pkg.days.filter(d => d.id !== id));

  const updateActivity = (dayId, actId, field, val) =>
    update("days", pkg.days.map(d => d.id === dayId
      ? { ...d, activities: d.activities.map(a => a.id === actId ? { ...a, [field]: val } : a) } : d));

  const addActivity = (dayId) =>
    update("days", pkg.days.map(d => d.id === dayId
      ? { ...d, activities: [...d.activities, { id: uid(), label: "Activité", optional: false }] } : d));

  const removeActivity = (dayId, actId) =>
    update("days", pkg.days.map(d => d.id === dayId
      ? { ...d, activities: d.activities.filter(a => a.id !== actId) } : d));

  return (
    <Accordion title="Itinéraire" icon={<Calendar size={14} />}>
      <Field label="Titre section" value={pkg.itineraryTitle} onChange={v => update("itineraryTitle", v)} />
      {pkg.days.map(day => (
        <DayItem
          key={day.id}
          day={day}
          isOpen={openDay === day.id}
          onToggle={() => setOpenDay(openDay === day.id ? null : day.id)}
          onUpdate={(field, val) => updateDay(day.id, field, val)}
          onRemove={() => removeDay(day.id)}
          onUpdateActivity={(actId, field, val) => updateActivity(day.id, actId, field, val)}
          onAddActivity={() => addActivity(day.id)}
          onRemoveActivity={(actId) => removeActivity(day.id, actId)}
        />
      ))}
      <AddBtn label="Ajouter un jour" onClick={addDay} />
    </Accordion>
  );
}

function DayItem({ day, isOpen, onToggle, onUpdate, onRemove, onUpdateActivity, onAddActivity, onRemoveActivity }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);

  const currentImage = preview || day.image;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setProgress(10);
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setProgress(30);
      const uploaded = await StorageService.upload(file);
      setProgress(90);
      const url = StorageService.getView(uploaded.$id);
      onUpdate("image", url);
      setProgress(100);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setPreview(null);
      toast.error("Erreur upload");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 300);
      e.target.value = "";
    }
  };

  return (
    <div className={`ed-day-item ${isOpen ? "open" : ""}`}>
      <div className="ed-day-header" onClick={onToggle}>
        {currentImage ? (
          <img src={currentImage} alt="" className="ed-day-thumb" />
        ) : (
          <span className="ed-day-num">{day.num}</span>
        )}
        <span className="ed-day-title">{day.title}</span>
        <RemoveBtn onClick={onRemove} />
      </div>
      {isOpen && (
        <div className="ed-day-body">
          <div className="ed-day-image-upload">
            <div className="ed-day-image-label">Image du jour</div>
            <div className="ed-day-image-row">
              <div
                onClick={() => !uploading && inputRef.current.click()}
                className={`ed-day-image-box ${uploading ? "uploading" : ""}`}
                style={{ backgroundImage: currentImage ? `url(${currentImage})` : "none" }}
              >
                {!currentImage && !uploading && <span style={{ fontSize: 22 }}>🌅</span>}
                {uploading && (
                  <div className="ed-day-image-progress">
                    <div>{progress}%</div>
                    <div className="ed-day-image-progress-bar">
                      <div className="ed-day-image-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="ed-day-image-actions">
                <button disabled={uploading} onClick={() => inputRef.current.click()} className="ed-day-image-btn">
                  {uploading ? "Upload..." : currentImage ? "Changer" : "Uploader"}
                </button>
                {currentImage && !uploading && (
                  <button onClick={() => onUpdate("image", null)} className="ed-day-image-remove">
                    ✕ Supprimer
                  </button>
                )}
              </div>
            </div>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>

          <div className="ed-field-row" style={{ marginTop: 12 }}>
            <Field label="Numéro" value={day.num} onChange={v => onUpdate("num", v)} />
            <Field label="Badge" value={day.badge} onChange={v => onUpdate("badge", v)} placeholder="ex: Optionnelle" />
          </div>
          <Field label="Titre" value={day.title} onChange={v => onUpdate("title", v)} />
          <Field label="Thème" value={day.theme} onChange={v => onUpdate("theme", v)} />

          <div className="ed-section-items-label">Activités</div>
          {day.activities.map(act => (
            <div key={act.id} className="ed-day-activity-row">
              <input
                value={act.label}
                onChange={e => onUpdateActivity(act.id, "label", e.target.value)}
                className="ed-day-activity-input"
              />
              <label className="ed-day-activity-checkbox">
                <input type="checkbox" checked={act.optional} onChange={e => onUpdateActivity(act.id, "optional", e.target.checked)} />
                opt.
              </label>
              <RemoveBtn onClick={() => onRemoveActivity(act.id)} />
            </div>
          ))}
          <AddBtn label="Activité" onClick={onAddActivity} />
        </div>
      )}
    </div>
  );
}

function hotelCategoryNights(category) {
  return (category.hotels || []).reduce((sum, h) => sum + (Number(h.nights) || 0), 0);
}

function HotelCategoryItem({ category, isOpen, onToggle, onUpdate, onRemove, isOnly }) {
  const headers = category.tableHeaders || [];
  const hotels = category.hotels || [];
  const totalNights = hotelCategoryNights(category);

  const updateHeader = (idx, val) => {
    const h = [...headers];
    h[idx] = val;
    onUpdate("tableHeaders", h);
  };

  // priceColCount = colonnes après "Hôtel", "Ville", "Nuits", "★" (les 4 premières fixes)
  const priceColStart = 4;

  const updateHotel = (id, field, val) =>
    onUpdate("hotels", hotels.map(h => h.id === id ? { ...h, [field]: val } : h));

  const updateHotelCol = (id, colIdx, val) =>
    onUpdate("hotels", hotels.map(h => h.id === id ? { ...h, cols: h.cols.map((c, i) => i === colIdx ? val : c) } : h));

  const addHotel = () =>
    onUpdate("hotels", [...hotels, {
      id: uid(), name: "Nouvel Hôtel", city: "", stars: 4, nights: 1,
      cols: headers.slice(priceColStart).map(() => "0"),
    }]);

  const removeHotel = (id) =>
    onUpdate("hotels", hotels.filter(h => h.id !== id));

  const moveHotel = (id, dir) => {
    const idx = hotels.findIndex(h => h.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= hotels.length) return;
    const arr = [...hotels];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onUpdate("hotels", arr);
  };

  const addColHeader = () => {
    onUpdate("tableHeaders", [...headers, "Nouveau"]);
    onUpdate("hotels", hotels.map(h => ({ ...h, cols: [...h.cols, "0"] })));
  };

  const removeLastCol = () => {
    if (headers.length <= priceColStart + 1) return;
    onUpdate("tableHeaders", headers.slice(0, -1));
    onUpdate("hotels", hotels.map(h => ({ ...h, cols: h.cols.slice(0, -1) })));
  };

  return (
    <div className={`ed-section-item ${isOpen ? "open" : ""}`}>
      <div className="ed-section-header" onClick={onToggle}>
        <span className="ed-section-icon"><Hotel size={13} /></span>
        <span className="ed-section-title">{category.label || "Formule"}</span>
        <span className="ed-section-count">{hotels.length} hôtel(s) · {totalNights}N/{totalNights + 1}J</span>
        {!isOnly && <RemoveBtn onClick={e => { e.stopPropagation(); onRemove(); }} />}
      </div>
      {isOpen && (
        <div className="ed-section-body">
          <div className="ed-field-row" style={{ marginTop: 12 }}>
            <Field label="Nom de la formule" value={category.label} placeholder="ex: 4 Étoiles" onChange={v => onUpdate("label", v)} />
            <Field label="Prix de base" value={category.basePrice} onChange={v => onUpdate("basePrice", v)} />
          </div>

          <div className="ed-gallery-hint">
            Durée totale calculée automatiquement : <strong>{totalNights} Nuits / {totalNights + 1} Jours</strong>
          </div>

          <div className="ed-hotels-header-label" style={{ marginTop: 10 }}>Colonnes de prix</div>
          <div className="ed-hotels-headers">
            {headers.slice(priceColStart).map((h, i) => (
              <input
                key={i + priceColStart}
                value={h}
                onChange={e => updateHeader(i + priceColStart, e.target.value)}
                className="ed-hotels-header-input"
              />
            ))}
            <button onClick={addColHeader} className="ed-hotels-add-col-btn">+</button>
            {headers.length > priceColStart + 1 && (
              <button onClick={removeLastCol} className="ed-hotels-remove-col-btn">-</button>
            )}
          </div>

          <div className="ed-section-items-label">Hôtels (ville / nuits)</div>
          {hotels.map((hotel, idx) => (
            <div key={hotel.id} className="ed-hotel-row" style={{ flexWrap: "wrap" }}>
              <input
                value={hotel.name}
                onChange={e => updateHotel(hotel.id, "name", e.target.value)}
                className="ed-hotel-name-input"
                placeholder="Nom de l'hôtel"
              />
              <input
                value={hotel.city || ""}
                onChange={e => updateHotel(hotel.id, "city", e.target.value)}
                className="ed-hotel-name-input"
                placeholder="Ville"
                style={{ maxWidth: 110 }}
              />
              <input
                value={hotel.nights ?? 1}
                onChange={e => updateHotel(hotel.id, "nights", Number(e.target.value))}
                type="number"
                min={0}
                className="ed-hotel-stars-input"
                title="Nombre de nuits"
                placeholder="Nuits"
              />
              <input
                value={hotel.stars}
                onChange={e => updateHotel(hotel.id, "stars", Number(e.target.value))}
                type="number"
                min={1}
                max={5}
                className="ed-hotel-stars-input"
                title="Étoiles"
              />
              {hotel.cols.map((col, ci) => (
                <input
                  key={ci}
                  value={col}
                  onChange={e => updateHotelCol(hotel.id, ci, e.target.value)}
                  className="ed-hotel-col-input"
                />
              ))}
              <button className="ed-section-move-btn" onClick={() => moveHotel(hotel.id, -1)} disabled={idx === 0}>▲</button>
              <button className="ed-section-move-btn" onClick={() => moveHotel(hotel.id, 1)} disabled={idx === hotels.length - 1}>▼</button>
              <RemoveBtn onClick={() => removeHotel(hotel.id)} />
            </div>
          ))}
          <AddBtn label="Ajouter un hôtel" onClick={addHotel} />

          <Field label="Note bas de tableau" value={category.note || ""} onChange={v => onUpdate("note", v)} />
        </div>
      )}
    </div>
  );
}

function HotelsEditor({ pkg, update }) {
  const categories = pkg.hotelCategories || [];
  const [openId, setOpenId] = useState(categories[0]?.id ?? null);

  const updateCategory = (catId, field, val) =>
    update("hotelCategories", categories.map(c => c.id === catId ? { ...c, [field]: val } : c));

  const addCategory = () => {
    const newCat = {
      id: uid(),
      label: "Nouvelle formule",
      basePrice: "0",
      tableHeaders: ["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single"],
      hotels: [],
      note: "Tarifs par personne en dirhams – sous réserve de disponibilités",
    };
    update("hotelCategories", [...categories, newCat]);
    setOpenId(newCat.id);
  };

  const removeCategory = (catId) => {
    update("hotelCategories", categories.filter(c => c.id !== catId));
    if (openId === catId) setOpenId(null);
  };

  const moveCategory = (catId, dir) => {
    const idx = categories.findIndex(c => c.id === catId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const arr = [...categories];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    update("hotelCategories", arr);
  };

  return (
    <Accordion title="Hôtels & Formules" icon={<Hotel size={14} />}>
      <div className="ed-gallery-hint">
        Créez une formule par catégorie d'hôtel (4★, 5★...). Chaque formule a son propre prix, ses hôtels (avec ville et nombre de nuits) et ses colonnes de tarifs.
      </div>
      {categories.map((cat, idx) => (
        <div key={cat.id} style={{ position: "relative" }}>
          {idx > 0 && (
            <button className="ed-section-move-btn" style={{ position: "absolute", top: -8, right: 30, zIndex: 1 }} onClick={() => moveCategory(cat.id, -1)}>▲</button>
          )}
          {idx < categories.length - 1 && (
            <button className="ed-section-move-btn" style={{ position: "absolute", top: -8, right: 8, zIndex: 1 }} onClick={() => moveCategory(cat.id, 1)}>▼</button>
          )}
          <HotelCategoryItem
            category={cat}
            isOpen={openId === cat.id}
            onToggle={() => setOpenId(openId === cat.id ? null : cat.id)}
            onUpdate={(field, val) => updateCategory(cat.id, field, val)}
            onRemove={() => removeCategory(cat.id)}
            isOnly={categories.length <= 1}
          />
        </div>
      ))}
      <AddBtn label="Ajouter une formule (ex: 5 Étoiles)" onClick={addCategory} />
    </Accordion>
  );
}

function DatesEditor({ pkg, update }) {
  const updateDate = (id, field, val) =>
    update("departureDates", pkg.departureDates.map(d => d.id === id ? { ...d, [field]: val } : d));

  const addDate = () =>
    update("departureDates", [...pkg.departureDates, { id: uid(), from: "JJ/MM", to: "JJ/MM" }]);

  const removeDate = (id) =>
    update("departureDates", pkg.departureDates.filter(d => d.id !== id));

  return (
    <Accordion title="Dates de départ" icon={<Calendar size={14} />}>
      {pkg.departureDates.map(d => (
        <div key={d.id} className="ed-date-row">
          <input
            value={d.from}
            onChange={e => updateDate(d.id, "from", e.target.value)}
            className="ed-date-input"
            placeholder="Début"
          />
          <span className="ed-date-separator">→</span>
          <input
            value={d.to}
            onChange={e => updateDate(d.id, "to", e.target.value)}
            className="ed-date-input"
            placeholder="Fin"
          />
          <RemoveBtn onClick={() => removeDate(d.id)} />
        </div>
      ))}
      <AddBtn label="Ajouter une date" onClick={addDate} />
    </Accordion>
  );
}

function TabsEditor({ pkg, update }) {
  const updateTab = (id, field, val) =>
    update("tabs", pkg.tabs.map(t => t.id === id ? { ...t, [field]: val } : t));

  return (
    <Accordion title="Onglets & Footer" icon={<Settings size={14} />}>
      {pkg.tabs.map(t => (
        <div key={t.id} className="ed-tab-row">
          <span className="ed-tab-id">{t.id}</span>
          <input
            value={t.label}
            onChange={e => updateTab(t.id, "label", e.target.value)}
            className="ed-tab-input"
          />
        </div>
      ))}
      <div style={{ marginTop: 14 }}>
        <Field label="Bouton CTA" value={pkg.ctaLabel} onChange={v => update("ctaLabel", v)} />
        <Field label="Téléphone 1" value={pkg.phone1} onChange={v => update("phone1", v)} />
        <Field label="Téléphone 2" value={pkg.phone2} onChange={v => update("phone2", v)} />
        <Field label="Site web" value={pkg.website} onChange={v => update("website", v)} />
      </div>
    </Accordion>
  );
}

// ─── Gallery Section ────────────────────────────────────────────────
function GallerySection({ pkg }) {
  const [lightbox, setLightbox] = useState(null);
  const images = [];

  if (pkg.heroBg) images.push({ url: pkg.heroBg });
  (pkg.gallery || []).forEach(g => {
    if (!images.find(i => i.url === g.url)) images.push(g);
  });

  while (images.length < 5) images.push(null);
  const validImages = images.filter(Boolean);

  return (
    <>
      <div className="pv-gallery">
        {images.slice(0, 5).map((img, i) => (
          <div
            key={i}
            className={`pv-gallery-item ${i === 0 ? 'pv-gallery-main' : ''}`}
            onClick={() => img && setLightbox(i)}
          >
            {img ? (
              <>
                <img src={img.url} alt="" />
                <div className="pv-gallery-overlay">
                  {i === 0 && validImages.length > 5 && (
                    <div className="pv-gallery-more">+{validImages.length - 5} photos</div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#E5E7EB" }} />
            )}
          </div>
        ))}
      </div>

      {lightbox !== null && validImages.length > 0 && (
        <Lightbox images={validImages} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
// ─── Hotel Categories Preview (cards style) ────────────────────────
function HotelCategoriesPreview({ pkg, th }) {
  const categories = pkg.hotelCategories || [];
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find(c => c.id === activeId) || categories[0];

  if (!categories.length) return null;

  const totalNights = active ? hotelCategoryNights(active) : 0;

  return (
    <div className="pv-card">
      <h2 className="pv-card-title">Hébergements & Formules</h2>

      {categories.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${activeId === cat.id ? th.gold : th.borderGold}`,
                background: activeId === cat.id ? th.gold : "#fff",
                color: activeId === cat.id ? th.dark : th.textDark,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, color: th.textMuted, fontWeight: 600 }}>
              {totalNights} Nuits / {totalNights + 1} Jours · {(active.hotels || []).length} hôtel(s)
            </div>
            {active.basePrice && (
              <div style={{ fontSize: 20, fontWeight: 700, color: th.gold }}>
                {active.basePrice} <span style={{ fontSize: 13, color: th.textMuted }}>{pkg.currency}</span>
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="pv-hotels-table">
              <thead>
                <tr>
                  {(active.tableHeaders || []).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(active.hotels || []).map(hotel => (
                  <tr key={hotel.id}>
                    <td style={{ fontWeight: 600 }}>{hotel.name}</td>
                    <td>{hotel.city}</td>
                    <td style={{ textAlign: "center" }}>{hotel.nights}</td>
                    <td className="pv-hotel-stars">{"★".repeat(hotel.stars)}</td>
                    {(hotel.cols || []).map((col, j) => (
                      <td key={j}>{col}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {active.note && (
            <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginTop: 12 }}>{active.note}</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Content ───────────────────────────────────────────────────
function TourContent({ pkg, th }) {
  const otherSections = (pkg.sections || []);

  return (
    <>
      {/* Overview */}
      <div className="pv-card">
        <h2 className="pv-card-title">Aperçu du voyage</h2>
        <p className="pv-text">{pkg.description || pkg.overview || "Découvrez une expérience unique et inoubliable."}</p>

        {pkg.highlights && pkg.highlights.length > 0 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 16 }}>Points forts</h3>
            <div className="pv-highlights">
              {pkg.highlights.map((h, i) => (
                <div key={i} className="pv-highlight">
                  <span className="pv-highlight-icon">✓</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Other Sections */}
      {otherSections.map(section => (
        <div key={section.id} className="pv-card">
          <h2 className="pv-card-title">{section.title}</h2>
          {section.items && section.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {section.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 15, color: "#4B5563", lineHeight: 1.7 }}>
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Itinerary - TIMELINE */}
      {pkg.days && pkg.days.length > 0 && (
        <ItineraryTimeline pkg={pkg} th={th} />
      )}

      {/* Hotels by category */}
      {pkg.hotelCategories && pkg.hotelCategories.length > 0 && (
        <HotelCategoriesPreview pkg={pkg} th={th} />
      )}

      {/* Departure Dates */}
      {pkg.departureDates && pkg.departureDates.length > 0 && (
        <div className="pv-card">
          <h2 className="pv-card-title">Dates de départ</h2>
          <div className="pv-dates-grid">
            {pkg.departureDates.map(date => {
              const [day, month] = date.from.split("/").map(Number);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dep = new Date(today.getFullYear(), month - 1, day);
              if (dep < today) return null;

              return (
                <div key={date.id} className="pv-date-card">
                  <div className="pv-date-from">{date.from}</div>
                  <div className="pv-date-arrow">↓</div>
                  <div className="pv-date-to">{date.to}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
// ─── Itinerary Timeline Component (Left-Aligned) ───────────────────
function ItineraryTimeline({ pkg }) {
  const days = pkg.days || [];

  if (!days || days.length === 0) {
    return (
      <div className="pv-timeline-empty">
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
        <p>Aucun programme disponible pour ce voyage.</p>
      </div>
    );
  }

  return (
    <>      
      <div className="pv-card">
        <h2 className="pv-card-title">
          {pkg.itineraryTitle || "Programme du voyage"}
        </h2>
        
        <p className="pv-text" style={{ marginBottom: 24 }}>
          Découvrez jour par jour votre itinéraire et les expériences qui vous attendent.
        </p>

        <div className="pv-timeline">
          {days.map((day, idx) => (
            <div key={day.id} className="pv-timeline-item">
              {/* Marker */}
              <div className="pv-timeline-marker">
                {day.num || (idx + 1).toString().padStart(2, '0')}
              </div>

              {/* Badge */}
              {day.badge && (
                <div className="pv-timeline-badge">{day.badge}</div>
              )}

              {/* Card */}
              <div className="pv-timeline-card">
                {/* Image */}
                <div className="pv-timeline-image-wrap">
                  {day.image ? (
                    <>
                      <img
                        src={day.image}
                        alt={day.title}
                        className="pv-timeline-image"
                        loading="lazy"
                      />
                      <div className="pv-timeline-image-overlay" />
                    </>
                  ) : (
                    <div className="pv-timeline-image-placeholder">
                      📍
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="pv-timeline-body">
                  <div className="pv-timeline-day-label">
                    Jour {day.num || (idx + 1).toString().padStart(2, '0')}
                  </div>
                  
                  <h3 className="pv-timeline-title">{day.title}</h3>
                  
                  {day.theme && (
                    <div className="pv-timeline-theme">
                      {day.theme}
                    </div>
                  )}

                  {day.activities && day.activities.length > 0 && (
                    <>
                      <div className="pv-timeline-divider" />
                      <ul className="pv-timeline-activities">
                        {day.activities.map((activity, actIdx) => (
                          <li key={activity.id || actIdx} className="pv-timeline-activity">
                            <div className="pv-timeline-activity-icon">
                              {activity.optional ? '?' : '✓'}
                            </div>
                            <div className="pv-timeline-activity-text">
                              {activity.label}
                              {activity.optional && (
                                <span className="pv-timeline-activity-optional">
                                  Optionnel
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PackagePreview({ pkg }) {
  const [showModal, setShowModal] = useState(false);
  const th = getTheme(pkg);

  const cssVars = {
    "--pv-primary": th.primary,
    "--pv-primaryLight": th.primaryLight,
    "--pv-secondary": th.secondary,
    "--pv-accent": th.accent,
  };

  return (
    <div style={cssVars}>
      {/* Gallery */}
      <GallerySection pkg={pkg} />

      {/* Breadcrumb */}
      <div className="pv-breadcrumb">
        <a href="/">Accueil</a>
        <span className="pv-breadcrumb-sep">›</span>
        <a href="/packages">Voyages</a>
        <span className="pv-breadcrumb-sep">›</span>
        <span className="pv-breadcrumb-current">
          {pkg.destination}{pkg.destinationAccent}
        </span>
      </div>

      {/* Main Container */}
      <div className="pv-container">
        {/* Header */}
        <div className="pv-header">
          <div className="pv-header-top">
            <div>
              <h1 className="pv-title">
                {pkg.destination}
                <span style={{ color: th.primary }}>{pkg.destinationAccent}</span>
              </h1>
              <div className="pv-meta">
                {pkg.durationLabel && (
                  <div className="pv-meta-item">
                    <span className="pv-meta-icon">⏱️</span>
                    <span>{pkg.durationLabel}</span>
                  </div>
                )}
                {pkg.periodLabel && (
                  <div className="pv-meta-item">
                    <span className="pv-meta-icon">📅</span>
                    <span>{pkg.periodLabel}</span>
                  </div>
                )}
                <div className="pv-meta-item">
                  <span className="pv-meta-icon">⭐</span>
                  <span>4.8 (124 avis)</span>
                </div>
              </div>
            </div>
            <div className="pv-actions">
              <button className="pv-btn-icon" title="Partager">↗</button>
              <button className="pv-btn-icon" title="Favoris">♡</button>
            </div>
          </div>

          {/* Info Badges */}
          <div className="pv-badges">
            {pkg.destination && (
              <div className="pv-badge">
                <div className="pv-badge-icon">📍</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Destination</div>
                  <div className="pv-badge-value">{pkg.destination}</div>
                </div>
              </div>
            )}
            {pkg.durationLabel && (
              <div className="pv-badge">
                <div className="pv-badge-icon">⏱️</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Durée</div>
                  <div className="pv-badge-value">{pkg.durationLabel}</div>
                </div>
              </div>
            )}
            {pkg.days?.length > 0 && (
              <div className="pv-badge">
                <div className="pv-badge-icon">📋</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Programme</div>
                  <div className="pv-badge-value">{pkg.days.length} jours</div>
                </div>
              </div>
            )}
            {pkg.hotelCategories?.length > 0 && (
              <div className="pv-badge">
                <div className="pv-badge-icon">🏨</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Formules</div>
                  <div className="pv-badge-value">{pkg.hotelCategories.length} formule(s)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <TourContent pkg={pkg} th={th} />
      </div>

      {/* Mobile Sticky CTA */}
      <div className="pv-mobile-cta">
        <div className="pv-mobile-price">
          <div className="pv-mobile-price-label">
            {pkg.priceFromLabel || "À partir de"}
          </div>
          <div className="pv-mobile-price-amount">
            {pkg.basePrice} {pkg.currency || "€"}
          </div>
        </div>
        <button className="pv-mobile-btn" onClick={() => setShowModal(true)}>
          Réserver
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <ReservationModal pkg={pkg} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function PackageEditorPage({ pkg, onSave, onClose }) {

  const { updatePackage } = usePackages();
  const [packages, setPackages] = useState(() => pkg ? [{
    ...pkg.data,
    id: 1,
    paletteId: pkg.data?.paletteId || "orange",
    customTheme: { ...DEFAULT_CUSTOM_THEME, ...(pkg.data?.customTheme || {}) },
  }] : []);
  const [selectedId] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [chatMode] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const selected = packages.find(p => p.id === selectedId);

  const update = useCallback((field, val) => {
    setPackages(prev => prev.map(p => p.id === selectedId ? { ...p, [field]: val } : p));
  }, [selectedId]);

  if (pkg == undefined) return <></>;

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const result = await updatePackage(pkg.$id, {
        ...pkg,
        data: JSON.stringify(selected),
      });
      setSaveState("success");
      toast.success("Package sauvegardé avec succès !");
      onSave && onSave(result);
    } catch (error) {
      console.error(error);
      setSaveState("error");
      toast.error("Une erreur est survenue lors de la sauvegarde.");
    } finally {
      setTimeout(() => setSaveState("idle"), 2200);
    }
  };

  return (
    <div className="ed-root">
      {!previewMode && selected && (
        <PaletteSidebar pkg={selected} update={update} onClose={onClose} />
      )}

     

      <div className={`ed-preview-panel ${previewMode ? "fullscreen" : ""}`}>
        {previewMode && (
          <div className="ed-preview-fullscreen-bar">
            <span className="ed-preview-fullscreen-label">Aperçu plein écran</span>
            <button className="ed-preview-fullscreen-back" onClick={() => setPreviewMode(false)}>
              ← Retour
            </button>
          </div>
        )}
        {!previewMode && (
          <div className="ed-preview-toolbar">
            <span className="ed-preview-toolbar-label">Aperçu</span>
            <button className="ed-fullscreen-btn" onClick={() => setPreviewMode(true)}>
              <Eye size={13} />
              Plein écran
            </button>
          </div>
        )}
        <div className="ed-preview-container">
          {selected && <PackagePreview pkg={selected} />}
        </div>
      </div>

      {!previewMode && (
        <div className="ed-editor-panel">
          <div className="ed-editor-header">
            <span className="ed-editor-title">
              <Settings size={13} />
              Éditeur
            </span>
            <button
              disabled={saveState === "saving"}
              onClick={handleSave}
              className={`ed-save-btn ${saveState}`}
            >
              {saveState === "saving" && (
                <>
                  <div className="ed-save-spinner" />
                  Enregistrement...
                </>
              )}
              {saveState === "success" && (
                <>
                  <Check size={14} />
                  Sauvegardé
                </>
              )}
              {saveState === "error" && (
                <>
                  <X size={14} />
                  Échec
                </>
              )}
              {saveState === "idle" && (
                <>
                  <Save size={14} />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
          {selected && (
            <>
              <HeroEditor pkg={selected} update={update} />
              <GalleryEditor pkg={selected} update={update} />
              <SectionsEditor pkg={selected} update={update} />
              <DaysEditor pkg={selected} update={update} />
              <HotelsEditor pkg={selected} update={update} />
              <SupplimentsCard pkg={selected} update={update} />
              <DatesEditor pkg={selected} update={update} />
              <TabsEditor pkg={selected} update={update} />
            </>
          )}
        </div>
      )}

      {!previewMode && chatMode && selected && (
        <AIAgentPanel pkg={selected} onUpdate={update} />
      )}
    </div>
  );
}