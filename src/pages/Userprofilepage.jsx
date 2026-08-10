import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useReservation } from "../context/ReservationContext";

// ─── Hash Routing ─────────────────────────────────────────────────────────────
const VALID_TABS = ["profil", "reservations", "settings"];

function getTabFromHash() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    return VALID_TABS.includes(hash) ? hash : "profil";
}

function useHashTab() {
    const [tab, setTabState] = useState(getTabFromHash);
    useEffect(() => {
        const onHashChange = () => setTabState(getTabFromHash());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);
    const setTab = (key) => { window.location.hash = key; };
    return [tab, setTab];
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
    orange: "rgb(255,117,14)",
    orangeLight: "rgba(255,117,14,0.10)",
    orangeMid: "rgba(255,117,14,0.20)",
    orangeDark: "#e05a00",
    navy: "#1a1a2e",
    navyLight: "#2a2a4a",
    white: "#ffffff",
    offWhite: "#fdf8f4",
    cream: "#fff4ec",
    sand: "#f5e6d8",
    gray100: "#f9f9f9",
    gray200: "#f0ede9",
    gray300: "#ddd6cf",
    gray400: "#c8c0b8",
    gray600: "#8a7f78",
    gray800: "#3d3530",
    text: "#2b2320",
    radius: "12px",
    radiusSm: "8px",
    shadow: "0 2px 12px rgba(255,117,14,0.08)",
    shadowMd: "0 4px 24px rgba(255,117,14,0.13)",
};

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS = {
    confirmed: { label: "Confirmée",  bg: "rgba(22,163,74,0.10)",  color: "#16a34a", dot: "#16a34a"  },
    pending:   { label: "En attente", bg: "rgba(234,179,8,0.12)",  color: "#b45309", dot: "#eab308"  },
    cancelled: { label: "Annulée",    bg: "rgba(239,68,68,0.10)",  color: "#dc2626", dot: "#ef4444"  },
    completed: { label: "Terminée",   bg: T.orangeLight,           color: T.orangeDark, dot: T.orange },
    paid:      { label: "Payée",      bg: "rgba(37,99,235,0.10)",  color: "#2563eb", dot: "#2563eb"  },
};

const SUPPLEMENT_LABELS = {
    princes:    "Îles des Princes",
    bursa:      "Excursion Bursa",
    shopping:   "Tour Shopping",
    bosphore:   "Croisière Bosphore",
    cappadoce:  "Cappadoce",
    excursions: "Excursions",
    desert:     "Safari Désert",
    versailles: "Versailles",
    vatican:    "Vatican",
};

// ─── Mock user ─────────────────────────────────────────────────────────────────
const MOCK_USER = {
    name: "Saad El Amrani",
    email: "saad.elamrani@gmail.com",
    phone: "+212 6 61 23 45 67",
    city: "Fès, Maroc",
    avatar: null,
    joined: "Membre depuis Jan 2023",
    loyalty: "Gold",
    points: 2840,
};

// ─── JSON helpers ──────────────────────────────────────────────────────────────
const parseHotels       = (raw) => { try { return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; } };
const parseParticipants = (raw) => { try { return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); } catch { return []; } };

const fmt = (n) =>
    new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return iso; }
};

// ─── Atoms ─────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 80 }) => {
    const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    return (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDark})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: T.white, fontWeight: 700,
            fontSize: size * 0.33, fontFamily: "Playfair Display, serif",
            flexShrink: 0,
            boxShadow: `0 4px 16px rgba(255,117,14,0.35)`,
        }}>
            {initials}
        </div>
    );
};

const Badge = ({ status }) => {
    const s = STATUS[status] || STATUS.pending;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: s.bg, color: s.color,
            padding: "4px 10px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, fontFamily: "DM Sans, sans-serif",
        }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
            {s.label}
        </span>
    );
};

const Input = ({ label, value, onChange, type = "text", disabled }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, fontFamily: "DM Sans, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
        </label>
        <input
            type={type} value={value} onChange={onChange} disabled={disabled}
            style={{
                padding: "10px 14px", borderRadius: T.radiusSm,
                border: `1.5px solid ${disabled ? T.gray200 : T.gray400}`,
                background: disabled ? T.gray100 : T.white,
                fontSize: 14, color: T.text, fontFamily: "DM Sans, sans-serif",
                outline: "none", transition: "border-color 0.2s",
                cursor: disabled ? "not-allowed" : "text",
            }}
            onFocus={e => { if (!disabled) e.target.style.borderColor = T.orange; }}
            onBlur={e => { e.target.style.borderColor = disabled ? T.gray200 : T.gray400; }}
        />
    </div>
);

