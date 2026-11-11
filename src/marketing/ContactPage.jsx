import { useMemo, useState } from "react";
import { useLocale } from "./i18n";
import { useTravelData } from "../context/TravelDataContext";
import { contactFromPackages, officeImages } from "../services/siteContact";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal, Lines, Button } from "./ui";
import GeoMap from "./GeoMap";
import { usePageMeta } from "./usePageMeta";
import { submitLead } from "../services/operations";
import { useEvents } from "../context/EventsContext";
import { useAuth } from "../context/AuthContext";
import { useAgency } from "../services/useAgency";
import { isFilled } from "../services/agency";
import "./marketing.css";
import { agencyJsonLd } from "./seo";

/* Offices Center B, N° 402 Bd Mohammed V — Casablanca city centre */
const AGENCY = { lat: 33.5941, lng: -7.61 };
const CONTACT_LD = agencyJsonLd();
const AGENCY_ADDR = "Offices Center B, N° 402 Bd Mohammed V — 4ᵉ étage, Casablanca 20000";
const GMAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent("Offices Center B, 402 Bd Mohammed V, Casablanca");

/**
 * Contact — a single desktop viewport: the city map is the opening scene,
 * the paper sheet breaks its lower edge with the headline, and everything
 * else (facts, form, the agency in three frames) lives on one screen.
 */
export default function ContactPage() {
  const { t } = useLocale();
  const { packages } = useTravelData();
  const office = useMemo(() => officeImages(contactFromPackages(packages)), [packages]);
  const subjects = t("subjects");

  usePageMeta(t("footer_contact"), `${t("cta_sub")} ${AGENCY_ADDR}`, { path: "/contact", jsonLd: CONTACT_LD });

  // name/email absents = pas encore saisis : nom et email du compte connecté.
  const [form, setForm] = useState({ phone: "", subject: "", message: "" });
  const { user } = useAuth();
  const agency = useAgency();
  const address = isFilled(agency.address) ? agency.address : AGENCY_ADDR;
  const contactEmail = agency.email || "contact@followmetravel.ma";
  const name = form.name ?? user?.name ?? "";
  const email = form.email ?? user?.email ?? "";
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const { trackLead } = useEvents();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const er = {};
    if (!name.trim()) er.name = t("err_required");
    if (!email.trim()) er.email = t("err_required");
    else if (!/\S+@\S+\.\S+/.test(email)) er.email = t("err_email");
    if (!form.phone.trim()) er.phone = t("err_required");
    if (!form.subject) er.subject = t("err_required");
    if (!form.message.trim()) er.message = t("err_required");
    else if (form.message.trim().length < 20) er.message = t("err_short");
    return er;
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) return;
    setStatus("sending");
    // Enregistré comme prospect dans le dashboard (Clients, Pipeline) — avant,
    // le formulaire simulait l'envoi et le message était perdu.
    try {
      await submitLead({
        source: "contact",
        name: name.trim(),
        email: email.trim(),
        phone: form.phone.trim(),
        message: `${form.subject ? `[${form.subject}] ` : ""}${form.message.trim()}`,
      });
      trackLead({ action: "contact", label: form.subject || "contact" });
      setStatus("ok");
    } catch {
      setStatus("idle");
      setErrors({ message: "Envoi impossible pour le moment — réessayez, ou appelez-nous / écrivez-nous sur WhatsApp." });
    }
  };

  // Plain render helper (not a component) so inputs never remount mid-typing.
  const field = (k, label, control) => (
    <div className={`mk-field ${errors[k] ? "has-error" : ""}`}>
      <label htmlFor={`c_${k}`}>{label}</label>
      {control}
      {errors[k] && <span className="mk-err">{errors[k]}</span>}
    </div>
  );

  return (
    <div className="mk">
      <Header />
      <main className="mk-ct3">
        <div className="mk-wrap mk-page-head">
          <Reveal as="span" className="mk-eyebrow">{t("contact_eyebrow")}</Reveal>
          <Reveal as="h1" delay={80} className="mk-h2" style={{ marginTop: 16 }}><Lines text={t("contact_title")} /></Reveal>
          <Reveal as="p" delay={140} className="mk-lead" style={{ marginTop: 14 }}>{t("contact_intro")}</Reveal>
        </div>

        {/* Formulaire à gauche, coordonnées à droite */}
        <div className="mk-wrap mk-ct3-grid">
          <Reveal delay={100} className="mk-ct2-form mk-ct3-card">
            {status === "ok" ? (
              <div className="mk-ok">
                <h3>{t("contact_ok_t")}</h3>
                <p className="mk-lead" style={{ margin: "0 auto 26px" }}>{t("contact_ok_d")}</p>
                <Button onClick={() => { setStatus("idle"); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}>
                  {t("contact_again")}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="mk-form-row">
                  {field("name", t("contact_name"),
                    <input id="c_name" value={name} onChange={set("name")} autoComplete="name" />)}
                  {field("email", t("contact_email"),
                    <input id="c_email" type="email" value={email} onChange={set("email")} autoComplete="email" />)}
                </div>
                <div className="mk-form-row">
                  {field("phone", t("contact_phone"),
                    <input id="c_phone" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />)}
                  {field("subject", t("contact_subject"),
                    <select id="c_subject" value={form.subject} onChange={set("subject")}>
                      <option value="">{t("contact_subject_ph")}</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>)}
                </div>
                {field("message", t("contact_message"),
                  <textarea id="c_message" rows={4} value={form.message} onChange={set("message")} />)}
                <Button className={status === "sending" ? "is-busy" : ""} onClick={() => {}}>
                  {status === "sending" ? t("contact_sending") : t("contact_send")}
                </Button>
              </form>
            )}
          </Reveal>

          <Reveal as="aside" delay={160} className="mk-ct2-facts mk-ct3-card">
            <dl className="mk-ct-facts">
              <div>
                <dt>{t("contact_call")}</dt>
                <dd>
                  {(agency.phones || []).map((p) => (
                    <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a>
                  ))}
                  <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                </dd>
              </div>
              <div>
                <dt>{t("ct_addr")}</dt>
                <dd>
                  {address}
                  <a href={GMAPS_URL} target="_blank" rel="noreferrer" className="mk-ct2-factlink">
                    {t("ct_dirs")} →
                  </a>
                </dd>
              </div>
              <div>
                <dt>{t("ct_hours_l")}</dt>
                <dd>{t("contact_hours")}</dd>
              </div>
            </dl>
          </Reveal>
        </div>

        {/* Nous trouver : l'agence en photos + la carte */}
        <section className="mk-section">
          <div className="mk-wrap">
            <div className="mk-sechead">
              <div>
                <span className="mk-eyebrow">{t("ct_office")}</span>
                <h2 className="mk-h2">{t("ct_visit")}</h2>
                <p className="mk-lead">{t("ct_visit_d")}</p>
              </div>
              <a className="mk-alink" href={GMAPS_URL} target="_blank" rel="noreferrer">{t("ct_dirs")} ↗</a>
            </div>
            <div className="mk-ct3-visit">
              {office.map((src, i) => (
                <figure key={i}>
                  <img src={src} alt={`${t("ct_office")} ${i + 1}`} loading="lazy" />
                </figure>
              ))}
              <div className="mk-ct3-map">
                <GeoMap
                  markers={[{ lat: AGENCY.lat, lng: AGENCY.lng, label: "Follow Me Travel" }]}
                  height="100%"
                  zoom={16}
                  className="mk-ct2-geomap"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
