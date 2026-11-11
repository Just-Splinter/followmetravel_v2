import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTravelDataOptional } from "../context/TravelDataContext";
import { useUnreadMessages } from "../services/inboxUnread";
import db, { Collections } from "../services/database";
import { useLocale } from "./i18n";
import { Reveal, Lines, Button, Arrow } from "./ui";
import { agencyStats, isFilled } from "../services/agency";
import { useAgency } from "../services/useAgency";
import { getNewsletter, setNewsletter, submitLead } from "../services/operations";
import { useEvents } from "../context/EventsContext";

/* ─── Values / the house ──────────────────────────────────────────────────── */
export function Values() {
  const { t } = useLocale();
  const items = [
    { n: "01", h: t("values_1t"), p: t("values_1d") },
    { n: "02", h: t("values_2t"), p: t("values_2d") },
    { n: "03", h: t("values_3t"), p: t("values_3d") },
  ];
  return (
    <section className="mk-section mk-values" id="house">
      <div className="mk-wrap">
        <div className="mk-values-grid">
          <div className="mk-values-sticky">
            <Reveal as="span" className="mk-eyebrow">{t("values_eyebrow")}</Reveal>
            <Reveal as="h2" delay={80} className="mk-h2" style={{ margin: "20px 0 24px" }}>
              <Lines text={t("values_title")} />
            </Reveal>
            <Reveal as="p" delay={160} className="mk-lead">{t("values_p1")}</Reveal>
          </div>
          <div className="mk-values-items">
            {items.map((v, i) => (
              <Reveal key={v.n} delay={i * 90} className="mk-value">
                <i>{v.n}</i>
                <div>
                  <h3>{v.h}</h3>
                  <p>{v.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ────────────────────────────────────────────────────────── */
// Uniquement les témoignages saisis dans le CMS : pas d'avis inventé.
export function Testimonials({ testimonials, agency }) {
  const { t } = useLocale();
  const stats = agencyStats(agency);

  const items = useMemo(() => {
    const fromCms = (testimonials || []).map((x) => ({
      text: x.text,
      name: x.name,
      city: x.role || "",
    })).filter((x) => x.text);
    return fromCms;
  }, [testimonials]);

  if (!items.length) return null;

  return (
    <section className="mk-section" id="testimonials">
      <div className="mk-wrap">
        <div className="mk-sechead">
          <div>
            <Reveal as="span" className="mk-eyebrow">{t("test_eyebrow")}</Reveal>
            <Reveal as="h2" delay={80} className="mk-h2"><Lines text={t("test_title")} /></Reveal>
          </div>
          {stats.rating > 0 && stats.reviewsUrl && (
            <Reveal delay={160}>
              <a className="mk-alink" href={stats.reviewsUrl} target="_blank" rel="noreferrer">
                ★ {stats.rating.toLocaleString()}/5 — {t("test_google")}
                <Arrow size={14} />
              </a>
            </Reveal>
          )}
        </div>
        {/* Rail de cartes : tous les avis du CMS, défilement horizontal */}
        <ul className="mk-rail mk-quotes">
          {items.map((q, i) => (
            <Reveal as="li" key={i} delay={i * 60}>
              <figure className="mk-quote-card">
                <blockquote className="mk-quote">« {q.text} »</blockquote>
                <figcaption className="mk-quote-who">
                  {q.name}{q.city ? ` — ${q.city}` : ""}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── CTA band ────────────────────────────────────────────────────────────── */
export function CtaBand() {
  const { t } = useLocale();
  const navigate = useNavigate();
  return (
    <section className="mk-section mk-cta-sec">
      <div className="mk-wrap">
        <div className="mk-cta mk-grain">
          <Reveal as="h2" className="mk-h2">
            {t("cta_line1")}
            {"\n"}
            <em>{t("cta_line2")}</em>
          </Reveal>
          <Reveal as="p" delay={120}>{t("cta_sub")}</Reveal>
          <Reveal delay={200}>
            <Button variant="paper" onClick={() => navigate("/contact")}>{t("cta_button")}</Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */
export function Footer() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const agency = useAgency();
  const { trackLead } = useEvents();
  const { user } = useAuth();
  const destinations = useFooterDestinations();

  // Inscription enregistrée comme prospect (Clients du dashboard).
  const submitNews = async (e) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) return;
    try {
      await submitLead({ email, source: "newsletter" });
      trackLead({ action: "newsletter", label: "footer" });
      setSent(true);
      setEmail("");
    } catch {
      setSent(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <>
    <footer className="mk-footer">
      <div className="mk-wrap">
        {/* Haut : marque + contact | newsletter */}
        <div className="mk-footer-top">
          <div className="mk-footer-brand">
            <a className="mk-logo" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <img className="mk-logo-img mk-logo-img--foot" src="/logo-256.png" alt="Follow Me Travel" />
            </a>
            <p>{t("footer_tag")}</p>
            <div className="mk-footer-contact">
              {(agency.phones || []).map((p) => <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a>)}
              {agency.email && <a href={`mailto:${agency.email}`}>{agency.email}</a>}
            </div>
          </div>

          <div className="mk-footer-newsbox">
            <h4>{t("footer_news")}</h4>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>{t("footer_news_hint")}</p>
            {user ? (
              <NewsletterToggle />
            ) : sent ? (
              <p className="mk-news-ok">{t("footer_news_ok")}</p>
            ) : (
              <form className="mk-news" onSubmit={submitNews}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("footer_news_ph")}
                  aria-label={t("footer_news_ph")}
                />
                <button type="submit" aria-label="OK">→</button>
              </form>
            )}
          </div>
        </div>

        {/* Lignes de liens */}
        <div className="mk-footer-links">
          {destinations.length > 0 && (
          <div className="mk-footer-row">
            <h4>{t("footer_dest")}</h4>
            <ul>
              {destinations.map((d) => (
                <li key={d.id}>
                  <a href={d.to} onClick={(e) => { e.preventDefault(); navigate(d.to); }}>{d.name}</a>
                </li>
              ))}
            </ul>
          </div>
          )}

          <div className="mk-footer-row">
            <h4>{t("footer_house")}</h4>
            <ul>
              <li><a href="/#house" onClick={(e) => { e.preventDefault(); document.querySelector("#house")?.scrollIntoView({ behavior: "smooth" }); }}>{t("footer_about")}</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }}>{t("footer_contact")}</a></li>
              <li><a href="/legal/cgv" onClick={(e) => { e.preventDefault(); navigate("/legal/cgv"); }}>{t("footer_terms")}</a></li>
              <li><a href="/legal/confidentialite" onClick={(e) => { e.preventDefault(); navigate("/legal/confidentialite"); }}>{t("footer_privacy")}</a></li>
              <li><a href="/legal/cookies" onClick={(e) => { e.preventDefault(); navigate("/legal/cookies"); }}>{t("footer_cookies")}</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }}>{t("footer_mice")}</a></li>
            </ul>
          </div>
        </div>

        <div className="mk-footer-bottom">
          <span>© {year} {agency.tradeName} — {t("footer_rights")}{agency.licenceNumber ? ` · Licence d'agence de voyages n° ${agency.licenceNumber}` : ""}</span>
          <span>{isFilled(agency.city) ? `${agency.city}, Maroc` : "Maroc"}</span>
        </div>
      </div>
    </footer>
    <MobileTabBar />
    </>
  );
}

/* ─── Destinations du footer : celles du CMS (publiées), filtrant la recherche ──
   Déjà chargées sur les pages du site (TravelDataProvider) ; ailleurs (fiche
   voyage, réservation), lues directement — la collection est publique. */
function useFooterDestinations() {
  const ctx = useTravelDataOptional();
  const [own, setOwn] = useState(null);
  const fromCtx = ctx?.destinations;
  useEffect(() => {
    if (ctx) return undefined;
    let alive = true;
    db.list(Collections.DESTINATIONS)
      .then((r) => alive && setOwn(r?.documents || []))
      .catch(() => alive && setOwn([]));
    return () => { alive = false; };
  }, [ctx]);
  return useMemo(
    () =>
      (fromCtx || own || [])
        .filter((d) => d.status !== "draft" && d.name)
        .slice(0, 8)
        .map((d) => ({ id: d.$id, name: d.name, to: `/search?dest=${encodeURIComponent(d.$id)}` })),
    [fromCtx, own]
  );
}

/* ─── Newsletter, client connecté : un bouton, sur l'email du compte ────────
   (inscription ou désinscription — plus de saisie d'email). */
export function NewsletterToggle({ className = "" }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { trackLead } = useEvents();
  const [subscribed, setSubscribed] = useState(null); // null = chargement
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    getNewsletter()
      .then((r) => alive && setSubscribed(!!r?.subscribed))
      .catch(() => alive && setSubscribed(false));
    return () => { alive = false; };
  }, [user]);

  if (!user) return null;

  const toggle = async () => {
    if (busy || subscribed === null) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await setNewsletter(!subscribed);
      setSubscribed(!!r?.subscribed);
      if (r?.subscribed) trackLead({ action: "newsletter", label: "account" });
      setMsg(r?.subscribed ? t("footer_news_ok") : t("news_unsub_ok"));
    } catch {
      setMsg(t("news_err"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`mk-news-toggle ${className}`}>
      <p>{(subscribed ? t("news_on") : t("news_off")).replace("{email}", user.email)}</p>
      <button
        type="button"
        className={`mk-btn mk-btn--sm ${subscribed ? "mk-btn--ghost" : ""}`}
        onClick={toggle}
        disabled={busy || subscribed === null}
        aria-pressed={!!subscribed}
      >
        {subscribed ? t("news_unsub") : t("news_sub")}
      </button>
      {msg && <p className="mk-news-ok" role="status">{msg}</p>}
    </div>
  );
}

/* ─── Barre d'onglets mobile (fixe en bas, < 900 px) ─────────────────────── */
const TAB_ICONS = {
  home: <path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  omra: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" /></>,
};

export function MobileTabBar() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const unread = useUnreadMessages(user);
  const tabs = [
    { k: "home", to: "/", label: t("pk_home"), on: pathname === "/" },
    { k: "search", to: "/search", label: t("nav_search"), on: pathname.startsWith("/search") },
    { k: "omra", to: "/omra", label: t("nav_omra"), on: pathname.startsWith("/omra") },
    { k: "user", to: user ? (unread ? "/profil#inbox" : "/profil") : "/login", label: user ? t("nav_profile") : t("nav_signin"), on: pathname.startsWith("/profil"), badge: unread },
  ];
  return (
    <nav className="mk-tabbar" aria-label="Navigation">
      {tabs.map((x) => (
        <a
          key={x.k}
          href={x.to}
          className={x.on ? "is-on" : ""}
          aria-current={x.on ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); navigate(x.to); }}
        >
          <span className="mk-tabbar-ico">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {TAB_ICONS[x.k]}
            </svg>
            {x.badge > 0 && <i className="mk-tabbar-badge" aria-label={`${x.badge} ${t("pf_tab_inbox")}`}>{x.badge}</i>}
          </span>
          <span>{x.label}</span>
        </a>
      ))}
    </nav>
  );
}
