import { useState, useCallback, useEffect, useRef } from "react";
import { AIAgentPanel } from "../components/AIAgent";
import { usePackages } from "../context/PackagesContext";
import MarketingPackagePreview from "../marketing/PackagePreview";
import { withTranslations, translationConfigured } from "../services/translate";
import { daysInMonth, parseDDMM, formatDDMM } from "../marketing/dates";
import HotelPicker from "../components/HotelPicker";
import { useClickOutside } from "../components/ClickOutSide";
import StorageService from "../services/storage";
import { normLabel, roomTypesFor } from "../services/roomTypes";
import { useHotels } from "../context/HotelsContext";
import { toast } from "react-toastify";
import {
  Save, Check, X, Plus, Upload,
  Eye, Image as ImageIcon,
  Calendar, Hotel, List, Tag, Settings, Palette
} from "lucide-react";

import '../styles/PackageeditorPage.css'
import { FORMULE_MODES, formuleMode, formuleNights } from "../services/formules";

// ─── Palettes ─────────────────────────────────────────────────────
const PALETTES = [
  { id: "orange", label: "Orange Solaire", swatch: "#ff750e", theme: { gold: "#ff750e", goldLight: "#fff4eb", dark: "#5E3B14", cream: "#FFF9F2", textDark: "#5A3712", textMuted: "#A06B35", navy: "#D97706", borderGold: "rgba(245,158,66,.22)" } },
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
const PALETTE_SIDEBAR_MIN = 64;
const PALETTE_SIDEBAR_MAX = 240;
const PALETTE_SIDEBAR_WIDTH_KEY = "ed-palette-sidebar-width";

/**
 * Vertical drag handle that resizes an element's width.
 * `dir` flips which way the width grows: 1 for a handle on the right edge
 * (dragging right widens), -1 for a handle on the left edge (dragging left widens).
 */
function ResizeHandle({ width, setWidth, min, max, className, dir = 1, label }) {
  const dragRef = useRef(null);

  const onPointerDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const delta = (e.clientX - dragRef.current.startX) * dir;
    setWidth(Math.min(max, Math.max(min, dragRef.current.startWidth + delta)));
  };

  const onPointerUp = (e) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
    />
  );
}

