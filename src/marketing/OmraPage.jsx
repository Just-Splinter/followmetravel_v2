import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTravelData } from "../context/TravelDataContext";
import { useLocale } from "./i18n";
import { omraFromPackages, omraYear } from "../services/omra";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal } from "./ui";
import OmraBooking from "./OmraBooking";
import "./marketing.css";
import "./omra.css";

/* ─── Ornaments ──────────────────────────────────────────────────────────── */

export function Star8({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" stroke="currentColor" strokeWidth="1" />
      <rect x="6.5" y="6.5" width="11" height="11" stroke="currentColor" strokeWidth="1" transform="rotate(45 12 12)" />
    </svg>
  );
}

function OmDivider() {
  return (
    <div className="om-div" aria-hidden="true">
      <Star8 />
    </div>
  );
}

/* deterministic starfield — no Math.random so flat captures stay stable */
const STARS = Array.from({ length: 54 }, (_, i) => ({
  x: ((i * 7919) % 1000) / 10,
  y: ((i * 104729) % 620) / 10,
  d: ((i * 613) % 70) / 10,
  s: 1 + ((i * 271) % 3) * 0.55,
}));

const Star = ({ st }) => (
  <i
    style={{
      left: `${st.x}%`,
      top: `${st.y}%`,
      width: st.s,
      height: st.s,
      animationDelay: `${st.d}s`,
    }}
  />
);

/* two depth layers — the far one drifts less under the cursor */
function Stars({ farRef, nearRef }) {
  return (
    <div className="om-stars" aria-hidden="true">
      <div className="l" ref={farRef}>
        {STARS.filter((_, i) => i % 2 === 0).map((st, i) => <Star key={i} st={st} />)}
      </div>
      <div className="l" ref={nearRef}>
        {STARS.filter((_, i) => i % 2 === 1).map((st, i) => <Star key={i} st={st} />)}
      </div>
    </div>
  );
}

/* the golden thread — chapters hang from it as the journey descends */
function OmThread() {
  return (
    <div className="om-thread" aria-hidden="true">
      <i />
      <Star8 size={13} />
    </div>
  );
}

/* pointed-arch photo frame */
const ARCH_CLIP =
  "M0,1 L0,0.2 C0,0.115 0.09,0.072 0.21,0.052 C0.35,0.027 0.45,0.012 0.5,0 C0.55,0.012 0.65,0.027 0.79,0.052 C0.91,0.072 1,0.115 1,0.2 L1,1 Z";
const ARCH_FRAME =
  "M2.5,129.5 L2.5,26.4 C2.5,15.2 14.4,9.5 27.7,6.9 C46.2,3.3 47.4,2 50,0.9 C52.6,2 53.8,3.3 72.3,6.9 C85.6,9.5 97.5,15.2 97.5,26.4 L97.5,129.5";

export function ArchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <clipPath id="om-arch-clip" clipPathUnits="objectBoundingBox">
          <path d={ARCH_CLIP} />
        </clipPath>
      </defs>
    </svg>
  );
}

function ArchFig({ src, latin, ar, eager = false }) {
  return (
    <figure className="om-arch">
      <div className="om-arch-img">
        <img src={src} alt={latin} loading={eager ? "eager" : "lazy"} />
      </div>
      <svg className="om-arch-frame" viewBox="0 0 100 132" preserveAspectRatio="none" aria-hidden="true">
        <path d={ARCH_FRAME} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>{latin}</span>
        <em>{ar}</em>
      </figcaption>
    </figure>
  );
}

/* thin-line inclusion icons (pathLength lets them draw themselves in) */
const INC_ICONS = {
  flight: <path pathLength="100" d="M2 16l20-8-8 4-2 8-3-6-7 2zM14 12L22 8" />,
  visa: <path pathLength="100" d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h3" />,
  hotel: <path pathLength="100" d="M3 20V10l7-5 7 5M3 20h18M17 20v-6h4v6M8 12h4v4H8z" />,
  bus: <path pathLength="100" d="M4 5h16v11H4zM4 16l1 4h2l1-3h8l1 3h2l1-4M4 10h16M8 13h.01M16 13h.01" />,
  guide: <path pathLength="100" d="M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 21c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />,
  ziyarat: <path pathLength="100" d="M4 21V12c0-4 3.6-7 8-7s8 3 8 7v9M4 21h16M12 5V3M9 21v-4a3 3 0 016 0v4" />,
};

function IncIcon({ k }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {INC_ICONS[k]}
    </svg>
  );
}

