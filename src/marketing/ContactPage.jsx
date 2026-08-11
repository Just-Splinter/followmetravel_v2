import { useState } from "react";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal, Lines, Button } from "./ui";
import "./marketing.css";

export default function ContactPage() {
  const { t } = useLocale();
  const subjects = t("subjects");
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
      <main>
        <div className="mk-wrap mk-page-head">
          <Reveal as="span" className="mk-eyebrow">{t("contact_eyebrow")}</Reveal>
          <h1 className="mk-h2" style={{ margin: "20px 0 22px", fontSize: "clamp(40px, 7vw, 88px)" }}>
            <Lines text={t("contact_title")} />
          </h1>
          <Reveal as="p" delay={140} className="mk-lead">{t("contact_intro")}</Reveal>
        </div>

        <div className="mk-wrap" style={{ paddingBottom: 120 }}>
          <div className="mk-contact-grid">
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
                  <textarea id="c_message" rows={5} value={form.message} onChange={set("message")} />)}
                <Button className={status === "sending" ? "is-busy" : ""} onClick={() => {}}>
                  {status === "sending" ? t("contact_sending") : t("contact_send")}
                </Button>
              </form>
            )}

            <aside className="mk-contact-aside">
              <div className="mk-aside-block">
                <h4 style={{ margin: "0 0 10px", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-2)" }}>
                  {t("contact_call")}
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <a href="tel:+212664586425">+212 664 586 425</a>
                  <a href="tel:+212520655575">+212 520 655 575</a>
                  <a href="mailto:contact@followmetravel.ma">contact@followmetravel.ma</a>
                </div>
              </div>
              <div className="mk-aside-block">
                <p style={{ margin: 0, color: "var(--ink-2)" }}>{t("contact_hours")}</p>
                <p style={{ margin: "6px 0 0" }}>Casablanca, Maroc</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
