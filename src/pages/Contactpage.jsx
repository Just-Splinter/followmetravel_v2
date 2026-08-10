import { useState, useEffect } from "react";

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useIsMobile(bp = 700) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [bp]);
  return mobile;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  orange:      "rgb(255,117,14)",
  orangeLight: "rgba(255,117,14,0.10)",
  orangeMid:   "rgba(255,117,14,0.20)",
  orangeDark:  "#e05a00",
  navy:        "#1a1a2e",
  navyLight:   "#2a2a4a",
  white:       "#ffffff",
  offWhite:    "#fdf8f4",
  cream:       "#fff4ec",
  sand:        "#f5e6d8",
  gray200:     "#f0ede9",
  gray400:     "#c8c0b8",
  gray600:     "#8a7f78",
  text:        "#2b2320",
  radius:      "12px",
  radiusSm:    "8px",
  shadowMd:    "0 4px 24px rgba(255,117,14,0.13)",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Field = ({ label, error, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{
      fontSize: 12, fontWeight: 600, color: T.gray600,
      textTransform: "uppercase", letterSpacing: "0.05em",
      fontFamily: "DM Sans, sans-serif",
    }}>
      {label}
    </label>
    {children}
    {error && (
      <span style={{ fontSize: 12, color: "#dc2626", fontFamily: "DM Sans, sans-serif" }}>
        {error}
      </span>
    )}
  </div>
);

const inputStyle = (hasError) => ({
  padding: "11px 14px",
  borderRadius: T.radiusSm,
  border: `1.5px solid ${hasError ? "#ef4444" : T.gray400}`,
  background: T.white,
  fontSize: 14, color: T.text,
  fontFamily: "DM Sans, sans-serif",
  outline: "none",
  transition: "border-color 0.2s",
  width: "100%",
  boxSizing: "border-box",
});