const starsOf = (n) => "★".repeat(Math.max(0, Math.min(5, Number(n) || 0)));

/* ─── Landing teaser — the gold doorway on the home page ─────────────────── */
export function OmraTeaser({ packages }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const year = omraYear(omraFromPackages(packages));
  return (
    <section className="om om-teaser" id="omra">
      <ArchDefs />
      <img src="/omra/hero-makkah.jpg" alt="" loading="lazy" />
      <Reveal className="om-teaser-in">
        <span className="om-kicker">{t("om_eyebrow")}</span>
        <span className="om-word" lang="ar">عُمْرَة {year}</span>
        <h2>{locale === "ar" ? `رحلة العمرة ${year}` : `Travel Omra ${year}`}</h2>
        <p>{t("om_teaser_d")}</p>
        <button className="om-teaser-btn" onClick={() => navigate("/omra")}>
          {t("om_teaser_btn")}
        </button>
      </Reveal>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function OmraPage() {
  const { t, locale } = useLocale();
  const { packages } = useTravelData();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null); // omra pkg being booked

  // starfield depth — two layers drift gently with the cursor
  const heroRef = useRef(null);
  const farRef = useRef(null);
  const nearRef = useRef(null);
  useEffect(() => {
    const hero = heroRef.current;
    const far = farRef.current;
    const near = nearRef.current;
    if (!hero || !far || !near) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (hero.closest(".mk--flat")) return;

    const pt = { x: 0, y: 0, cx: 0, cy: 0 };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      pt.cx += (pt.x - pt.cx) * 0.04;
      pt.cy += (pt.y - pt.cy) * 0.04;
      far.style.transform = `translate3d(${pt.cx * 7}px, ${pt.cy * 5}px, 0)`;
      near.style.transform = `translate3d(${pt.cx * 16}px, ${pt.cy * 11}px, 0)`;
    };
    raf = requestAnimationFrame(tick);
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      pt.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pt.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => { pt.x = 0; pt.y = 0; };
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const list = useMemo(() => omraFromPackages(packages), [packages]);
  const year = omraYear(list);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const flat = new URLSearchParams(window.location.search).has("flat");

  const incs = [
    { k: "flight", label: t("om_inc_flight") },
    { k: "visa", label: t("om_inc_visa") },
    { k: "hotel", label: t("om_inc_hotel") },
    { k: "bus", label: t("om_inc_bus") },
    { k: "guide", label: t("om_inc_guide") },
    { k: "ziyarat", label: t("om_inc_ziyarat") },
  ];

  const goPacks = () =>
    document.getElementById("om-forfaits")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className={`mk om ${flat ? "mk--flat" : ""}`}>
      <ArchDefs />
      <Header light />
      <main>
        {/* — Nuit du départ — */}
        <section className="om-hero" ref={heroRef}>
          <div className="om-hero-bg" aria-hidden="true">
            <img src="/omra/hero-makkah.jpg" alt="" fetchPriority="high" />
          </div>
          <div className="om-hero-shade" aria-hidden="true" />
          <Stars farRef={farRef} nearRef={nearRef} />
          <svg className="om-hero-orn" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <rect x="26" y="26" width="48" height="48" stroke="currentColor" strokeWidth="0.3" />
            <rect x="26" y="26" width="48" height="48" stroke="currentColor" strokeWidth="0.3" transform="rotate(45 50 50)" />
            <circle cx="50" cy="50" r="33.9" stroke="currentColor" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.2" strokeDasharray="0.2 1.8" />
          </svg>
          <div className="om-hero-in">
            <span className="om-kicker">{t("om_eyebrow")}</span>
            <span className="om-mask">
              <p className="om-talbiyah" lang="ar">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْك
              </p>
            </span>
            <OmDivider />
            <h1 className="om-hero-title">
              {t("om_title")} {year}
            </h1>
            <p className="om-hero-sub">{t("om_sub")}</p>
          </div>
          <div className="om-hero-cue" aria-hidden="true">
            <span>{t("om_scroll")}</span>
            <i />
          </div>
        </section>

        {/* — L'intention — */}
        <section className="om-niyya">
          <img className="om-niyya-medallion" src="/omra/ornament-calligraphy.jpg" alt="" loading="lazy" aria-hidden="true" />
          <Reveal className="om-niyya-in">
            <OmThread />
            <span className="om-word" lang="ar" style={{ marginTop: 0 }}>النِّيَّة</span>
            <h2>{t("om_niyya_title")}</h2>
            <p>{t("om_niyya_text")}</p>
          </Reveal>
        </section>

        {/* — Chapitre I : Makkah — */}
        <section className="om-chap om-chap--night" id="om-makkah">
          <Reveal className="om-chap-head">
            <OmThread />
            <span className="om-kicker">{t("om_mk_kicker")}</span>
            <span className="om-chap-ar" lang="ar">مَكَّةُ الْمُكَرَّمَة</span>
            <h2 className="om-chap-latin">{t("om_mk_title")}</h2>
            <p>{t("om_mk_text")}</p>
          </Reveal>
          <div className="om-wrap">
            <Reveal className="om-arches" delay={80}>
              <ArchFig src="/omra/makkah-kiswa.jpg" latin={t("om_mk_cap1")} ar="الكِسْوَة" />
              <ArchFig src="/omra/makkah-tawaf.jpg" latin={t("om_mk_cap2")} ar="الطَّوَاف" />
              <ArchFig src="/omra/makkah-corner.jpg" latin={t("om_mk_cap3")} ar="الْكَعْبَة" />
            </Reveal>
          </div>
        </section>
        <div className="om-band">
          <img src="/omra/makkah-arcade.jpg" alt="" loading="lazy" />
          <div className="om-band-quote">
            <em lang="ar">سَعْيٌ وَدُعَاء</em>
            <span>{t("om_band")}</span>
          </div>
        </div>

        {/* — L'aube : la dimension bascule — */}
        <div className="om-dawn">
          <img src="/omra/desert-dawn.jpg" alt="" loading="lazy" />
          <div className="om-dawn-quote">
            <em lang="ar">إِلَى طَيْبَةَ الطَّيِّبَة</em>
            <span>{t("om_dawn")}</span>
          </div>
        </div>

        {/* — Chapitre II : Madinah — */}
        <section className="om-chap om-chap--dawn" id="om-madinah">
          <Reveal className="om-chap-head">
            <OmThread />
            <span className="om-kicker" style={{ color: "var(--om-gold-deep)" }}>
              {t("om_md_kicker")}
            </span>
            <span className="om-chap-ar" lang="ar">الْمَدِينَةُ الْمُنَوَّرَة</span>
            <h2 className="om-chap-latin">{t("om_md_title")}</h2>
            <p>{t("om_md_text")}</p>
          </Reveal>
          <div className="om-wrap">
            <Reveal className="om-arches" delay={80}>
              <ArchFig src="/omra/madinah-arcade.jpg" latin={t("om_md_cap1")} ar="السَّكِينَة" />
              <ArchFig src="/omra/madinah-dome.jpg" latin={t("om_md_cap2")} ar="الْقُبَّةُ الْخَضْرَاء" />
              <ArchFig src="/omra/madinah-interior.jpg" latin={t("om_md_cap3")} ar="الرَّوْضَة" />
            </Reveal>
          </div>
        </section>

        {/* — Forfaits — */}
        <section className="om-packs" id="om-forfaits">
          <div className="om-wrap">
            <Reveal className="om-packs-head">
              <OmThread />
              <span className="om-kicker">{t("om_pk_kicker")}</span>
              <span className="om-word" lang="ar" style={{ color: "var(--om-gold-deep)" }}>
                عُمْرَة {year}
              </span>
              <h2 className="om-chap-latin" style={{ marginBottom: 0 }}>
                {t("om_pk_title")}
              </h2>
            </Reveal>

            {list.length === 0 ? (
              <Reveal className="om-packs-empty">
                <span className="om-word" lang="ar">قَرِيبًا</span>
                <h3 className="om-chap-latin" style={{ marginBottom: 0 }}>{t("om_pk_empty_t")}</h3>
                <p>{t("om_pk_empty_d")}</p>
                <div style={{ marginTop: 24 }}>
                  <button className="mk-btn mk-btn--sm" onClick={() => navigate("/contact")}>
                    {t("om_cta_contact")}
                  </button>
                </div>
              </Reveal>
            ) : (
              <div className="om-packs-list">
                {list.map((o, i) => (
                  <Reveal as="article" key={o.$id} className="om-pack" delay={(i % 2) * 90}>
                    <span className="om-pack-year">{t("om_title")} {o.year || year}</span>
                    <div>
                      <h3>{o.title}</h3>
                      {o.titleAr && <span className="om-pack-ar" lang="ar">{o.titleAr}</span>}

                      <dl className="om-pack-meta">
                        {o.duration && (
                          <div>
                            <dt>{t("om_pk_duration")}</dt>
                            <dd><b>{o.duration}</b></dd>
                          </div>
                        )}
                        <div>
                          <dt>{t("om_pk_route")}</dt>
                          <dd>
                            <b>{o.nightsMakkah ?? "—"}</b> {t("om_pk_n_mk")} · <b>{o.nightsMadinah ?? "—"}</b> {t("om_pk_n_md")}
                          </dd>
                        </div>
                        {o.makkahHotel?.name && (
                          <div>
                            <dt>{t("om_pk_hotel_mk")}</dt>
                            <dd>
                              {o.makkahHotel.name} <span className="om-stars-inline">{starsOf(o.makkahHotel.stars)}</span>
                              {o.makkahHotel.distance && <><br />{o.makkahHotel.distance}</>}
                            </dd>
                          </div>
                        )}
                        {o.madinahHotel?.name && (
                          <div>
                            <dt>{t("om_pk_hotel_md")}</dt>
                            <dd>
                              {o.madinahHotel.name} <span className="om-stars-inline">{starsOf(o.madinahHotel.stars)}</span>
                              {o.madinahHotel.distance && <><br />{o.madinahHotel.distance}</>}
                            </dd>
                          </div>
                        )}
                        {o.departureCity && (
                          <div>
                            <dt>{t("om_pk_departure")}</dt>
                            <dd><b>{o.departureCity}</b></dd>
                          </div>
                        )}
                      </dl>

                      {(o.dates || []).filter((d) => d.from).length > 0 && (
                        <div className="om-pack-dates">
                          {o.dates.filter((d) => d.from).map((d, j) => (
                            <div className="om-pack-date" key={j}>
                              <b>{d.from} → {d.to}</b>
                              {d.label && <span>{d.label}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {(o.includes || []).length > 0 && (
                        <ul className="om-pack-inc">
                          {o.includes.map((inc, j) => (
                            <li key={j}>{inc}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <aside className="om-pack-price">
                      <span className="om-pack-price-cap">{t("om_pk_pricing")}</span>
                      {(o.pricing || [])
                        .filter((p) => Number(p.price) > 0)
                        .map((p) => (
                          <div className="om-price-row" key={p.key || p.label}>
                            <span className="l">
                              {p.label}
                              {p.labelAr && <em lang="ar">{p.labelAr}</em>}
                            </span>
                            <b>
                              {nf.format(Number(p.price))} DH<i>/{t("om_pk_pp")}</i>
                            </b>
                          </div>
                        ))}
                      {Number(o.childPrice) > 0 && (
                        <div className="om-price-row">
                          <span className="l">{t("om_pk_child")}</span>
                          <b>
                            {nf.format(Number(o.childPrice))} DH<i>/{t("om_pk_pp")}</i>
                          </b>
                        </div>
                      )}
                      <p className="om-price-note">{t("om_pk_note")}</p>
                      <button className="om-book-btn" onClick={() => setBooking(o)}>
                        {t("om_pk_book")}
                      </button>
                    </aside>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* — Inclusions — */}
        <section className="om-inc">
          <div className="om-wrap">
            <Reveal style={{ textAlign: "center" }}>
              <span className="om-kicker" style={{ color: "var(--om-gold-deep)" }}>
                {t("om_inc_kicker")}
              </span>
              <h2 className="om-chap-latin" style={{ marginTop: 14 }}>{t("om_inc_title")}</h2>
            </Reveal>
            <Reveal className="om-inc-grid" delay={80}>
              {incs.map((inc) => (
                <div className="om-inc-cell" key={inc.k}>
                  <IncIcon k={inc.k} />
                  <span>{inc.label}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* — Le retour — */}
        <section className="om-cta">
          <img src="/omra/madinah-court.jpg" alt="" loading="lazy" />
          <Reveal className="om-cta-in">
            <span className="om-word" lang="ar">رِحْلَةُ الْعُمْر</span>
            <h2>{t("om_cta_t")}</h2>
            <p>{t("om_cta_d")}</p>
            <div className="om-cta-row">
              <button className="om-cta-gold" onClick={goPacks}>{t("om_cta_book")}</button>
              <button className="om-cta-ghost" onClick={() => navigate("/contact")}>
                {t("om_cta_contact")}
              </button>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />

      {booking && (
        <OmraBooking pkg={booking} onClose={() => setBooking(null)} />
      )}
    </div>
  );
}
