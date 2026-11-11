import { useEffect, useState } from "react";
import { useLocale } from "./i18n";
import { LangSwitcher, Arrow } from "./ui";
import { usePageMeta } from "./usePageMeta";
import { submitLead } from "../services/operations";
import { whatsappLink } from "../services/agency";
import { useEvents } from "../context/EventsContext";
import "./marketing.css";

/** Temps restant jusqu'à la date de lancement (minuit, heure locale), ou null. */
function remaining(launchDate, now) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(launchDate || "")) return null;
  const [y, m, d] = launchDate.slice(0, 10).split("-").map(Number);
  const ms = new Date(y, m - 1, d).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/**
 * Page d'attente avant le lancement (Paramètres → Agence → « Lancement du
 * site ») : les visiteurs laissent leur e-mail pour être prévenus de
 * l'ouverture, ou contactent l'agence directement.
 */
export default function ComingSoonPage({ agency }) {
  const { t, locale } = useLocale();
  const { trackLead } = useEvents();
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | ok | error

  const title = agency.comingSoonTitle?.trim() || t("cs_title");
  const message = agency.comingSoonMessage?.trim() || t("cs_text");
  usePageMeta(t("cs_meta_title"), message, { path: "/" });

  const left = remaining(agency.launchDate, now);
  useEffect(() => {
    if (!agency.launchDate) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [agency.launchDate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      await submitLead({ email: email.trim(), source: "newsletter", message: "Être prévenu du lancement du site" });
      trackLead({ action: "newsletter", label: "coming-soon" });
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const wa = whatsappLink(agency, t("cs_wa_message"));
  const phone = agency.phones?.[0];
  const launchLabel = agency.launchDate
    ? new Date(`${agency.launchDate.slice(0, 10)}T12:00:00`).toLocaleDateString(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className="mk mk-cs">
      <div className="mk-cs-bg" aria-hidden="true" />
      <header className="mk-cs-top">
        <img src="/logo-followme.png" alt="Follow Me Travel" className="mk-cs-logo" />
        <LangSwitcher />
      </header>

      <main className="mk-cs-main">
        <span className="mk-eyebrow">{t("cs_eyebrow")}</span>
        <h1 className="mk-cs-title">{title}</h1>
        <p className="mk-cs-text">{message}</p>

        {left && (
          <div className="mk-cs-count" role="timer" aria-label={`${t("cs_launch")} ${launchLabel}`}>
            {[
              [left.days, t("cs_days")],
              [pad(left.hours), t("cs_hours")],
              [pad(left.minutes), t("cs_minutes")],
              [pad(left.seconds), t("cs_seconds")],
            ].map(([v, label]) => (
              <div key={label}>
                <b>{v}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
        {launchLabel && <p className="mk-cs-launch">{t("cs_launch")} {launchLabel}</p>}

        {status === "ok" ? (
          <p className="mk-cs-ok" role="status">{t("cs_ok")}</p>
        ) : (
          <form className="mk-cs-form" onSubmit={submit} noValidate>
            <label className="mk-cs-sr" htmlFor="cs-email">{t("cs_email_ph")}</label>
            <input
              id="cs-email"
              type="email"
              autoComplete="email"
              placeholder={t("cs_email_ph")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
            />
            <button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "…" : t("cs_notify")}
              <Arrow size={14} />
            </button>
          </form>
        )}
        {status === "error" && <p className="mk-cs-err" role="alert">{t("cs_err")}</p>}
      </main>

      <footer className="mk-cs-foot">
        <p>{t("cs_contact")}</p>
        <div className="mk-cs-links">
          {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
          {phone && <a href={`tel:${phone.replace(/\s/g, "")}`} dir="ltr">{phone}</a>}
          {agency.email && <a href={`mailto:${agency.email}`}>{agency.email}</a>}
        </div>
        <small>© {new Date().getFullYear()} {agency.tradeName || "Follow Me Travel"}{agency.legalName ? ` · ${agency.legalName}` : ""}</small>
      </footer>
    </div>
  );
}
