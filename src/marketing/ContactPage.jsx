import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { useTravelData } from "../context/TravelDataContext";
import { contactFromPackages, officeImages } from "../services/siteContact";
import Header from "./Header";
import { Reveal, Lines, Button } from "./ui";
import GeoMap from "./GeoMap";
import { usePageMeta } from "./usePageMeta";
import "./marketing.css";

/* Offices Center B, N° 402 Bd Mohammed V — Casablanca city centre */
const AGENCY = { lat: 33.5941, lng: -7.61 };
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
  const navigate = useNavigate();
  const office = useMemo(() => officeImages(contactFromPackages(packages)), [packages]);
  const subjects = t("subjects");
  const year = new Date().getFullYear();

  usePageMeta(t("footer_contact"), AGENCY_ADDR);

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = t("err_required");
    if (!form.email.trim()) er.email = t("err_required");
    else if (!/\S+@\S+\.\S+/.test(form.email)) er.email = t("err_email");
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
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("ok");
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
      <main className="mk-ct2">
        {/* — the city, first — */}
        <div className="mk-ct2-map">
          <GeoMap
            markers={[{ lat: AGENCY.lat, lng: AGENCY.lng, label: "Follow Me Travel" }]}
            height="100%"
            zoom={16}
            className="mk-ct2-geomap"
          />
          <div className="mk-ct2-mapshade" aria-hidden="true" />
          <a className="mk-ct2-dirs" href={GMAPS_URL} target="_blank" rel="noreferrer">
            {t("ct_dirs")} ↗
          </a>
        </div>

        <div className="mk-ct2-body">
          {/* headline sheet breaking the map's edge */}
          <Reveal className="mk-ct2-head">
            <span className="mk-eyebrow">{t("contact_eyebrow")}</span>
            <h1><Lines text={t("contact_title")} /></h1>
          </Reveal>

          <div className="mk-ct2-grid">
            <Reveal as="aside" delay={80} className="mk-ct2-facts">
              <dl className="mk-ct-facts">
                <div>
                  <dt>{t("ct_addr")}</dt>
                  <dd>
                    {AGENCY_ADDR}
                    <a href={GMAPS_URL} target="_blank" rel="noreferrer" className="mk-ct2-factlink">
                      {t("ct_dirs")} →
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{t("contact_call")}</dt>
                  <dd>
                    <a href="tel:+212664586425">+212 664 586 425</a>
                    <a href="tel:+212520655575">+212 520 655 575</a>
                    <a href="mailto:contact@followmetravel.ma">contact@followmetravel.ma</a>
                  </dd>
                </div>
                <div>
                  <dt>{t("ct_hours_l")}</dt>
                  <dd>{t("contact_hours")}</dd>
                </div>
              </dl>
            </Reveal>

            <Reveal delay={140} className="mk-ct2-form">
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
                      <input id="c_name" value={form.name} onChange={set("name")} autoComplete="name" />)}
                    {field("email", t("contact_email"),
                      <input id="c_email" type="email" value={form.email} onChange={set("email")} autoComplete="email" />)}
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
                    <textarea id="c_message" rows={3} value={form.message} onChange={set("message")} />)}
                  <Button className={status === "sending" ? "is-busy" : ""} onClick={() => {}}>
                    {status === "sending" ? t("contact_sending") : t("contact_send")}
                  </Button>
                </form>
              )}
            </Reveal>

            {/* the agency, in three frames */}
            <Reveal as="aside" delay={200} className="mk-ct2-office">
              <span className="mk-ct2-cap">{t("ct_office")}</span>
              <div className="mk-ct2-strip">
                {office.map((src, i) => (
                  <figure key={i}>
                    <img src={src} alt={`${t("ct_office")} ${i + 1}`} loading="lazy" />
                    <figcaption>{String(i + 1).padStart(2, "0")}</figcaption>
                  </figure>
                ))}
              </div>
            </Reveal>
          </div>

          {/* slim in-viewport footer */}
          <footer className="mk-ct2-foot">
            <span>© {year} Follow Me Travel — {t("footer_rights")}</span>
            <nav>
              <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>{t("pk_home")}</a>
              <a href="/search" onClick={(e) => { e.preventDefault(); navigate("/search"); }}>{t("nav_trips")}</a>
              <a href="/omra" onClick={(e) => { e.preventDefault(); navigate("/omra"); }}>{t("nav_omra")}</a>
            </nav>
          </footer>
        </div>
      </main>
    </div>
  );
}