function GoogleMapsButton() {
  return (
    <button
      onClick={() =>
        window.open(
          "https://www.google.com/maps/place/Follow+Me+Travel+By+Asfari+voyage/@33.564468,-7.595406,13z/data=!4m6!3m5!1s0xda7cd6f7e69ceb9:0x9794a9f9ccf89775!8m2!3d33.5644676!4d-7.5954065!16s%2Fg%2F11h4tn2r80?hl=fr&entry=ttu&g_ep=EgoyMDI2MDYxMC4wIKXMDSoASAFQAw%3D%3D",
          "_blank",
          "noopener,noreferrer"
        )
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 20px",
        border: "none",
        borderRadius: 10,
        background: "#4285F4",
        color: "#fff",
        cursor: "pointer",
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      <i className="ti ti-map-pin"></i>
      Voir sur Google Maps
    </button>
  );
}

const ContactCard = ({ icon, title, children, href }) => (
  <a
    href={href}
    target={href?.startsWith("http") ? "_blank" : undefined}
    rel="noopener noreferrer"
    style={{ textDecoration: "none" }}
  >
    <div
      style={{
        background: T.white,
        border: `1.5px solid ${T.gray200}`,
        borderRadius: T.radius,
        padding: "20px",
        display: "flex", alignItems: "flex-start", gap: 16,
        cursor: href ? "pointer" : "default",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        if (href) {
          e.currentTarget.style.borderColor = T.orange;
          e.currentTarget.style.boxShadow   = T.shadowMd;
          e.currentTarget.style.transform   = "translateY(-2px)";
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.gray200;
        e.currentTarget.style.boxShadow   = "none";
        e.currentTarget.style.transform   = "translateY(0)";
      }}
    >
      <div style={{
         borderRadius: T.radiusSm,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: T.orange,
          textTransform: "uppercase", letterSpacing: "0.07em",
          fontFamily: "DM Sans, sans-serif", marginBottom: 4,
        }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  </a>
);

// ─── Validation ───────────────────────────────────────────────────────────────
const SUBJECTS = [
  "Demande de réservation",
  "Modification de voyage",
  "Annulation",
  "Demande de devis",
  "Réclamation",
  "Autre",
];

function validate(form) {
  const errors = {};
  if (!form.name.trim())                        errors.name    = "Nom requis.";
  if (!form.email.trim())                       errors.email   = "Email requis.";
  else if (!/\S+@\S+\.\S+/.test(form.email))   errors.email   = "Email invalide.";
  if (!form.phone.trim())                       errors.phone   = "Téléphone requis.";
  if (!form.subject)                            errors.subject = "Veuillez choisir un sujet.";
  if (!form.message.trim())                     errors.message = "Message requis.";
  else if (form.message.trim().length < 20)     errors.message = "Message trop court (20 caractères min).";
  return errors;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContactPage() {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", subject: "", message: "",
  });
  const [errors,    setErrors]    = useState({});
  const [status,    setStatus]    = useState("idle"); // idle | sending | success | error
  const [focusedField, setFocused] = useState(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus("sending");
    // Simuler un appel API
    await new Promise(r => setTimeout(r, 1600));
    setStatus("success");
  };

  const handleReset = () => {
    setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    setErrors({});
    setStatus("idle");
  };

  const focusStyle = (key) => ({
    borderColor: errors[key] ? "#ef4444" : focusedField === key ? T.orange : T.gray400,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: T.offWhite,
      fontFamily: "DM Sans, sans-serif",
    }}>

                         

      {/* Body */}
      <div style={{
        maxWidth: 900, margin: "0 auto",
        padding: isMobile ? "24px 16px 48px" : "40px 20px 60px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
        gap: isMobile ? 20 : 28,
        alignItems: "start",
      }}>

        {/* ── Formulaire ─────────────────────────────────── */}
        <div style={{
          background: T.white, borderRadius: T.radius,
          border: `1px solid ${T.gray200}`,
          padding: isMobile ? "20px 16px" : "32px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
        }}>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: T.navy,
            fontFamily: "Playfair Display, serif",
            margin: "0 0 6px",
          }}>
            Envoyer un message
          </h2>
          <p style={{
            fontSize: 13, color: T.gray600,
            margin: "0 0 28px", lineHeight: 1.5,
          }}>
            Remplissez le formulaire ci-dessous, nous vous répondrons sous 24h.
          </p>

          {status === "success" ? (
            /* Success state */
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center", gap: 16,
              padding: "40px 20px",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(22,163,74,0.10)",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 30,
              }}>
                ✅
              </div>
              <div>
                <div style={{
                  fontSize: 18, fontWeight: 700, color: T.navy,
                  fontFamily: "Playfair Display, serif", marginBottom: 6,
                }}>
                  Message envoyé !
                </div>
                <div style={{ fontSize: 14, color: T.gray600, lineHeight: 1.6 }}>
                  Merci <strong>{form.name || "pour votre message"}</strong>. Notre équipe vous contactera très prochainement.
                </div>
              </div>
              <button
                onClick={handleReset}
                style={{
                  marginTop: 8, padding: "10px 24px",
                  borderRadius: T.radiusSm,
                  border: `1.5px solid ${T.orange}`,
                  background: "transparent", color: T.orange,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            /* Form */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Nom + Email */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <Field label="Nom complet *" error={errors.name}>
                  <input
                    type="text"
                    placeholder="Saad El Amrani"
                    value={form.name}
                    onChange={set("name")}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(errors.name), ...focusStyle("name") }}
                  />
                </Field>
                <Field label="Adresse email *" error={errors.email}>
                  <input
                    type="email"
                    placeholder="vous@email.com"
                    value={form.email}
                    onChange={set("email")}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(errors.email), ...focusStyle("email") }}
                  />
                </Field>
              </div>

              {/* Téléphone + Sujet */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <Field label="Téléphone *" error={errors.phone}>
                  <input
                    type="tel"
                    placeholder="+212 6XX XXX XXX"
                    value={form.phone}
                    onChange={set("phone")}
                    onFocus={() => setFocused("phone")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(errors.phone), ...focusStyle("phone") }}
                  />
                </Field>
                <Field label="Sujet *" error={errors.subject}>
                  <select
                    value={form.subject}
                    onChange={set("subject")}
                    onFocus={() => setFocused("subject")}
                    onBlur={() => setFocused(null)}
                    style={{
                      ...inputStyle(errors.subject),
                      ...focusStyle("subject"),
                      cursor: "pointer",
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238a7f78' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                      paddingRight: 36,
                    }}
                  >
                    <option value="">Choisir un sujet…</option>
                    {SUBJECTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Message */}
              <Field label="Votre message *" error={errors.message}>
                <textarea
                  placeholder="Décrivez votre demande en détail…"
                  value={form.message}
                  onChange={set("message")}
                  onFocus={() => setFocused("message")}
                  onBlur={() => setFocused(null)}
                  rows={5}
                  style={{
                    ...inputStyle(errors.message),
                    ...focusStyle("message"),
                    resize: "vertical",
                    minHeight: 120,
                  }}
                />
                <span style={{
                  fontSize: 11, color: form.message.length < 20 ? T.gray400 : "#16a34a",
                  alignSelf: "flex-end", fontFamily: "DM Sans, sans-serif",
                }}>
                  {form.message.length} / 20 min
                </span>
              </Field>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={status === "sending"}
                style={{
                  padding: "13px 0",
                  borderRadius: T.radiusSm,
                  background: status === "sending"
                    ? T.orangeDark
                    : T.orange,
                  color: T.white, border: "none",
                  fontSize: 15, fontWeight: 700,
                  cursor: status === "sending" ? "not-allowed" : "pointer",
                  fontFamily: "DM Sans, sans-serif",
                  boxShadow: `0 4px 16px rgba(255,117,14,0.35)`,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8,
                }}
              >
                {status === "sending" ? (
                  <>
                    <span style={{
                      width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.4)",
                      borderTopColor: T.white, borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }} />
                    Envoi en cours…
                  </>
                ) : (
                  "Envoyer le message →"
                )}
              </button>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>

        {/* ── Sidebar infos ───────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Bandeau principal */}
          <div style={{
            background: `linear-gradient(135deg, ${T.cream} 0%, ${T.sand} 100%)`,
            border: `1.5px solid ${T.orangeMid}`,
            borderRadius: T.radius, padding: "22px 20px",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: T.orange,
              textTransform: "uppercase", letterSpacing: "0.07em",
              fontFamily: "DM Sans, sans-serif", marginBottom: 10,
            }}>
              Centre de réservation
            </div>
            <p style={{
              fontSize: 13, color: T.gray600,
              margin: "0 0 14px", lineHeight: 1.6,
              fontFamily: "DM Sans, sans-serif",
            }}>
              Pour toutes vos réservations, contactez notre centre d'appel ou visitez notre site.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "+212 664 586 425", href: "tel:+212664586425", icon: "📞" },
                { label: "+212 520 655 575", href: "tel:+212520655575", icon: "📞" },
              ].map(({ label, href, icon }) => (
                <a key={href} href={href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: T.white, borderRadius: T.radiusSm,
                    padding: "10px 14px",
                    border: `1px solid ${T.gray200}`,
                    transition: "all 0.18s",
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = T.orange;
                      e.currentTarget.style.background  = T.orangeLight;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = T.gray200;
                      e.currentTarget.style.background  = T.white;
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: T.navy,
                      fontFamily: "DM Sans, sans-serif",
                    }}>
                      {label}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

         

          <ContactCard icon="🕐" title="Horaires d'ouverture">
            <div style={{ fontSize: 13, color: T.text, fontFamily: "DM Sans, sans-serif", lineHeight: 1.7 }}>
              <div>Lun – Ven &nbsp;<strong>08h30 – 18h00</strong></div>
              <div>Samedi &nbsp;&nbsp;&nbsp;&nbsp;<strong>09h00 – 13h00</strong></div>
              <div style={{ color: T.gray600 }}>Dimanche &nbsp;Fermé</div>
            </div>
          </ContactCard>

          <ContactCard  title="Notre agence">
            <div style={{ fontSize: 13, color: T.text, fontFamily: "DM Sans, sans-serif", lineHeight: 1.7 }}>
              
              <GoogleMapsButton></GoogleMapsButton>
            </div>
          </ContactCard>

          {/* Response time badge */}
          <div style={{
            background: T.orangeLight,
            border: `1px solid ${T.orangeMid}`,
            borderRadius: T.radiusSm,
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: T.orange,
                fontFamily: "DM Sans, sans-serif",
              }}>
                Réponse rapide
              </div>
              <div style={{ fontSize: 12, color: T.gray600, fontFamily: "DM Sans, sans-serif" }}>
                Sous 24h en jours ouvrables
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}