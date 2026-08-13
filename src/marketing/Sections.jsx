import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { localizeData } from "../services/translate";
import { Reveal, Lines, SectionHead, ArrowLink, Button, Arrow, CountUp } from "./ui";
import { slideCard } from "../services/heroSlides";
import QuickPrice from "./QuickPrice";

/* ─── Destinations ────────────────────────────────────────────────────────── */
export function Destinations({ destinations, heroSlides }) {
  const { t } = useLocale();
  const navigate = useNavigate();

  // CMS `destinations` requires auth for guests today — fall back to the hero
  // slide set so the section never renders empty.
  const items = useMemo(() => {
    if (destinations?.length) {
      return destinations.map((d) => ({
        id: d.$id,
        name: d.name,
        img: d.emoji,
        count: d.listing,
        rating: d.rating || "5.0",
        nav: () => navigate(`/search?dest=${d.$id}`),
      }));
    }
    return (heroSlides || []).map((s) => ({
      id: s.$id,
      name: s.name,
      img: slideCard(s),
      count: null,
      rating: Math.min(5, (s.dots ?? 4) + 0.8).toFixed(1),
      nav: () => navigate("/search"),
    }));
  }, [destinations, heroSlides, navigate]);

  if (!items.length) return null;

  return (
    <section className="mk-section" id="destinations">
      <div className="mk-wrap">
        <SectionHead
          eyebrow={t("dest_eyebrow")}
          title={<Lines text={t("dest_title")} />}
          intro={t("dest_intro")}
          aside={<ArrowLink onClick={() => navigate("/search")}>{t("dest_all")}</ArrowLink>}
        />
      </div>
      <div className="mk-dest-rail">
        {items.map((d, i) => (
          <Reveal as="article" key={d.id} delay={i * 70} className="mk-dest-card" onClick={d.nav}>
            <figure>
              <img src={d.img} alt={d.name} loading="lazy" />
              <figcaption>
                <strong>{d.name}</strong>
                {d.count && <span>{d.count} {t("dest_listings")}</span>}
              </figcaption>
            </figure>
            <div className="mk-dest-meta">
              <b>★ {d.rating}</b>
              <span className="mk-dest-idx">{String(i + 1).padStart(2, "0")}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Trips (products) ────────────────────────────────────────────────────── */
export function Trips({ packages }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();

  const items = useMemo(
    () =>
      (packages || []).slice(0, 6).map((p) => {
        let data = {};
        try { data = JSON.parse(p.data) || {}; } catch { /* raw */ }
        data = localizeData(data, locale);
        return {
          id: p.$id,
          title: p.title || data.destination || "—",
          img: data.heroBg,
          country: p.country,
          duration: data.durationLabel || "",
          price: p.basePrice,
          departureDates: data.departureDates || [],
        };
      }),
    [packages, locale]
  );

  if (!items.length) return null;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  return (
    <section className="mk-section" id="trips" style={{ paddingTop: 0 }}>
      <div className="mk-wrap">
        <SectionHead
          eyebrow={t("trips_eyebrow")}
          title={<Lines text={t("trips_title")} />}
          intro={t("trips_intro")}
          aside={<ArrowLink onClick={() => navigate("/search")}>{t("trips_all")}</ArrowLink>}
        />
        <div className="mk-trips-grid">
          {items.map((p, i) => (
            <Reveal
              as="article"
              key={p.id}
              delay={(i % 3) * 80}
              className="mk-trip"
              onClick={() => navigate(`/packages/view?pkgId=${p.id}`)}
              style={{ cursor: "pointer" }}
            >
              <figure>
                {p.img ? (
                  <img src={p.img} alt={p.title} loading="lazy" />
                ) : (
                  <span className="mk-trip-fallback" aria-hidden="true">
                    {(p.title || "—").charAt(0)}
                  </span>
                )}
              </figure>
              <div className="mk-trip-meta">
                <span>{p.country || "—"}</span>
                <span>{p.duration}</span>
              </div>
              <h3>{p.title}</h3>
              <div className="mk-trip-foot">
                <span className="mk-trip-price">
                  {t("trips_from")}<b>{nf.format(p.price || 0)}</b>DH
                </span>
                <QuickPrice pkgId={p.id} price={p.price} departureDates={p.departureDates} compact />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

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

/* ─── Stats ───────────────────────────────────────────────────────────────── */
export function Stats() {
  const { t } = useLocale();
  const rows = [
    { v: 10, suf: "+", label: t("stats_years") },
    { v: 18, suf: "k", label: t("stats_travelers") },
    { v: 40, suf: "+", label: t("stats_destinations") },
    { v: 4.8, dec: 1, suf: "★", label: t("stats_rating") },
  ];
  return (
    <section className="mk-section" style={{ paddingBlock: 0 }}>
      <div className="mk-wrap">
        <div className="mk-stats">
          {rows.map((r) => (
            <Reveal key={r.label} className="mk-stat">
              <b>
                <CountUp to={r.v} decimals={r.dec || 0} />
                <sup>{r.suf}</sup>
              </b>
              <span>{r.label}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Adventures / moods ──────────────────────────────────────────────────── */
export function Adventures({ adventures, heroSlides }) {
  const { t } = useLocale();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const fromCms = (adventures || []).map((a) => ({
      id: a.$id,
      name: a.name,
      img: a.emoji,
      nav: () => navigate(`/search?adventures=${a.$id}`),
    }));
    if (fromCms.length >= 4) return fromCms.slice(0, 4);
    const extras = (heroSlides || [])
      .filter((s) => !fromCms.some((c) => c.name?.toLowerCase() === s.name?.toLowerCase()))
      .map((s) => ({ id: s.$id, name: s.name, img: slideCard(s), nav: () => navigate("/search") }));
    return [...fromCms, ...extras].slice(0, 4);
  }, [adventures, heroSlides, navigate]);

  if (!items.length) return null;

  return (
    <section className="mk-section">
      <div className="mk-wrap">
        <SectionHead eyebrow={t("adv_eyebrow")} title={<Lines text={t("adv_title")} />} />
      </div>
      <div className="mk-adv-row">
        {items.map((a, i) => (
          <Reveal as="figure" key={a.id} delay={i * 70} className="mk-adv" onClick={a.nav} style={{ margin: 0, cursor: "pointer" }}>
            <img src={a.img} alt={a.name} loading="lazy" />
            <figcaption>{a.name}</figcaption>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Testimonials ────────────────────────────────────────────────────────── */
const FALLBACK_QUOTES = [
  { text: "Organisation impeccable du premier appel jusqu'au retour. On a voyagé l'esprit léger — tout était prévu, sans surprise.", name: "Karim B.", city: "Casablanca" },
  { text: "Des prix vraiment tenus et une équipe qui répond, même un dimanche soir. C'est devenu notre agence pour tous nos départs.", name: "Salma R.", city: "Rabat" },
  { text: "Le voyage à Istanbul était exactement comme promis, hôtel compris. Sérieux rare — je recommande les yeux fermés.", name: "Youssef M.", city: "Marrakech" },
];

export function Testimonials({ testimonials }) {
  const { t } = useLocale();
  const [idx, setIdx] = useState(0);
  const [out, setOut] = useState(false);
  const busy = useRef(false);

  const items = useMemo(() => {
    const fromCms = (testimonials || []).map((x) => ({
      text: x.text,
      name: x.name,
      city: x.role || "",
    })).filter((x) => x.text);
    return fromCms.length ? fromCms : FALLBACK_QUOTES;
  }, [testimonials]);

  const go = (n) => {
    if (busy.current) return;
    busy.current = true;
    setOut(true);
    setTimeout(() => {
      setIdx(((n % items.length) + items.length) % items.length);
      setOut(false);
      busy.current = false;
    }, 460);
  };

  const q = items[idx];

  return (
    <section className="mk-section" id="testimonials" style={{ paddingTop: 0 }}>
      <div className="mk-wrap">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Reveal as="span" className="mk-eyebrow">{t("test_eyebrow")}</Reveal>
        </div>
        <Reveal className="mk-quote-box">
          <div className={`mk-quote-fade ${out ? "is-out" : ""}`}>
            <blockquote className="mk-quote">« {q.text} »</blockquote>
            <div className="mk-quote-who" style={{ marginTop: 22 }}>
              {q.name}{q.city ? ` — ${q.city}` : ""}
            </div>
          </div>
        </Reveal>
        {items.length > 1 && (
          <div className="mk-quote-nav">
            <button className="mk-qarrow" onClick={() => go(idx - 1)} aria-label={t("hero_prev")}>
              <span style={{ transform: "scaleX(-1)", display: "flex" }}><Arrow size={14} /></span>
            </button>
            <div className="mk-qdots">
              {items.map((_, i) => (
                <button key={i} className={i === idx ? "is-active" : ""} onClick={() => go(i)} aria-label={`${i + 1}`}>
                  <i />
                </button>
              ))}
            </div>
            <button className="mk-qarrow" onClick={() => go(idx + 1)} aria-label={t("hero_next")}>
              <Arrow size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── CTA band ────────────────────────────────────────────────────────────── */
export function CtaBand() {
  const { t } = useLocale();
  const navigate = useNavigate();
  return (
    <section className="mk-section mk-cta mk-grain">
      <div className="mk-wrap">
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
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */
export function Footer() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submitNews = (e) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) return;
    setSent(true);
    setEmail("");
  };

  const year = new Date().getFullYear();

  return (
    <footer className="mk-footer">
      <div className="mk-wrap">
        <div className="mk-footer-grid">
          <div className="mk-footer-brand">
            <a className="mk-logo" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <img className="mk-logo-img mk-logo-img--foot" src="/logo-256.png" alt="Follow Me Travel" />
            </a>
            <p>{t("footer_tag")}</p>
            <div className="mk-footer-contact">
              <a href="tel:+212664586425">+212 664 586 425</a>
              <a href="tel:+212520655575">+212 520 655 575</a>
              <a href="mailto:contact@followmetravel.ma">contact@followmetravel.ma</a>
            </div>
          </div>

          <div>
            <h4>{t("footer_dest")}</h4>
            <ul>
              {["Maroc", "Turquie", "Émirats", "Égypte", "Indonésie", "Espagne"].map((d) => (
                <li key={d}>
                  <a href="/search" onClick={(e) => { e.preventDefault(); navigate("/search"); }}>{d}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>{t("footer_house")}</h4>
            <ul>
              <li><a href="/#house" onClick={(e) => { e.preventDefault(); document.querySelector("#house")?.scrollIntoView({ behavior: "smooth" }); }}>{t("footer_about")}</a></li>
              <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }}>{t("footer_contact")}</a></li>
              <li><a href="#">{t("footer_terms")}</a></li>
              <li><a href="#">{t("footer_mice")}</a></li>
            </ul>
          </div>

          <div>
            <h4>{t("footer_news")}</h4>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>{t("footer_news_hint")}</p>
            {sent ? (
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

        <div className="mk-footer-bottom">
          <span>© {year} Follow Me Travel — {t("footer_rights")}</span>
          <span>Casablanca, Maroc</span>
        </div>
      </div>
    </footer>
  );
}