function PaletteSidebar({ pkg, update, onClose }) {
  const [customOpen, setCustomOpen] = useState(false);
  // Fixed width, not user-resizable (the resize handle lives on the editor
  // form panel instead) — still read from storage so an old resized value
  // from before that change keeps rendering the same width.
  const [width] = useState(() => {
    const stored = Number(localStorage.getItem(PALETTE_SIDEBAR_WIDTH_KEY));
    return stored >= PALETTE_SIDEBAR_MIN && stored <= PALETTE_SIDEBAR_MAX
      ? stored
      : PALETTE_SIDEBAR_MIN;
  });
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
    <div className="ed-palette-sidebar" style={{ "--ed-palette-width": `${width}px` }}>
      <div className="ed-palette-close" onClick={onClose} title="Masquer les couleurs">
        <X size={24} color="white" />
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

// Séjour (une ville, hôtels au choix) : nuits du séjour ; circuit : somme des étapes.
const hotelCategoryNights = formuleNights;

// Fixed columns before the price columns start: "Hôtel", "Ville", "Nuits", "★".
const priceColStart = 4;

/**
 * Per-package room allotment for one hotel row — the same physical hotel
 * can be pooled differently across packages, so this lives on the hotel row
 * itself (package data), not on the shared hotel catalog. `allotment` is a
 * plain array parallel to `hotel.cols`, only shown for room types this row
 * actually prices (cols[colIdx] > 0). The columns themselves come from
 * roomTypesFor(category) — the same helper BookingFlow uses — so the labels
 * shown here are exactly the `rooms[].type` strings a reservation will carry,
 * including custom columns ("Baby 1-2"), and dispo tracking matches 1:1.
 */
function HotelAllotmentRow({ hotel, roomTypes, packageId, getBooked, onUpdateFields }) {
  const allotment = hotel.allotment || [];
  const types = roomTypes.filter((rt) => Number(hotel.cols?.[rt.colIdx]) > 0);
  if (!types.length) return null;

  const updateAllotment = (colIdx, total) => {
    const next = [...allotment];
    next[colIdx] = total;
    onUpdateFields({ allotment: next });
  };

  return (
    <div className="ed-hotel-avail-row">
      {types.map((rt) => {
        const label = rt.label;
        const total = Number(allotment[rt.colIdx]) || 0;
        const booked = hotel.hotelId && packageId ? getBooked(hotel.hotelId, packageId, label) : 0;
        const over = total > 0 && booked > total;
        return (
          <div key={rt.key} className="ed-hotel-avail-item">
            <span className="ed-hotel-avail-label">{label}</span>
            <input
              type="number"
              min={0}
              value={allotment[rt.colIdx] ?? ""}
              onChange={(e) => updateAllotment(rt.colIdx, Number(e.target.value))}
              className="ed-hotel-avail-input"
              placeholder="Quota"
              title={`Chambres ${rt.label} allouées à ce package`}
            />
            {total > 0 && (
              <span className={`ed-hotel-avail-count ${over ? "over" : ""}`}>{booked}/{total}</span>
            )}
          </div>
        );
      })}
      <label className="ed-hotel-avail-block">
        <input
          type="checkbox"
          checked={!!hotel.blockWhenFull}
          onChange={(e) => onUpdateFields({ blockWhenFull: e.target.checked })}
        />
        Bloquer si complet
      </label>
    </div>
  );
}

function HotelCategoryItem({ category, packageId, isOpen, onToggle, onUpdate, onUpdateFields, onRemove, isOnly }) {
  const headers = category.tableHeaders || [];
  const hotels = category.hotels || [];
  const catRoomTypes = roomTypesFor(category);
  const totalNights = hotelCategoryNights(category);
  const { getBooked } = useHotels();

  const updateHeader = (idx, val) => {
    const h = [...headers];
    h[idx] = val;
    onUpdate("tableHeaders", h);
  };

  const updateHotel = (id, field, val) =>
    onUpdate("hotels", hotels.map(h => h.id === id ? { ...h, [field]: val } : h));

  // Picker selection touches name/city/stars together — three sequential
  // updateHotel() calls would each read the same stale `hotels` closure and
  // clobber each other, so this merges them in one pass instead. Undefined
  // keys are dropped (not applied as `undefined`): free-text typing only
  // sends {name, id: null}, and city/stars must survive that untouched.
  const updateHotelFields = (id, fields) => {
    const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    onUpdate("hotels", hotels.map(h => h.id === id ? { ...h, ...defined } : h));
  };

  const updateHotelCol = (id, colIdx, val) =>
    onUpdate("hotels", hotels.map(h => h.id === id ? { ...h, cols: h.cols.map((c, i) => i === colIdx ? val : c) } : h));

  const addHotel = () =>
    onUpdate("hotels", [...hotels, {
      // Nom vide : le sélecteur propose alors tout le catalogue d'hôtels.
      id: uid(), name: "", city: "", stars: 4, nights: 1,
      cols: headers.slice(priceColStart).map(() => "0"),
      allotment: [], blockWhenFull: false,
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

  // These two touch tableHeaders and every hotel's cols together — use the
  // combined updater, not two sequential onUpdate() calls (which would each
  // read the same stale `headers`/`hotels` closure and clobber each other).
  const addColHeader = () => {
    onUpdateFields({
      tableHeaders: [...headers, "Nouveau"],
      hotels: hotels.map(h => ({ ...h, cols: [...h.cols, "0"] })),
    });
  };

  const removeLastCol = () => {
    if (headers.length <= priceColStart + 1) return;
    onUpdateFields({
      tableHeaders: headers.slice(0, -1),
      hotels: hotels.map(h => ({ ...h, cols: h.cols.slice(0, -1) })),
    });
  };

  // Choix d'un hôtel du catalogue : la ligne est reliée (suivi de stock) et
  // reçoit les tarifs par défaut de l'hôtel, colonne par colonne (types de
  // chambre comparés par libellé). Rien n'est jamais effacé chez les autres
  // hôtels de la formule : un type de chambre absent de la formule devient
  // une colonne de plus, à 0 pour les autres lignes. Une seule mise à jour
  // (tableHeaders + hotels), cf. la note sur les mises à jour successives.
  const applyHotelPick = (hotelRowId, { id, name, city, stars, roomTypes }) => {
    // Saisie libre : le lien au catalogue tombe, le reste de la ligne est gardé.
    if (!id) {
      updateHotelFields(hotelRowId, { hotelId: null, name });
      return;
    }
    const row = hotels.find((h) => h.id === hotelRowId) || {};
    const priceHeaders = headers.slice(priceColStart);
    const catalog = new Map((roomTypes || []).map((rt) => [normLabel(rt.type), String(rt.price ?? 0)]));
    const missing = (roomTypes || []).map((rt) => rt.type).filter((t) => !priceHeaders.some((h) => normLabel(h) === normLabel(t)));
    const newHeaders = [...priceHeaders, ...missing];
    const fill = (labels, previous = []) => labels.map((l, i) => catalog.get(normLabel(l)) ?? previous[i] ?? "0");

    onUpdateFields({
      ...(missing.length ? { tableHeaders: [...headers.slice(0, priceColStart), ...newHeaders] } : {}),
      hotels: hotels.map((h) =>
        h.id === hotelRowId
          ? { ...h, hotelId: id, name, city, stars, cols: fill(newHeaders, row.cols) }
          : missing.length ? { ...h, cols: [...(h.cols || []), ...missing.map(() => "0")] } : h
      ),
    });
    if (roomTypes?.length) {
      toast.info(
        `Tarifs de « ${name} » repris du catalogue.` +
          (missing.length ? ` Colonne(s) ajoutée(s) : ${missing.join(", ")} — tarifs des autres hôtels conservés.` : "")
      );
    }
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

          <div className="ed-field-row">
            <div className="ed-field">
              <label className="ed-field-label">Type de formule</label>
              <select className="ed-input" value={category.mode || ""} onChange={e => onUpdate("mode", e.target.value)}>
                {FORMULE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <Field label="Restauration" value={category.board || ""} placeholder="ex: Demi-pension" onChange={v => onUpdate("board", v)} />
          </div>

          <div className="ed-gallery-hint">
            {formuleMode(category) === "circuit"
              ? <>Circuit : le groupe passe par chaque hôtel (une étape par ligne). Durée calculée : <strong>{totalNights} Nuits / {totalNights + 1} Jours</strong></>
              : <>Séjour dans une ville : les hôtels sont au choix du client, chacun avec ses tarifs. Durée : <strong>{totalNights} Nuits / {totalNights + 1} Jours</strong></>}
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
            <div key={hotel.id}>
              <div className="ed-hotel-row" style={{ flexWrap: "wrap" }}>
                <HotelPicker
                  value={hotel.name}
                  linked={!!hotel.hotelId}
                  onSelect={(picked) => applyHotelPick(hotel.id, picked)}
                  theme="dark"
                  inputClassName="ed-hotel-name-input"
                  style={{ flex: 2, minWidth: 100 }}
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

              {hotel.hotelId ? (
                <HotelAllotmentRow
                  hotel={hotel}
                  roomTypes={catRoomTypes}
                  packageId={packageId}
                  getBooked={getBooked}
                  onUpdateFields={(fields) => updateHotelFields(hotel.id, fields)}
                />
              ) : (
                <div className="ed-hotel-avail-hint">
                  Choisissez un hôtel dans le catalogue (pas du texte libre) pour activer le suivi de disponibilité.
                </div>
              )}
            </div>
          ))}
          <AddBtn label="Ajouter un hôtel" onClick={addHotel} />

          <Field label="Note bas de tableau" value={category.note || ""} onChange={v => onUpdate("note", v)} />
        </div>
      )}
    </div>
  );
}