const Toggle = ({ label, checked, onChange, description }) => (
    <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "14px 0", borderBottom: `1px solid ${T.gray200}`, gap: 16,
    }}>
        <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{label}</div>
            {description && <div style={{ fontSize: 12, color: T.gray600, marginTop: 2 }}>{description}</div>}
        </div>
        <div onClick={onChange} style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0,
            background: checked ? T.orange : T.gray400,
            position: "relative", cursor: "pointer", transition: "background 0.2s",
        }}>
            <div style={{
                position: "absolute", top: 3, left: checked ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%",
                background: T.white, transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
        </div>
    </div>
);

const Section = ({ title, children }) => (
    <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.gray200}`, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>
            {title}
        </div>
        {children}
    </div>
);

// ─── Tab: Profil ───────────────────────────────────────────────────────────────
const TabProfile = ({ user, onSave }) => {
    const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, city: user.city });
    const [editing, setEditing] = useState(false);
    const [saved, setSaved]     = useState(false);

    const handleSave = () => {
        onSave(form);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Avatar card */}
            <div style={{
                background: `linear-gradient(135deg, ${T.cream} 0%, ${T.sand} 100%)`,
                borderRadius: T.radius, padding: "28px 24px",
                display: "flex", alignItems: "center", gap: 20,
                border: `1px solid ${T.orangeMid}`,
            }}>
                <Avatar name={form.name} size={72} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.navy, fontFamily: "Playfair Display, serif" }}>{form.name}</div>
                    <div style={{ fontSize: 13, color: T.gray600, fontFamily: "DM Sans, sans-serif", marginTop: 2 }}>{user.joined}</div>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: T.orange, color: T.white,
                        padding: "3px 10px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700, marginTop: 8,
                        fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em",
                    }}>
                        ⭐ {user.loyalty} · {user.points} pts
                    </div>
                </div>
                <button onClick={() => setEditing(e => !e)} style={{
                    padding: "8px 16px", borderRadius: T.radiusSm,
                    border: `1.5px solid ${T.orange}`,
                    background: editing ? T.orange : "transparent",
                    color: editing ? T.white : T.orange,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif", transition: "all 0.2s",
                }}>
                    {editing ? "Annuler" : "Modifier"}
                </button>
            </div>

            {/* Form */}
            <div style={{
                background: T.white, borderRadius: T.radius,
                border: `1px solid ${T.gray200}`, padding: "24px",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18,
            }}>
                <div style={{ gridColumn: "1 / -1" }}>
                    <Input label="Nom complet" value={form.name} disabled={!editing}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <Input label="Email" value={form.email} type="email" disabled={!editing}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <Input label="Téléphone" value={form.phone} disabled={!editing}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <div style={{ gridColumn: "1 / -1" }}>
                    <Input label="Ville" value={form.city} disabled={!editing}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                {editing && (
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button onClick={handleSave} style={{
                            padding: "10px 24px", borderRadius: T.radiusSm,
                            background: T.orange, color: T.white, border: "none",
                            fontSize: 14, fontWeight: 600, cursor: "pointer",
                            fontFamily: "DM Sans, sans-serif",
                            boxShadow: `0 4px 12px rgba(255,117,14,0.30)`,
                        }}>Enregistrer</button>
                    </div>
                )}
                {saved && (
                    <div style={{
                        gridColumn: "1 / -1", padding: "10px 14px", borderRadius: T.radiusSm,
                        background: "rgba(22,163,74,0.10)", color: "#16a34a",
                        fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                    }}>✓ Profil mis à jour avec succès.</div>
                )}
            </div>

            {/* Danger zone */}
            <div style={{
                background: T.white, borderRadius: T.radius,
                border: `1.5px solid rgba(239,68,68,0.20)`, padding: "20px 24px",
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 8, fontFamily: "DM Sans, sans-serif" }}>Zone sensible</div>
                <div style={{ fontSize: 13, color: T.gray600, marginBottom: 14, fontFamily: "DM Sans, sans-serif" }}>
                    La suppression de votre compte est définitive. Toutes vos données seront perdues.
                </div>
                <button style={{
                    padding: "8px 16px", borderRadius: T.radiusSm,
                    border: "1.5px solid #ef4444", background: "transparent",
                    color: "#dc2626", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}>Supprimer mon compte</button>
            </div>
        </div>
    );
};

// ─── Reservation Detail View ───────────────────────────────────────────────────
function ReservationDetail({ res, onBack }) {
    const hotels       = parseHotels(res.hotels);
    const participants = parseParticipants(res.participants);
    const filled       = participants.filter(p => p?.fullName);
    const [tab, setTab] = useState("detail");

    const DETAIL_TABS = [
        { id: "detail",       label: "📋 Détails"     },
        { id: "participants", label: "👥 Participants" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <button onClick={onBack} style={{
                alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", color: T.orange,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
            }}>← Retour</button>

            <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.gray200}`, overflow: "hidden" }}>
                {/* Hero */}
                <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyLight} 100%)`, padding: "28px 24px" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✈️</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.white, fontFamily: "Playfair Display, serif" }}>{res.packageTitle}</div>
                    <div style={{ fontSize: 13, color: T.gray400, marginTop: 4 }}>
                        📅 {res.dateFrom} → {res.dateTo} &nbsp;·&nbsp; 👥 {res.totalPax} participant{res.totalPax > 1 ? "s" : ""}
                    </div>
                </div>

                <div style={{ padding: "20px 24px" }}>
                    {/* Sub-tabs */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${T.gray200}`, paddingBottom: 12 }}>
                        {DETAIL_TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)} style={{
                                padding: "6px 14px", borderRadius: T.radiusSm, cursor: "pointer",
                                background: tab === t.id ? T.orangeLight : "transparent",
                                color: tab === t.id ? T.orange : T.gray600,
                                border: `1.5px solid ${tab === t.id ? "rgba(255,117,14,0.30)" : "transparent"}`,
                                fontSize: 12, fontWeight: 700, fontFamily: "DM Sans, sans-serif",
                                transition: "all .15s",
                            }}>{t.label}</button>
                        ))}
                    </div>

                    {/* ── Detail tab ── */}
                    {tab === "detail" && (
                        <>
                            {/* Key info grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                                {[
                                    ["Référence",    `#${res.$id?.slice(-8).toUpperCase()}`],
                                    ["Statut",       null],
                                    ["Période",      `${res.dateFrom} → ${res.dateTo}`],
                                    ["Total pax",    `${res.totalPax} personne${res.totalPax > 1 ? "s" : ""}`],
                                    ["Total estimé", fmt(res.totalEstimate)],
                                    ["Créée le",     fmtDate(res.createdAt || res.$createdAt)],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ background: T.offWhite, borderRadius: T.radiusSm, padding: "12px 14px" }}>
                                        <div style={{ fontSize: 11, color: T.gray600, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "DM Sans, sans-serif" }}>{k}</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.navy, marginTop: 4, fontFamily: "Playfair Display, serif" }}>
                                            {v === null ? <Badge status={res.status} /> : v}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Hotels */}
                            {hotels.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: "DM Sans, sans-serif" }}>Hébergements</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {hotels.map((h, i) => (
                                            <div key={i} style={{ background: T.offWhite, borderRadius: T.radiusSm, padding: "12px 14px", border: `1px solid ${T.gray200}` }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 13, color: T.navy }}>🏨 {h.name}</span>
                                                    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                                                        <span style={{ color: T.gray600 }}>{h.pax} pax</span>
                                                        <span style={{ color: T.orange, fontWeight: 800 }}>{fmt(h.subtotal)}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                    {(h.rooms || []).map((r, j) => (
                                                        <span key={j} style={{
                                                            padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                            background: T.orangeLight, color: T.orange,
                                                            border: `1px solid rgba(255,117,14,0.30)`,
                                                        }}>{r.qty}× {r.type}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Supplements */}
                            {res.supplements?.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "DM Sans, sans-serif" }}>Suppléments</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {res.supplements.map(s => (
                                            <span key={s} style={{
                                                padding: "3px 10px", borderRadius: 20,
                                                background: T.orangeLight, color: T.orange,
                                                border: `1px solid rgba(255,117,14,0.30)`,
                                                fontSize: 12, fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                                            }}>{SUPPLEMENT_LABELS[s] || s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {res.notes && (
                                <div style={{
                                    padding: "12px 14px", background: T.cream,
                                    borderRadius: T.radiusSm, borderLeft: `3px solid ${T.orange}`,
                                    marginBottom: 20,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: T.gray600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notes</div>
                                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{res.notes}</div>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button onClick={() => window.print()} style={{
                                    padding: "8px 18px", borderRadius: T.radiusSm,
                                    background: T.orange, color: T.white, border: "none",
                                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                                    fontFamily: "DM Sans, sans-serif",
                                }}>🖨️ Imprimer / PDF</button>
                            </div>
                        </>
                    )}

                    {/* ── Participants tab ── */}
                    {tab === "participants" && (
                        <div>
                            <div style={{ fontSize: 13, color: T.gray600, marginBottom: 14, fontFamily: "DM Sans, sans-serif" }}>
                                {filled.length} / {participants.length} participant{participants.length > 1 ? "s" : ""} renseigné{filled.length > 1 ? "s" : ""}
                            </div>
                            {filled.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 32, color: T.gray600, fontFamily: "DM Sans, sans-serif", fontSize: 13 }}>
                                    Aucun participant renseigné.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {filled.map((p, i) => (
                                        <div key={i} style={{ background: T.offWhite, border: `1px solid ${T.gray200}`, borderRadius: T.radiusSm, padding: "12px 14px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700, fontSize: 14, color: T.navy, fontFamily: "Playfair Display, serif" }}>👤 {p.fullName}</span>
                                                {p.docNumber && (
                                                    <span style={{
                                                        padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                                        background: T.orangeLight, color: T.orange, border: `1px solid rgba(255,117,14,0.30)`,
                                                    }}>📄 {p.docNumber}</span>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: T.gray600, fontFamily: "DM Sans, sans-serif" }}>
                                                {p.email     && <span>✉️ {p.email}</span>}
                                                {p.phone     && <span>📞 {p.phone}</span>}
                                                {p.birthDate && <span>🎂 {p.birthDate}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Tab: Réservations ─────────────────────────────────────────────────────────
const TabReservations = () => {
    const { reservations, fetchMyReservations, loading } = useReservation();
    const [filter,   setFilter]   = useState("all");
    const [selected, setSelected] = useState(null);

    useEffect(() => { fetchMyReservations(); }, [fetchMyReservations]);

    const filters = [
        { key: "all",       label: "Toutes"      },
        { key: "confirmed", label: "Confirmées"  },
        { key: "pending",   label: "En attente"  },
        { key: "paid",      label: "Payées"      },
        { key: "completed", label: "Terminées"   },
        { key: "cancelled", label: "Annulées"    },
    ];

    const filtered = filter === "all"
        ? reservations
        : reservations.filter(r => r.status === filter);

    const totalSpent = reservations
        .filter(r => r.status !== "cancelled")
        .reduce((a, r) => a + Number(r.totalEstimate || 0), 0);

    const totalPaxAll = reservations
        .filter(r => r.status !== "cancelled")
        .reduce((a, r) => a + Number(r.totalPax || 0), 0);

    if (selected) {
        return <ReservationDetail res={selected} onBack={() => setSelected(null)} />;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {[
                    { label: "Total",      value: reservations.length, icon: "🧳" },
                    { label: "Confirmées", value: reservations.filter(r => r.status === "confirmed" || r.status === "paid").length, icon: "✅" },
                    { label: "Total pax",  value: totalPaxAll,         icon: "👥" },
                    { label: "Dépensé",    value: fmt(totalSpent),     icon: "💳" },
                ].map(k => (
                    <div key={k.label} style={{
                        background: T.white, borderRadius: T.radius,
                        border: `1px solid ${T.gray200}`, padding: "16px",
                        textAlign: "center",
                    }}>
                        <div style={{ fontSize: 22 }}>{k.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: T.navy, fontFamily: "Playfair Display, serif", marginTop: 4 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: T.gray600, fontFamily: "DM Sans, sans-serif" }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {filters.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                        padding: "6px 14px", borderRadius: 20,
                        border: `1.5px solid ${filter === f.key ? T.orange : T.gray300}`,
                        background: filter === f.key ? T.orange : T.white,
                        color: filter === f.key ? T.white : T.gray600,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
                    }}>{f.label}</button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: "center", padding: 48, color: T.gray600, fontFamily: "DM Sans, sans-serif" }}>
                    ⏳ Chargement…
                </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
                <div style={{
                    background: T.white, borderRadius: T.radius,
                    border: `1px solid ${T.gray200}`, padding: "48px",
                    textAlign: "center", color: T.gray600, fontFamily: "DM Sans, sans-serif",
                }}>
                    Aucune réservation trouvée.
                </div>
            )}

            {/* List */}
            {!loading && filtered.map(r => {
                const hotels = parseHotels(r.hotels);
                const hotelNames = hotels.map(h => h.name).join(", ");

                return (
                    <div key={r.$id} onClick={() => setSelected(r)} style={{
                        background: T.white, borderRadius: T.radius,
                        border: `1px solid ${T.gray200}`,
                        padding: "18px 20px",
                        display: "flex", alignItems: "center", gap: 16,
                        cursor: "pointer", transition: "all 0.2s",
                    }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.boxShadow = T.shadowMd; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.boxShadow = "none"; }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: 52, height: 52, borderRadius: T.radiusSm,
                            background: T.cream, display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 26, flexShrink: 0,
                        }}>✈️</div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.navy, fontFamily: "Playfair Display, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {r.packageTitle}
                            </div>
                            <div style={{ fontSize: 12, color: T.gray600, fontFamily: "DM Sans, sans-serif", marginTop: 3 }}>
                                📅 {r.dateFrom} → {r.dateTo} &nbsp;·&nbsp; 👥 {r.totalPax} pax
                                {hotelNames && <> &nbsp;·&nbsp; 🏨 {hotelNames}</>}
                            </div>
                            {/* Supplement pills */}
                            {r.supplements?.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                    {r.supplements.slice(0, 3).map(s => (
                                        <span key={s} style={{
                                            padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                            background: T.orangeLight, color: T.orange,
                                            border: `1px solid rgba(255,117,14,0.25)`,
                                        }}>{SUPPLEMENT_LABELS[s] || s}</span>
                                    ))}
                                    {r.supplements.length > 3 && (
                                        <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, color: T.gray600 }}>
                                            +{r.supplements.length - 3}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.orange, fontFamily: "Playfair Display, serif" }}>
                                {fmt(r.totalEstimate)}
                            </div>
                            <div style={{ marginTop: 6 }}>
                                <Badge status={r.status} />
                            </div>
                        </div>
                        <div style={{ color: T.gray400, fontSize: 18, flexShrink: 0 }}>›</div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Tab: Paramètres ───────────────────────────────────────────────────────────
const TabSettings = () => {
    const [notifs,   setNotifs]   = useState({ email: true, sms: false, promo: true, reminder: true });
    const [privacy,  setPrivacy]  = useState({ analytics: true, sharing: false });
    const [lang,     setLang]     = useState("fr");
    const [currency, setCurrency] = useState("MAD");
    const [pwForm,   setPwForm]   = useState({ current: "", next: "", confirm: "" });
    const [pwSaved,  setPwSaved]  = useState(false);

    const toggle = (group, setGroup, key) => setGroup(g => ({ ...g, [key]: !g[key] }));

    const handlePw = () => {
        if (pwForm.next && pwForm.next === pwForm.confirm) {
            setPwSaved(true);
            setPwForm({ current: "", next: "", confirm: "" });
            setTimeout(() => setPwSaved(false), 2500);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Section title="Notifications">
                <Toggle label="Confirmation par email" description="Recevez un email à chaque réservation" checked={notifs.email} onChange={() => toggle(notifs, setNotifs, "email")} />
                <Toggle label="SMS de rappel" description="Rappel 48h avant votre départ" checked={notifs.sms} onChange={() => toggle(notifs, setNotifs, "sms")} />
                <Toggle label="Offres & promotions" description="Recevez nos meilleures offres" checked={notifs.promo} onChange={() => toggle(notifs, setNotifs, "promo")} />
                <Toggle label="Rappels de voyage" description="Rappels pendant votre séjour" checked={notifs.reminder} onChange={() => toggle(notifs, setNotifs, "reminder")} />
            </Section>

            <Section title="Langue & Devise">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                    {[
                        { label: "Langue", value: lang, set: setLang, opts: [["fr","Français"],["ar","العربية"],["en","English"],["es","Español"]] },
                        { label: "Devise", value: currency, set: setCurrency, opts: [["MAD","MAD – Dirham"],["EUR","EUR – Euro"],["USD","USD – Dollar"],["GBP","GBP – Livre Sterling"]] },
                    ].map(({ label, value, set, opts }) => (
                        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: T.gray600, fontFamily: "DM Sans, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
                            <select value={value} onChange={e => set(e.target.value)} style={{ padding: "10px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.gray400}`, fontSize: 14, color: T.text, fontFamily: "DM Sans, sans-serif", background: T.white, cursor: "pointer", outline: "none" }}>
                                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Confidentialité">
                <Toggle label="Analyses d'utilisation" description="Aidez-nous à améliorer l'expérience" checked={privacy.analytics} onChange={() => toggle(privacy, setPrivacy, "analytics")} />
                <Toggle label="Partage de données" description="Partage avec nos partenaires de voyage" checked={privacy.sharing} onChange={() => toggle(privacy, setPrivacy, "sharing")} />
            </Section>

            <Section title="Mot de passe">
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
                    <Input label="Mot de passe actuel" type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
                    <Input label="Nouveau mot de passe" type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
                    <Input label="Confirmer le nouveau mot de passe" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
                    {pwSaved && (
                        <div style={{ padding: "10px 14px", borderRadius: T.radiusSm, background: "rgba(22,163,74,0.10)", color: "#16a34a", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}>
                            ✓ Mot de passe mis à jour.
                        </div>
                    )}
                    <button onClick={handlePw} style={{ alignSelf: "flex-end", padding: "10px 24px", borderRadius: T.radiusSm, background: T.orange, color: T.white, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", boxShadow: `0 4px 12px rgba(255,117,14,0.30)` }}>
                        Mettre à jour
                    </button>
                </div>
            </Section>
        </div>
    );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function UserProfilePage() {
    const [tab,  setTab]  = useHashTab();
    const [user, setUser] = useState(MOCK_USER);
    const navigate = useNavigate();

    const tabs = [
        { key: "profil",       label: "Profil",       icon: "👤" },
        { key: "reservations", label: "Réservations", icon: "🧳" },
        { key: "settings",     label: "Paramètres",   icon: "⚙️" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: T.offWhite, fontFamily: "DM Sans, sans-serif" }}>
            {/* Top header */}
            <div style={{
                background: T.navy, padding: "10px 32px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                height: 60, boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            }}>
                <img onClick={() => navigate("/")} src="/logo.png" style={{ width: 80, marginLeft: 100, cursor: "pointer" }} alt="Logo" />
            </div>

            <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
                {/* Page title */}
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: T.navy, fontFamily: "Playfair Display, serif", margin: 0 }}>
                        Mon Espace
                    </h1>
                    <p style={{ fontSize: 14, color: T.gray600, margin: "4px 0 0", fontFamily: "DM Sans, sans-serif" }}>
                        Gérez votre profil, suivez vos voyages, configurez vos préférences.
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 24, background: T.white, padding: 5, borderRadius: T.radius, border: `1px solid ${T.gray200}`, width: "fit-content" }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            padding: "9px 20px", borderRadius: T.radiusSm, border: "none",
                            background: tab === t.key ? T.orange : "transparent",
                            color: tab === t.key ? T.white : T.gray600,
                            fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.18s",
                            display: "flex", alignItems: "center", gap: 7,
                            fontFamily: "DM Sans, sans-serif",
                            boxShadow: tab === t.key ? `0 2px 10px rgba(255,117,14,0.28)` : "none",
                        }}>
                            <span>{t.icon}</span> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {tab === "profil"       && <TabProfile user={user} onSave={data => setUser(u => ({ ...u, ...data }))} />}
                {tab === "reservations" && <TabReservations />}
                {tab === "settings"     && <TabSettings />}
            </div>
        </div>
    );
}