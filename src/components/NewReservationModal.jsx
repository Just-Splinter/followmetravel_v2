import { useState, useEffect, useMemo, useRef } from "react";
import db, { Collections } from "../services/database";
import { useClients } from "../context/ClientsContext";
import { mergeClients } from "../services/clients";
import { X, Save, Search, UserCheck, UserPlus, Check } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "paid", label: "Payée" },
  { value: "completed", label: "Terminée" },
  { value: "cancelled", label: "Annulée" },
];

const EMPTY = {
  packageId: "",
  userName: "",
  userEmail: "",
  userPhone: "",
  dateFrom: "",
  dateTo: "",
  totalPax: 2,
  category: "",
  totalEstimate: "",
  status: "pending",
};

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

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Manual "phone/walk-in booking" entry — bypasses the public site's
 * BookingFlow wizard and its captcha-protected Appwrite Function entirely.
 * Deliberately simpler than that wizard: no room-by-room hotel picker, the
 * admin just types the client info, dates and total directly since they're
 * the trusted source here (there's no client input to distrust). Hotel/room
 * detail can still be added afterward via the reservation's own edit view.
 */
export default function NewReservationModal({ open, onClose, onCreate, notify, reservations = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [packages, setPackages] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const { clients: clientDocs, findAllClients } = useClients();
  const [clientMode, setClientMode] = useState("new"); // "new" | "existing"
  const [clientQuery, setClientQuery] = useState("");
  const [pickedClient, setPickedClient] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setErrors({});
    setClientMode("new");
    setClientQuery("");
    setPickedClient(null);
    setLoadingPkgs(true);
    db.listAll(Collections.PRODUCTS)
      .then((res) => setPackages((res.documents ?? res).filter((p) => p.title)))
      .catch(() => setPackages([]))
      .finally(() => setLoadingPkgs(false));
    findAllClients().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const mergedClients = useMemo(() => mergeClients(clientDocs, reservations), [clientDocs, reservations]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const pool = q
      ? mergedClients.filter((c) =>
          c.userName.toLowerCase().includes(q) || c.userEmail.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
        )
      : mergedClients;
    return pool.slice(0, 8);
  }, [mergedClients, clientQuery]);

  const pickClient = (c) => {
    setPickedClient(c);
    setClientQuery(c.userName);
    setPickerOpen(false);
    setForm((f) => ({ ...f, userName: c.userName, userEmail: c.userEmail, userPhone: c.phone }));
  };

  const switchToNewClient = () => {
    setClientMode("new");
    setPickedClient(null);
    setClientQuery("");
    setForm((f) => ({ ...f, userName: "", userEmail: "", userPhone: "" }));
  };

  const selectedPkg = useMemo(
    () => packages.find((p) => p.$id === form.packageId) || null,
    [packages, form.packageId]
  );

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  if (!open) return null;

  const validate = () => {
    const e = {};
    if (!form.packageId) e.packageId = "Choisissez un package";
    if (!form.userName.trim()) e.userName = "Nom requis";
    if (!form.dateFrom.trim()) e.dateFrom = "Date requise";
    if (!Number(form.totalPax) || Number(form.totalPax) <= 0) e.totalPax = "Nombre de voyageurs invalide";
    if (form.totalEstimate === "" || Number.isNaN(Number(form.totalEstimate)) || Number(form.totalEstimate) < 0) {
      e.totalEstimate = "Montant invalide";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onCreate({
        packageId: form.packageId,
        packageTitle: selectedPkg?.title || "",
        hotels: "[]",
        dateFrom: form.dateFrom.trim(),
        dateTo: form.dateTo.trim() || form.dateFrom.trim(),
        totalPax: Number(form.totalPax),
        participants: JSON.stringify([
          { fullName: form.userName.trim(), phone: form.userPhone.trim(), email: form.userEmail.trim() },
        ]),
        supplements: [],
        totalEstimate: Number(form.totalEstimate),
        userId: pickedClient?.userId || "",
        userEmail: form.userEmail.trim(),
        userName: form.userName.trim(),
        category: form.category.trim() || null,
        status: form.status,
      });
      notify?.("Réservation créée");
      onClose();
    } catch (err) {
      notify?.(err?.message || "Erreur lors de la création", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 20px", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Nouvelle réservation</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Réservation créée manuellement (téléphone, agence…)</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 6, borderRadius: 6, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, maxHeight: "70vh", overflowY: "auto" }}>
          <Field label="Package" required>
            <select
              style={inputStyle}
              value={form.packageId}
              onChange={(e) => set("packageId", e.target.value)}
              disabled={loadingPkgs}
            >
              <option value="">{loadingPkgs ? "Chargement…" : "Sélectionner un package"}</option>
              {packages.map((p) => (
                <option key={p.$id} value={p.$id}>{p.title}</option>
              ))}
            </select>
            {errors.packageId && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.packageId}</p>}
          </Field>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setClientMode("existing")}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: clientMode === "existing" ? "1.5px solid #ff750e" : "1.5px solid #e2e8f0",
                background: clientMode === "existing" ? "rgba(255,117,14,.08)" : "#fff",
                color: clientMode === "existing" ? "#ff750e" : "#64748b",
              }}
            >
              <UserCheck size={14} /> Client existant
            </button>
            <button
              type="button"
              onClick={switchToNewClient}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: clientMode === "new" ? "1.5px solid #ff750e" : "1.5px solid #e2e8f0",
                background: clientMode === "new" ? "rgba(255,117,14,.08)" : "#fff",
                color: clientMode === "new" ? "#ff750e" : "#64748b",
              }}
            >
              <UserPlus size={14} /> Nouveau client
            </button>
          </div>

          {clientMode === "existing" && (
            <div ref={pickerRef} style={{ position: "relative", marginBottom: 16 }}>
              <label style={labelStyle}>Rechercher un client</label>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  value={clientQuery}
                  onChange={(e) => { setClientQuery(e.target.value); setPickerOpen(true); setPickedClient(null); }}
                  onFocus={() => setPickerOpen(true)}
                  placeholder="Nom, email ou téléphone…"
                />
                {pickedClient && (
                  <Check size={15} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#16a34a" }} />
                )}
              </div>
              {pickerOpen && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff",
                  border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.12)",
                  maxHeight: 220, overflowY: "auto", zIndex: 10,
                }}>
                  {clientMatches.length === 0 ? (
                    <p style={{ padding: "12px 14px", fontSize: 12.5, color: "#94a3b8", margin: 0 }}>Aucun client trouvé.</p>
                  ) : (
                    clientMatches.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => pickClient(c)}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                          border: "none", background: "transparent", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{c.userName}</div>
                        <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                          {[c.userEmail, c.phone].filter(Boolean).join(" · ") || "Aucun contact enregistré"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {errors.userName && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.userName}</p>}
            </div>
          )}

          {clientMode === "new" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Nom du client" required>
                  <input style={inputStyle} value={form.userName} onChange={(e) => set("userName", e.target.value)} placeholder="Nom complet" />
                  {errors.userName && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.userName}</p>}
                </Field>
                <Field label="Téléphone">
                  <input style={inputStyle} value={form.userPhone} onChange={(e) => set("userPhone", e.target.value)} placeholder="06 12 34 56 78" />
                </Field>
              </div>

              <Field label="Email">
                <input type="email" style={inputStyle} value={form.userEmail} onChange={(e) => set("userEmail", e.target.value)} placeholder="client@example.com" />
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Sans email, aucune notification ne pourra être envoyée au client pour cette réservation.
                </p>
              </Field>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Date de départ (JJ/MM)" required>
              <input style={inputStyle} value={form.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} placeholder="15/06" />
              {errors.dateFrom && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.dateFrom}</p>}
            </Field>
            <Field label="Date de retour (JJ/MM)">
              <input style={inputStyle} value={form.dateTo} onChange={(e) => set("dateTo", e.target.value)} placeholder="22/06" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Voyageurs" required>
              <input type="number" min="1" style={inputStyle} value={form.totalPax} onChange={(e) => set("totalPax", e.target.value)} />
              {errors.totalPax && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.totalPax}</p>}
            </Field>
            <Field label="Catégorie">
              <input style={inputStyle} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Ex: 4 Étoiles" />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Montant total (DH)" required>
              <input type="number" min="0" style={inputStyle} value={form.totalEstimate} onChange={(e) => set("totalEstimate", e.target.value)} placeholder="18500" />
              {errors.totalEstimate && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{errors.totalEstimate}</p>}
            </Field>
            <Field label="Statut">
              <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
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
              {saving ? "Enregistrement…" : (<><Save size={14} /> Créer la réservation</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