function HotelsEditor({ pkg, packageId, update }) {
  const categories = pkg.hotelCategories || [];
  const [openId, setOpenId] = useState(categories[0]?.id ?? null);
  const { refreshAvailability } = useHotels();
  useEffect(() => { refreshAvailability(); }, [refreshAvailability]);

  const updateCategory = (catId, field, val) =>
    update("hotelCategories", categories.map(c => c.id === catId ? { ...c, [field]: val } : c));

  // Overriding price columns from a picked hotel's room types touches both
  // tableHeaders and every hotel's cols in one go — two sequential
  // updateCategory() calls would each read the same stale `categories`
  // closure and clobber each other.
  const updateCategoryFields = (catId, fields) =>
    update("hotelCategories", categories.map(c => c.id === catId ? { ...c, ...fields } : c));

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
            packageId={packageId}
            isOpen={openId === cat.id}
            onToggle={() => setOpenId(openId === cat.id ? null : cat.id)}
            onUpdate={(field, val) => updateCategory(cat.id, field, val)}
            onUpdateFields={(fields) => updateCategoryFields(cat.id, fields)}
            onRemove={() => removeCategory(cat.id)}
            isOnly={categories.length <= 1}
          />
        </div>
      ))}
      <AddBtn label="Ajouter une formule (ex: 5 Étoiles)" onClick={addCategory} />
    </Accordion>
  );
}

