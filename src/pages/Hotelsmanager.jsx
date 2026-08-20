import { useState, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  Hotel, MapPin, Star, Plus, Edit, Trash2, Search, Save, X, Image as ImageIcon, BedDouble,
} from "lucide-react";
import { useHotels, parseHotelRoomTypes } from "../context/HotelsContext";
import StorageService from "../services/storage";
import { ROOM_TYPES } from "../services/roomTypes";

// Design Tokens
const T = {
  primary: "#7F77DD",
  primaryDim: "#EEEDFE",
  secondary: "#1D9E75",
  accent: "#D85A30",
  gray: "#64748b",
  lightGray: "#f1f5f9",
};

// ─── Star Rating ────────────────────────────────────────────────────────────
const StarRating = ({ rating, maxStars = 5, size = 16, interactive = false, onRate }) => {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: maxStars }).map((_, i) => {
        const starValue = i + 1;
        const filled = interactive ? (hover || rating) >= starValue : rating >= starValue;
        return (
          <Star
            key={i}
            size={size}
            onClick={() => interactive && onRate && onRate(starValue)}
            onMouseEnter={() => interactive && setHover(starValue)}
            onMouseLeave={() => interactive && setHover(0)}
            style={{
              cursor: interactive ? "pointer" : "default",
              fill: filled ? "#FBBF24" : "none",
              stroke: filled ? "#FBBF24" : "#CBD5E1",
              transition: "all 0.2s",
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Badge ──────────────────────────────────────────────────────────────────
const Badge = ({ children, color = "primary" }) => {
  const colors = {
    primary: { bg: T.primaryDim, text: T.primary, border: T.primary },
    gray: { bg: T.lightGray, text: T.gray, border: "#CBD5E1" },
  };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 8px", fontSize: 11, fontWeight: 600, borderRadius: 6,
        backgroundColor: colors[color].bg, color: colors[color].text,
        border: `1px solid ${colors[color].border}`,
      }}
    >
      {children}
    </span>
  );
};

// ─── Modal ──────────────────────────────────────────────────────────────────
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff", borderRadius: 12, width: "100%", maxWidth: 560,
          maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: T.gray }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
export default function HotelManager() {
  const { hotels, loading, createHotel, updateHotel, deleteHotel } = useHotels();
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [minStars, setMinStars] = useState(0);
  const [modalMode, setModalMode] = useState(null); // null | "create" | "edit"
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const cities = useMemo(
    () => [...new Set(hotels.map((h) => h.city).filter(Boolean))].sort(),
    [hotels]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return hotels.filter((h) => {
      const matchesSearch = !q || h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q);
      const matchesCity = !cityFilter || h.city === cityFilter;
      const matchesStars = (h.stars || 0) >= minStars;
      return matchesSearch && matchesCity && matchesStars;
    });
  }, [hotels, searchTerm, cityFilter, minStars]);

  const stats = useMemo(() => ({
    total: hotels.length,
    cities: cities.length,
    avgStars: hotels.length ? hotels.reduce((a, h) => a + (Number(h.stars) || 0), 0) / hotels.length : 0,
  }), [hotels, cities]);

  const openCreate = () => { setEditing({ name: "", city: "", address: "", stars: 3, image: "", roomTypes: [] }); setModalMode("create"); };
  const openEdit = (h) => { setEditing({ ...h, roomTypes: parseHotelRoomTypes(h.rooms) }); setModalMode("edit"); };
  const close = () => { setModalMode(null); setEditing(null); };

  const save = async () => {
    if (!editing.name?.trim() || !editing.city?.trim()) {
      toast.error("Nom et ville sont requis.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        city: editing.city.trim(),
        address: editing.address || "",
        stars: Number(editing.stars) || 0,
        image: editing.image || "",
        rooms: JSON.stringify(
          (editing.roomTypes || [])
            .map((r) => ({ type: r.type?.trim(), price: Number(r.price) || 0 }))
            .filter((r) => r.type)
        ),
      };
      if (modalMode === "create") {
        await createHotel(payload);
        toast.success("Hôtel ajouté.");
      } else {
        await updateHotel(editing.$id, payload);
        toast.success("Hôtel mis à jour.");
      }
      close();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h) => {
    if (!window.confirm(`Supprimer "${h.name}" ? Les packages qui le référencent déjà ne sont pas modifiés.`)) return;
    try {
      await deleteHotel(h.$id);
      toast.success("Hôtel supprimé.");
    } catch (err) {
      toast.error(err.message || "Erreur lors de la suppression.");
    }
  };

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>Gestion Hôtelière</h1>
        <p style={{ color: T.gray, margin: 0 }}>
          Catalogue partagé — utilisé pour choisir un hôtel dans l'éditeur de packages et dans les réservations.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Hotel} label="Total Hôtels" value={stats.total} color={T.primary} />
        <StatCard icon={MapPin} label="Villes" value={stats.cities} color={T.secondary} />
        <StatCard icon={Star} label="Note Moyenne" value={stats.avgStars.toFixed(1)} color="#FBBF24" />
      </div>

      <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 250, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.gray }} />
            <input
              type="text"
              placeholder="Rechercher un hôtel ou une ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 40px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none" }}
            />
          </div>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
          >
            <option value="">Toutes les villes</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select
            value={minStars}
            onChange={(e) => setMinStars(Number(e.target.value))}
            style={{ padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
          >
            <option value={0}>Toutes étoiles</option>
            {[3, 4, 5].map((n) => <option key={n} value={n}>{n}★+</option>)}
          </select>
          <button
            onClick={openCreate}
            style={{ padding: "10px 20px", backgroundColor: T.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
          >
            <Plus size={18} />
            Nouvel Hôtel
          </button>
        </div>
      </div>

      {loading && !hotels.length ? (
        <p style={{ color: T.gray, textAlign: "center", padding: 40 }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 12, border: "1.5px dashed #e2e8f0" }}>
          <Hotel size={32} style={{ color: T.gray, marginBottom: 12 }} />
          <p style={{ color: T.gray, margin: "0 0 16px" }}>
            {hotels.length === 0 ? "Aucun hôtel dans le catalogue pour l'instant." : "Aucun hôtel ne correspond à ces filtres."}
          </p>
          {hotels.length === 0 && (
            <button onClick={openCreate} style={{ padding: "10px 20px", backgroundColor: T.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              Ajouter le premier hôtel
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {filtered.map((h) => (
            <HotelCard key={h.$id} hotel={h} onEdit={() => openEdit(h)} onDelete={() => remove(h)} />
          ))}
        </div>
      )}

      <Modal isOpen={!!modalMode} onClose={close} title={modalMode === "create" ? "Nouvel hôtel" : editing?.name || "Hôtel"}>
        {editing && (
          <HotelForm hotel={editing} onChange={setEditing} onSave={save} onCancel={close} saving={saving} />
        )}
      </Modal>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>{value}</div>
        <div style={{ fontSize: 13, color: T.gray, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Hotel Card ─────────────────────────────────────────────────────────────
function HotelCard({ hotel, onEdit, onDelete }) {
  const roomTypes = parseHotelRoomTypes(hotel.rooms);
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
      <div style={{ height: 150, backgroundColor: T.lightGray, backgroundImage: hotel.image ? `url(${hotel.image})` : "none", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!hotel.image && <Hotel size={28} style={{ color: "#cbd5e1" }} />}
      </div>
      <div style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 600 }}>{hotel.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.gray, marginBottom: 10, fontSize: 13 }}>
          <MapPin size={13} />
          {hotel.city}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <StarRating rating={hotel.stars || 0} size={13} />
          {hotel.address && <Badge color="gray">{hotel.address}</Badge>}
        </div>
        {roomTypes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <Badge color="primary"><BedDouble size={11} /> {roomTypes.length} type{roomTypes.length > 1 ? "s" : ""} de chambre</Badge>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: 8, backgroundColor: T.primaryDim, color: T.primary, border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Edit size={14} /> Modifier
          </button>
          <button onClick={onDelete} style={{ padding: 8, backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 6, cursor: "pointer" }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hotel Form ─────────────────────────────────────────────────────────────
function HotelForm({ hotel, onChange, onSave, onCancel, saving }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [newType, setNewType] = useState("");
  const roomTypes = hotel.roomTypes || [];

  const addType = (type, price = 0) => {
    const t = type.trim();
    if (!t || roomTypes.some((r) => r.type === t)) return;
    onChange({ ...hotel, roomTypes: [...roomTypes, { type: t, price }] });
    setNewType("");
  };
  const updateType = (i, field, val) =>
    onChange({ ...hotel, roomTypes: roomTypes.map((r, idx) => idx === i ? { ...r, [field]: val } : r) });
  const removeType = (i) =>
    onChange({ ...hotel, roomTypes: roomTypes.filter((_, idx) => idx !== i) });

  const quickAdd = ROOM_TYPES.filter((rt) => !roomTypes.some((r) => r.type === rt.label));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const uploaded = await StorageService.upload(file);
      onChange({ ...hotel, image: StorageService.getView(uploaded.$id) });
    } catch {
      toast.error("Erreur lors de l'upload de l'image.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <FormField label="Image">
        <div
          onClick={() => !uploading && inputRef.current.click()}
          style={{
            height: 120, borderRadius: 8, border: "1.5px dashed #e2e8f0", cursor: "pointer",
            backgroundColor: T.lightGray, backgroundImage: hotel.image ? `url(${hotel.image})` : "none",
            backgroundSize: "cover", backgroundPosition: "center",
            display: "flex", alignItems: "center", justifyContent: "center", color: T.gray, fontSize: 13,
          }}
        >
          {uploading ? "Upload…" : !hotel.image && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ImageIcon size={16} /> Choisir une image</span>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Nom de l'hôtel" required>
          <input type="text" value={hotel.name || ""} onChange={(e) => onChange({ ...hotel, name: e.target.value })} style={inputStyle} placeholder="Ex: Grand Hôtel" />
        </FormField>
        <FormField label="Ville" required>
          <input type="text" value={hotel.city || ""} onChange={(e) => onChange({ ...hotel, city: e.target.value })} style={inputStyle} placeholder="Ex: Marrakech" />
        </FormField>
      </div>
      <FormField label="Adresse">
        <input type="text" value={hotel.address || ""} onChange={(e) => onChange({ ...hotel, address: e.target.value })} style={inputStyle} />
      </FormField>
      <FormField label="Étoiles">
        <StarRating rating={hotel.stars || 0} interactive size={22} onRate={(v) => onChange({ ...hotel, stars: v })} />
      </FormField>

      <FormField label="Types de chambre & prix par défaut">
        {roomTypes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {roomTypes.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={r.type}
                  onChange={(e) => updateType(i, "type", e.target.value)}
                  style={{ ...inputStyle, flex: 2 }}
                  placeholder="Type (ex: Suite Junior)"
                />
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="number"
                    min={0}
                    value={r.price}
                    onChange={(e) => updateType(i, "price", Number(e.target.value))}
                    style={{ ...inputStyle, paddingRight: 36 }}
                    placeholder="Prix"
                    title="Prix par défaut (DH)"
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: T.gray, pointerEvents: "none" }}>DH</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeType(i)}
                  style={{ padding: 8, backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {quickAdd.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {quickAdd.map((rt) => (
              <button
                key={rt.key}
                type="button"
                onClick={() => addType(rt.label)}
                style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, color: T.primary, background: T.primaryDim, border: "none", borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Plus size={12} /> {rt.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(newType); } }}
            placeholder="Type personnalisé"
            style={inputStyle}
          />
          <button type="button" onClick={() => addType(newType)} style={{ ...saveButtonStyle, padding: "10px 16px", flexShrink: 0 }}>
            <Plus size={14} />
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: T.gray, margin: "8px 0 0" }}>
          En choisissant cet hôtel dans une formule de package, ces types et leurs prix remplacent les colonnes de prix actuelles.
        </p>
      </FormField>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
        <button onClick={onCancel} style={cancelButtonStyle}>Annuler</button>
        <button onClick={onSave} disabled={saving} style={{ ...saveButtonStyle, opacity: saving ? 0.6 : 1 }}>
          <Save size={16} />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children, required }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
        {label} {required && <span style={{ color: T.accent }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// Styles
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const saveButtonStyle = {
  padding: "10px 24px",
  backgroundColor: T.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
};

const cancelButtonStyle = {
  padding: "10px 24px",
  backgroundColor: T.lightGray,
  color: T.gray,
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
