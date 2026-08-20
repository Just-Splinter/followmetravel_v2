import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  background: "#fff",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 6,
  display: "block",
};

/**
 * A client that exists before any booking — a prospect noted down (phone
 * call, walk-in) rather than someone who came through a reservation. Kept
 * deliberately minimal: name/email/phone/notes, nothing booking-specific.
 */
export default function AddClientModal({ open, onClose, onCreate, notify }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", phone: "", notes: "" });
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      });
      notify?.("Client ajouté");
      onClose();
    } catch (err) {
      setError(err?.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Ajouter un client</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Prospect ou contact sans réservation pour l'instant</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 6, borderRadius: 6, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nom complet <span style={{ color: "#dc2626" }}>*</span></label>
            <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nom du client" autoFocus />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06 12 34 56 78" />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex: intéressé par un séjour à Dakhla en juillet, rappeler la semaine prochaine…"
            />
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px", borderRadius: 8, border: "none", background: "#ff750e", color: "#fff",
                fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {saving ? "Enregistrement…" : (<><Save size={14} /> Ajouter</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