// ─── Dates de départ ────────────────────────────────────────────
// Stored as year-less "DD/MM" strings — see marketing/dates.js, which owns
// parsing/formatting so the editor and the public site can't drift apart.
// Calendar-only entry (see PeriodPicker below): day/month <select> pairs
// used to sit here too, but picking blind from two dropdowns with no
// visual sense of the resulting window was the actual complaint — the
// calendar is now the only way in, and it displays the resulting period
// directly on its own trigger instead of leaving two "Jour/Mois"
// placeholders showing until both are picked.
const MONTHS_FULL_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS_MON_FR = ["L", "M", "M", "J", "V", "S", "D"];

const sameEndpoint = (a, b) => !!a && !!b && a.day === b.day && a.month === b.month;

/**
 * Grid cells for one month view, Monday-first, with greyed leading/trailing
 * days from adjacent months for visual continuity. GRID_REF_YEAR only
 * decides which weekday day 1 falls on for layout — day *counts* per month
 * come from daysInMonth() (marketing/dates.js), which always treats Feb as
 * 28 days, so the grid never offers a 29/02 that parseDDMM would reject.
 */
const GRID_REF_YEAR = 2023;
function monthCells(month) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextMonth = month === 12 ? 1 : month + 1;
  const total = daysInMonth(month);
  const prevTotal = daysInMonth(prevMonth);
  const lead = (new Date(GRID_REF_YEAR, month - 1, 1).getDay() + 6) % 7; // Mon-first offset

  const cells = [];
  for (let i = lead - 1; i >= 0; i--) cells.push({ day: prevTotal - i, month: prevMonth, out: true });
  for (let d = 1; d <= total; d++) cells.push({ day: d, month, out: false });
  for (let d = 1; cells.length < 42; d++) cells.push({ day: d, month: nextMonth, out: true });
  return cells;
}

/**
 * Calendar-only period picker — the trigger itself shows the resolved
 * "DD/MM → DD/MM" once both ends are picked (or a placeholder while empty),
 * so the row always reads as a period rather than two blank inputs. First
 * click sets "from", second sets "to" — no chronological guard between them
 * (unlike a real-date range picker), because a "to" earlier than "from" is
 * a legitimate year-wrap window here (e.g. 28/12 → 05/01), exactly what the
 * "reversed" info-warning in DatesEditor already expects rather than
 * rejects.
 */
function PeriodPicker({ from, to, onPick }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({ from: parseDDMM(from), to: parseDDMM(to) }));
  const [viewMonth, setViewMonth] = useState(() => parseDDMM(from)?.month || new Date().getMonth() + 1);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const parsedFrom = parseDDMM(from);
  const parsedTo = parseDDMM(to);
  const hasPeriod = !!(parsedFrom && parsedTo);

  const openPicker = () => {
    setDraft({ from: parsedFrom, to: parsedTo });
    setViewMonth(parsedFrom?.month || new Date().getMonth() + 1);
    setOpen(true);
  };

  const pick = (cell) => {
    const point = { day: cell.day, month: cell.month };
    setDraft((d) => (!d.from || (d.from && d.to) ? { from: point, to: null } : { ...d, to: point }));
  };

  const confirm = () => {
    if (!draft.from || !draft.to) return;
    onPick(formatDDMM(draft.from.day, draft.from.month), formatDDMM(draft.to.day, draft.to.month));
    setOpen(false);
  };

  const cellClass = (cell) => {
    const out = ["ed-cal-day"];
    if (cell.out) out.push("out");
    if (sameEndpoint(cell, draft.from) || sameEndpoint(cell, draft.to)) out.push("edge");
    else if (
      draft.from && draft.to && draft.from.month === draft.to.month && cell.month === draft.from.month &&
      cell.day > Math.min(draft.from.day, draft.to.day) && cell.day < Math.max(draft.from.day, draft.to.day)
    ) out.push("mid");
    return out.join(" ");
  };

  return (
    <div ref={ref} className="ed-cal-trigger-wrap">
      <button
        type="button"
        className={`ed-period-trigger ${hasPeriod ? "" : "empty"}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <Calendar size={13} />
        <span>
          {hasPeriod
            ? `${formatDDMM(parsedFrom.day, parsedFrom.month)} → ${formatDDMM(parsedTo.day, parsedTo.month)}`
            : "Sélectionner une période"}
        </span>
      </button>
      {open && (
        <div className="ed-cal-pop">
          <div className="ed-cal-head">
            <button type="button" onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))} aria-label="Mois précédent">‹</button>
            <b>{MONTHS_FULL_FR[viewMonth - 1]}</b>
            <button type="button" onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))} aria-label="Mois suivant">›</button>
          </div>
          <div className="ed-cal-grid">
            {WEEKDAYS_MON_FR.map((w, i) => <span key={i} className="ed-cal-dow">{w}</span>)}
            {monthCells(viewMonth).map((cell, i) => (
              <button key={i} type="button" className={cellClass(cell)} onClick={() => pick(cell)}>
                {cell.day}
              </button>
            ))}
          </div>
          <div className="ed-cal-foot">
            <span className="ed-cal-chip">
              {draft.from ? formatDDMM(draft.from.day, draft.from.month) : "—"}
              {" → "}
              {draft.to ? formatDDMM(draft.to.day, draft.to.month) : "—"}
            </span>
            <div className="ed-cal-actions">
              <button type="button" className="ed-cal-clear" onClick={() => setDraft({ from: null, to: null })}>Effacer</button>
              <button type="button" className="ed-cal-confirm" disabled={!draft.from || !draft.to} onClick={confirm}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DatesEditor({ pkg, update }) {
  const dates = pkg.departureDates || [];

  // Sets from/to together in one update — writing them via two sequential
  // single-field updates would each read the same stale `dates` closure and
  // the second call would silently drop the first's change (the exact bug
  // pattern already fixed elsewhere in this file).
  const updateDateFields = (id, fields) =>
    update("departureDates", dates.map(d => d.id === id ? { ...d, ...fields } : d));

  const addDate = () =>
    update("departureDates", [...dates, { id: uid(), from: "", to: "" }]);

  const removeDate = (id) =>
    update("departureDates", dates.filter(d => d.id !== id));

  return (
    <Accordion title="Dates de départ" icon={<Calendar size={14} />}>
      <div className="ed-gallery-hint">
        Fenêtre de départ, jour/mois sans année (valable chaque année). Les deux
        dates doivent être renseignées pour que l'entrée apparaisse sur le site.
        Par date : supplément (ou réduction, négatif) par voyageur, nombre de
        places vendables (vide = illimité), départ garanti, fermeture des ventes.
      </div>
      {dates.map(d => {
        const from = parseDDMM(d.from);
        const to = parseDDMM(d.to);
        const incomplete = !from || !to;
        const reversed = from && to &&
          (to.month < from.month || (to.month === from.month && to.day < from.day));

        return (
          <div key={d.id}>
            <div className={`ed-date-row ${incomplete ? "invalid" : ""}`}>
              <PeriodPicker
                from={d.from}
                to={d.to}
                onPick={(from, to) => updateDateFields(d.id, { from, to })}
              />
              <RemoveBtn onClick={() => removeDate(d.id)} />
            </div>
            <div className="ed-date-options">
              <label>
                Supplément / pers. (DH)
                <input className="ed-input" type="number" step="50" value={d.supplement ?? ""} placeholder="0"
                  onChange={(e) => updateDateFields(d.id, { supplement: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </label>
              <label>
                Places
                <input className="ed-input" type="number" min="0" value={d.capacity ?? ""} placeholder="illimité"
                  onChange={(e) => updateDateFields(d.id, { capacity: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </label>
              <label className="ed-date-check">
                <input type="checkbox" checked={!!d.guaranteed} onChange={(e) => updateDateFields(d.id, { guaranteed: e.target.checked })} />
                Départ garanti
              </label>
              <label className="ed-date-check">
                <input type="checkbox" checked={!!d.closed} onChange={(e) => updateDateFields(d.id, { closed: e.target.checked })} />
                Ventes fermées
              </label>
            </div>
            {incomplete && (
              <div className="ed-date-warning error">
                Date incomplète — n'apparaîtra pas sur le site tant qu'elle n'est pas complète.
              </div>
            )}
            {!incomplete && reversed && (
              <div className="ed-date-warning info">
                La fin précède le début : la période chevauche le changement d'année.
              </div>
            )}
          </div>
        );
      })}
      <AddBtn label="Ajouter une date" onClick={addDate} />
    </Accordion>
  );
}

function CancellationEditor({ pkg, update }) {
  const custom = Array.isArray(pkg.cancellationPolicy) && pkg.cancellationPolicy.length > 0;
  const tiers = custom ? pkg.cancellationPolicy : [];
  const setTier = (i, key, value) =>
    update("cancellationPolicy", tiers.map((t, n) => (n === i ? { ...t, [key]: Number(value) || 0 } : t)));

  return (
    <Accordion title="Conditions d'annulation" icon={<Calendar size={14} />}>
      <div className="ed-gallery-hint">
        Par défaut, ce package applique les conditions de la fiche agence (Paramètres → Agence).
        Personnalisez-les ici si ce voyage a ses propres règles (billets non remboursables, haute saison…).
      </div>
      {!custom ? (
        <AddBtn label="Définir des conditions propres à ce package" onClick={() => update("cancellationPolicy", [
          { daysBefore: 30, feePercent: 10 }, { daysBefore: 15, feePercent: 30 }, { daysBefore: 0, feePercent: 100 },
        ])} />
      ) : (
        <>
          {tiers.map((t, i) => (
            <div key={i} className="ed-date-options">
              <label>À partir de (jours avant)<input className="ed-input" type="number" min="0" value={t.daysBefore} onChange={(e) => setTier(i, "daysBefore", e.target.value)} /></label>
              <label>Frais (%)<input className="ed-input" type="number" min="0" max="100" value={t.feePercent} onChange={(e) => setTier(i, "feePercent", e.target.value)} /></label>
              <RemoveBtn onClick={() => update("cancellationPolicy", tiers.filter((_, n) => n !== i))} />
            </div>
          ))}
          <AddBtn label="Ajouter un palier" onClick={() => update("cancellationPolicy", [...tiers, { daysBefore: 0, feePercent: 100 }])} />
          <AddBtn label="Revenir aux conditions de l'agence" onClick={() => update("cancellationPolicy", [])} />
        </>
      )}
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
const EDITOR_PANEL_MIN = 320;
const EDITOR_PANEL_MAX = 720;
const EDITOR_PANEL_WIDTH_KEY = "ed-editor-panel-width";
const EDITOR_PANEL_DEFAULT = 440;

// ─── Main Component ───────────────────────────────────────────────
export default function PackageEditorPage({ pkg, onSave, onClose }) {

  const { updatePackage } = usePackages();
  const [editorWidth, setEditorWidth] = useState(() => {
    const stored = Number(localStorage.getItem(EDITOR_PANEL_WIDTH_KEY));
    return stored >= EDITOR_PANEL_MIN && stored <= EDITOR_PANEL_MAX
      ? stored
      : EDITOR_PANEL_DEFAULT;
  });

  useEffect(() => {
    localStorage.setItem(EDITOR_PANEL_WIDTH_KEY, String(editorWidth));
  }, [editorWidth]);

  const [packages, setPackages] = useState(() => pkg ? [{
    ...pkg.data,
    id: 1,
    paletteId: pkg.data?.paletteId || "orange",
    customTheme: { ...DEFAULT_CUSTOM_THEME, ...(pkg.data?.customTheme || {}) },
  }] : []);
  const [selectedId] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
        //...pkg,
        data: JSON.stringify(selected),
      });
      setSaveState("success");
      toast.success("Package sauvegardé avec succès !");
      onSave && onSave(result);
      // refresh EN/AR content translations in the background (one LLM call)
      if (translationConfigured()) {
        withTranslations(selected)
          .then((next) => {
            if (next === selected) return;
            return updatePackage(pkg.$id, { data: JSON.stringify(next) }).then(() =>
              toast.success("Traductions EN/AR mises à jour")
            );
          })
          .catch((e) => toast.warn("Traductions non générées : " + (e?.message || e)));
      }
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
      {/* Palette de couleurs masquée par défaut ; « Couleurs » l'affiche. */}
      {!previewMode && selected && paletteOpen && (
        <PaletteSidebar pkg={selected} update={update} onClose={() => setPaletteOpen(false)} />
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
            <div className="ed-preview-toolbar-actions">
              <button className={`ed-toolbar-btn ${paletteOpen ? "active" : ""}`} onClick={() => setPaletteOpen((v) => !v)} title="Couleurs de la fiche">
                <Palette size={13} />
                Couleurs
              </button>
              <button className="ed-fullscreen-btn" onClick={() => setPreviewMode(true)}>
                <Eye size={13} />
                Plein écran
              </button>
              <button className="ed-toolbar-btn ed-toolbar-close" onClick={onClose} title="Fermer l'éditeur" aria-label="Fermer l'éditeur">
                <X size={15} />
              </button>
            </div>
          </div>
        )}
        <div className="ed-preview-container">
          {selected && <MarketingPackagePreview data={selected} doc={pkg} />}
        </div>
      </div>

      {!previewMode && (
        <div className="ed-editor-panel" style={{ "--ed-editor-width": `${editorWidth}px` }}>
          <ResizeHandle
            width={editorWidth}
            setWidth={setEditorWidth}
            min={EDITOR_PANEL_MIN}
            max={EDITOR_PANEL_MAX}
            className="ed-editor-resize-handle"
            dir={-1}
            label="Redimensionner l'éditeur"
          />
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
              <HotelsEditor pkg={selected} packageId={pkg.$id} update={update} />
              <SupplimentsCard pkg={selected} update={update} />
              <DatesEditor pkg={selected} update={update} />
              <CancellationEditor pkg={selected} update={update} />
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
