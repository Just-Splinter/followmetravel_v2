import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { RECAPTCHA_SITE_KEY } from "../services/recaptcha";
import { usePackages } from "../context/PackageViewerContext";
import { ReservationProvider } from "../context/ReservationContext";
import { useEvents } from "../context/EventsContext";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal, Arrow, FavoriteButton } from "./ui";
import BookingFlow from "./BookingFlow";
import { upcomingDepartures } from "./dates";
import GeoMap from "./GeoMap";
import { resolvePlace } from "./geo";
import { localizeData } from "../services/translate";
import { usePageMeta } from "./usePageMeta";
import { roomTypesFor } from "../services/roomTypes";
import "./marketing.css";

const parsePrice = (str) => parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

/* The package's long description is clamped to a hard maximum of 32 words in
   the reading column; the full text lives in the modal below. */
const DESC_WORD_CAP = 32;
const clampWords = (text, cap = DESC_WORD_CAP) => {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  return words.length > cap
    ? { text: `${words.slice(0, cap).join(" ")}…`, truncated: true }
    : { text: words.join(" "), truncated: false };
};

/* ─── Route timeline leg — a dotted travel route meandering between days.
   Desktop path swings toward the plate side (the line dives behind the
   photo); mobile path hugs the leading edge. RTL mirrors both. ─────────── */
function LegPath({ flip, rtl }) {
  const dir = (flip ? -1 : 1) * (rtl ? -1 : 1);
  const bx = 50 + dir * 30;
  const mb = rtl ? 94 : 6;
  const ms = mb + (rtl ? -7 : 7);
  const dDesk = `M 50 0 C 50 22, ${bx} 30, ${bx} 50 C ${bx} 72, 50 80, 50 100`;
  const dMob = `M ${mb} 0 C ${mb} 26, ${ms} 34, ${ms} 50 C ${ms} 72, ${mb} 80, ${mb} 100`;
  return (
    <svg className="mk-pk-leg-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="mk-pk-leg-track is-desk" d={dDesk} pathLength="100" vectorEffect="non-scaling-stroke" />
      <path className="mk-pk-leg-dash is-desk" d={dDesk} pathLength="100" vectorEffect="non-scaling-stroke" />
      <path className="mk-pk-leg-track is-mob" d={dMob} pathLength="100" vectorEffect="non-scaling-stroke" />
      <path className="mk-pk-leg-dash is-mob" d={dMob} pathLength="100" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ─── Lightbox ───────────────────────────────────────────────────────────── */
function Lightbox({ images, index, onClose, onMove }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, onMove]);
  return (
    <div className="mk-pk-lightbox" onClick={onClose}>
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="mk-pk-lb-close" onClick={onClose} aria-label="✕">✕</button>
      {images.length > 1 && (
        <>
          <button className="mk-pk-lb-nav mk-pk-lb-prev" onClick={(e) => { e.stopPropagation(); onMove(-1); }}>
            <span style={{ transform: "scaleX(-1)", display: "flex" }}><Arrow /></span>
          </button>
          <button className="mk-pk-lb-nav mk-pk-lb-next" onClick={(e) => { e.stopPropagation(); onMove(1); }}>
            <Arrow />
          </button>
        </>
      )}
      <span className="mk-pk-lb-count">{index + 1} / {images.length}</span>
    </div>
  );
}

/* ─── Description modal — same overlay contract as Lightbox / BookingFlow:
   overlay click, ✕, Escape, and a body scroll-lock while open. ──────────── */
function DescModal({ title, text, closeLabel, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="mk-pk-desc-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mk-pk-desc-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mk-pk-desc-head">
          <h3>{title}</h3>
          <button className="mk-pk-desc-close" onClick={onClose} aria-label={closeLabel}>✕</button>
        </div>
        <p className="mk-pk-desc-full">{text}</p>
      </div>
    </div>
  );
}

/* ─── Chapter header ─────────────────────────────────────────────────────── */
function ChapHead({ n, title, badge }) {
  return (
    <header className="mk-ch-head">
      <i>{String(n).padStart(2, "0")}</i>
      <h2>
        {title}
        {badge && <span className="mk-sr-chip mk-sr-chip--accent">{badge}</span>}
      </h2>
    </header>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
/* previewDoc: when set (dashboard editor preview), the page renders that
   document instead of fetching, drops Header/Footer, and the booking flow
   refuses to submit. */
export default function PackagePage({ previewDoc = null }) {
  const preview = !!previewDoc;
  const { fetchById, selectedPkg, loading } = usePackages();
  const { t, locale, isRTL } = useLocale();
  const { trackPackageView, trackReserve } = useEvents();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pkgId = searchParams.get("pkgId");
  const [booking, setBooking] = useState(false);
  const [bookDateIdx, setBookDateIdx] = useState(null);
  const [lb, setLb] = useState(null);
  const [descModal, setDescModal] = useState(null); // {title, text} | null
  const [catTab, setCatTab] = useState(0);
  const [activeCh, setActiveCh] = useState(null);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  useEffect(() => {
    if (preview) return;
    if (pkgId) fetchById(pkgId).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgId]);

  const doc = previewDoc || selectedPkg;
  const pkg = useMemo(() => {
    if (!doc) return null;
    const raw = typeof doc.data === "object" && doc.data !== null ? doc.data : (() => { try { return JSON.parse(doc.data) || {}; } catch { return {}; } })();
    const d = localizeData(raw, locale);
    return { ...d, $id: doc.$id, title: doc.title, basePrice: doc.basePrice, country: d.country || doc.country };
  }, [doc, locale]);

  usePageMeta(
    pkg?.title || pkg?.destination,
    pkg?.tagline || pkg?.subtitleItalic || (pkg ? `${pkg.destination || pkg.title}${pkg.country ? ", " + pkg.country : ""}${pkg.durationLabel ? " — " + pkg.durationLabel : ""}` : undefined)
  );

  // Fires once per package (not per locale switch) — keyed on $id only.
  useEffect(() => {
    if (preview || !pkg?.$id) return;
    trackPackageView({ targetId: pkg.$id, label: pkg.title || pkg.destination, page: window.location.pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, pkg?.$id]);

  const images = useMemo(() => {
    if (!pkg) return [];
    const list = [pkg.heroBg, ...(pkg.gallery || []).map((g) => g.url)].filter(Boolean);
    return [...new Set(list)];
  }, [pkg]);

  // route timeline — a compass marker travels the dotted route as you scroll
  const routeRef = useRef(null);
  const markerRef = useRef(null);
  useEffect(() => {
    const route = routeRef.current;
    const marker = markerRef.current;
    if (!route || !marker) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (route.closest(".mk--flat")) return;
    const legs = Array.from(route.querySelectorAll(".mk-pk-leg"));
    if (!legs.length) return;

    let paths = [];
    let lens = [];
    const measure = () => {
      const desk = window.matchMedia("(min-width: 760px)").matches;
      paths = legs.map((l) => l.querySelector(desk ? ".mk-pk-leg-track.is-desk" : ".mk-pk-leg-track.is-mob"));
      lens = paths.map((p) => p.getTotalLength());
    };

    const pos = { x: 0, y: 0, cx: 0, cy: 0 };
    const calc = () => {
      const anchor = window.innerHeight * 0.42;
      let li = 0;
      let p = 0;
      for (let i = 0; i < legs.length; i++) {
        const r = legs[i].getBoundingClientRect();
        if (anchor >= r.top) { li = i; p = Math.min(1, (anchor - r.top) / r.height); }
      }
      const r = legs[li].getBoundingClientRect();
      const rr = route.getBoundingClientRect();
      const pt = paths[li].getPointAtLength(p * lens[li]);
      pos.x = r.left - rr.left + (pt.x / 100) * r.width;
      pos.y = r.top - rr.top + (pt.y / 100) * r.height;
    };
    measure();
    calc();
    pos.cx = pos.x;
    pos.cy = pos.y;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      pos.cx += (pos.x - pos.cx) * 0.12;
      pos.cy += (pos.y - pos.cy) * 0.12;
      marker.style.transform = `translate3d(${pos.cx}px, ${pos.cy}px, 0) translate(-50%, -50%)`;
    };
    raf = requestAnimationFrame(tick);

    const onScroll = () => calc();
    const onResize = () => { measure(); calc(); };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onResize);
    marker.style.opacity = "1";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [pkg]);

  const dates = useMemo(() => upcomingDepartures(pkg?.departureDates), [pkg]);
  const cats = pkg?.hotelCategories || [];
  const place = useMemo(
    () => (pkg ? resolvePlace(pkg.destination, pkg.destinationAccent, pkg.title, pkg.country) : null),
    [pkg]
  );

  const chapters = useMemo(() => {
    if (!pkg) return [];
    const list = [];
    (pkg.sections || []).forEach((s, i) => list.push({ id: `ch-s${i}`, label: s.title }));
    if ((pkg.days || []).length) list.push({ id: "ch-days", label: pkg.itineraryTitle || t("pk_days") });
    if (cats.length) list.push({ id: "ch-hotels", label: t("pk_formules") });
    if (dates.length) list.push({ id: "ch-dates", label: t("pk_dates") });
    if (place) list.push({ id: "ch-map", label: t("pk_map") });
    if (images.length > 1) list.push({ id: "ch-gallery", label: t("pk_gallery") });
    return list;
     
  }, [pkg, cats.length, dates.length, images.length, place, t]);

  /* scrollspy for the chapter rail */
  useEffect(() => {
    if (!pkg) return;
    const els = [...document.querySelectorAll("[data-chapter]")];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveCh(e.target.id); }),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pkg, chapters.length]);

  const openBooking = (dateIdx = null) => {
    trackReserve({ targetId: pkg.$id, label: pkg.title || pkg.destination, page: window.location.pathname });
    setBookDateIdx(dateIdx);
    setBooking(true);
  };
  const goCh = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const flat = new URLSearchParams(window.location.search).has("flat");

  if (!pkg && !loading) {
    return (
      <div className="mk">
        <Header />
        <main className="mk-wrap mk-page-head" style={{ paddingBottom: 120 }}>
          <h1 className="mk-h2">{t("pk_notfound")}</h1>
        </main>
        <Footer />
      </div>
    );
  }
  if (!pkg) {
    return (
      <div className="mk">
        <Header />
        <main style={{ minHeight: "70vh" }} />
      </div>
    );
  }

  const priceFrom = pkg.basePrice || parsePrice(cats[0]?.basePrice);
  // Same derivation the booking wizard uses, so the price sheet and the
  // steppers can never show a different set of room columns.
  const catRoomTypes = roomTypesFor(cats[catTab]);
  let chapN = 0;

  /* The package's long description. `description` is the editor's dedicated
     long-text field; older documents only carry the hero `tagline` /
     `subtitleItalic`, which is exactly the text the hero used to print. */
  const descFull = String(pkg.description || pkg.tagline || pkg.subtitleItalic || "").trim();
  const desc = descFull ? clampWords(descFull) : null;

  const specs = [
    pkg.durationLabel && { k: t("sr_duration"), v: pkg.durationLabel },
    pkg.periodLabel && { k: t("pk_period"), v: pkg.periodLabel },
    pkg.country && { k: t("sr_country"), v: pkg.country },
    cats.length > 0 && { k: t("sr_formules"), v: String(cats.length).padStart(2, "0") },
    dates.length > 0 && { k: t("sr_departures"), v: String(dates.length).padStart(2, "0") },
  ].filter(Boolean);

  return (
    <div className={`mk ${flat ? "mk--flat" : ""}`}>
      {!preview && <Header />}
      <main>
        {/* ── Composed hero: title tucked behind the mounted plate ── */}
        <section className="mk-pk-hero2 mk-grain">
          <div className="mk-wrap mk-pk-hero2-top">
            <nav className="mk-pk-crumb" aria-label="breadcrumb" style={{ margin: 0 }}>
              <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>{t("pk_home")}</a>
              <i>/</i>
              <a href="/search" onClick={(e) => { e.preventDefault(); navigate("/search"); }}>{t("nav_trips")}</a>
            </nav>
            {(pkg.periodLabel || pkg.country) && (
              <span className="mk-pk-hero2-ed">
                <em>{t("pk_edition")}</em> {pkg.periodLabel || pkg.country}
              </span>
            )}
          </div>

          <h1 className="mk-pk-hero2-ttl">
            <span className="mk-line"><span className="mk-rise">{pkg.destination || pkg.title}</span></span>
            {pkg.destinationAccent && (
              <span className="mk-line mk-pk-hero2-l2">
                <span className="mk-rise mk-rise--d2"><em>{pkg.destinationAccent}</em></span>
              </span>
            )}
          </h1>

          <div className="mk-wrap mk-pk-hero2-stage">
            <div className="mk-pk-hero2-left">
              {/* the long description now closes the reading column — see
                  `.mk-pk-desc` at the end of `.mk-pk-read` */}
              <dl className="mk-pk-specs2">
                {specs.map((r) => (
                  <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>
                ))}
              </dl>
              <div className="mk-pk-hero2-cta">
                <div className="mk-pk-hero-price">
                  <span>{t("trips_from")}</span>
                  <b>{nf.format(priceFrom || 0)}<i>DH</i></b>
                  <span>{t("sr_per_person")} · {t("sr_night_note")}</span>
                </div>
                <button className="mk-btn" onClick={() => openBooking()}>{t("pk_book")}</button>
                {!preview && <FavoriteButton id={pkg.$id} label={pkg.title || pkg.destination} className="mk-pk-fav" />}
              </div>
            </div>

            <figure className="mk-pk-hero2-plate">
              {images[0] && <img src={images[0]} alt="" fetchPriority="high" />}
              {images.length > 1 && (
                <button className="mk-pk-hero2-galbtn" onClick={() => setLb(0)}>
                  {t("pk_gallery")} · {String(images.length).padStart(2, "0")}
                </button>
              )}
            </figure>
          </div>

          <div className="mk-wrap mk-pk-hero2-foot">
            <span className="mk-pk-scrollcue" aria-hidden="true">
              <i />
              {t("pk_scroll")}
            </span>
            <div className="mk-pk-hero-phones">
              <span>{t("pk_question")}</span>
              <a href="tel:+212664586425">+212 664 586 425</a>
              <a href="tel:+212520655575">+212 520 655 575</a>
            </div>
          </div>
        </section>

        {/* ── Body: chapter rail + reading column ── */}
        <div className="mk-wrap">
          <div className="mk-pk-body">
            <aside className="mk-pk-toc">
              <em>{t("pk_toc")}</em>
              <nav>
                {chapters.map((c, i) => (
                  <a
                    key={c.id}
                    href={`#${c.id}`}
                    className={activeCh === c.id ? "is-active" : ""}
                    onClick={(e) => { e.preventDefault(); goCh(c.id); }}
                  >
                    <i>{String(i + 1).padStart(2, "0")}</i>
                    <span>{c.label}</span>
                  </a>
                ))}
              </nav>
              <div className="mk-pk-toc-card">
                <span>{t("trips_from")}</span>
                <b>{nf.format(priceFrom || 0)} DH</b>
                <button className="mk-btn mk-btn--paper mk-btn--sm" onClick={() => openBooking()}>
                  {t("card_book")}
                </button>
              </div>
            </aside>

            <div className="mk-pk-read">
              {/* CMS sections */}
              {(pkg.sections || []).map((s, i) => (
                <Reveal as="section" key={s.id ?? i} id={`ch-s${i}`} data-chapter="" className="mk-pk-chap">
                  <ChapHead n={++chapN} title={s.title} badge={s.badge} />
                  <ul className="mk-pk-items">
                    {(s.items || []).map((it) => (
                      <li key={it.id ?? it.text}>{it.text}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}

              {/* Itinerary — "la route": dotted travel route with day stations */}
              {(pkg.days || []).length > 0 && (
                <section className="mk-pk-chap" id="ch-days" data-chapter="">
                  <ChapHead n={++chapN} title={pkg.itineraryTitle || t("pk_days")} />
                  <div className="mk-pk-route" ref={routeRef}>
                    <div className="mk-pk-route-cap" aria-hidden="true">
                      <i /><span>{t("pk_route_start")}</span>
                    </div>
                    <ol className="mk-pk-route-legs">
                      {pkg.days.map((d, i) => {
                        const num = d.num || String(i + 1).padStart(2, "0");
                        const dayTheme = String(d.theme || "").trim();
                        const dayKicker = dayTheme && dayTheme.split(/\s+/).length <= 8 ? dayTheme : null;
                        const dayDesc = dayTheme && !dayKicker ? clampWords(dayTheme) : null;
                        return (
                          <li key={d.id ?? i} className={`mk-pk-leg ${i % 2 ? "is-flip" : ""}`}>
                            <LegPath flip={i % 2 === 1} rtl={isRTL} />
                            <div className="mk-pk-leg-station" aria-hidden="true"><i>{num}</i></div>
                            <Reveal className="mk-pk-leg-grid" delay={60}>
                              <div className="mk-pk-leg-body">
                                <span className="mk-pk-leg-ghost" aria-hidden="true">{num}</span>
                                {/* Short themes are true kickers ("ARRIVÉE & INSTALLATION");
                                    longer text is a day DESCRIPTION and renders LAST,
                                    clamped, with the full text in the modal. */}
                                {dayKicker && <em className="mk-pk-leg-kicker">{dayKicker}</em>}
                                <h3>
                                  {d.title}
                                  {d.badge && <span className="mk-sr-chip">{d.badge}</span>}
                                </h3>
                                {(d.activities || []).length > 0 && (
                                  <ul className="mk-pk-leg-acts">
                                    {d.activities.map((a, j) => (
                                      <li key={a.id ?? j}>
                                        {a.label}
                                        {a.optional && <em> — {t("pk_optional")}</em>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {dayDesc && (dayDesc.truncated ? (
                                  <button
                                    className="mk-pk-leg-desc"
                                    onClick={() => setDescModal({ title: d.title, text: dayTheme })}
                                    aria-haspopup="dialog"
                                  >
                                    <span>{dayDesc.text}</span>
                                    <span className="mk-pk-desc-more">
                                      {t("pk_desc_more")}
                                      <Arrow size={12} />
                                    </span>
                                  </button>
                                ) : (
                                  <p className="mk-pk-leg-desc is-static">{dayDesc.text}</p>
                                ))}
                              </div>
                              {d.image && (
                                <figure className="mk-pk-leg-fig">
                                  <img src={d.image} alt="" loading="lazy" />
                                </figure>
                              )}
                            </Reveal>
                          </li>
                        );
                      })}
                    </ol>
                    <div className="mk-pk-route-cap is-end" aria-hidden="true">
                      <i /><span>{t("pk_route_end")}</span>
                    </div>
                    <div className="mk-pk-route-marker" ref={markerRef} aria-hidden="true"><i /></div>
                  </div>
                </section>
              )}

              {/* Formules & hotels — price sheet */}
              {cats.length > 0 && (
                <section className="mk-pk-chap" id="ch-hotels" data-chapter="">
                  <ChapHead n={++chapN} title={t("pk_formules")} />
                  {cats.length > 1 && (
                    <div className="mk-bk-pills" style={{ marginBottom: 20 }}>
                      {cats.map((c, i) => (
                        <button key={c.id ?? i} className={i === catTab ? "is-active" : ""} onClick={() => setCatTab(i)}>
                          {c.label}
                          {c.basePrice && <em>{nf.format(parsePrice(c.basePrice))} DH</em>}
                        </button>
                      ))}
                    </div>
                  )}
                  {cats[catTab] && (
                    <div className="mk-pk-sheet">
                      <em className="mk-pk-sheet-cap">{t("pk_table_note")}</em>
                      <div className="mk-pk-tablewrap">
                        <table className="mk-pk-table">
                          <thead>
                            <tr>
                              {(cats[catTab].tableHeaders || ["Hôtel", "Ville", "Nuits", "★"]).slice(0, 4).map((h) => <th key={h}>{h}</th>)}
                              {/* Price columns come from the formule itself, so a custom
                                  room type added in the editor ("Baby 1-2") shows up here. */}
                              {catRoomTypes.map((rt) => <th key={rt.key}>{rt.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(cats[catTab].hotels || []).map((h, i) => (
                              <tr key={h.id ?? i}>
                                <td>{h.name}</td>
                                <td>{h.city || "—"}</td>
                                <td>{h.nights || "—"}</td>
                                <td>{h.stars ? `${h.stars}★` : "—"}</td>
                                {catRoomTypes.map((rt) => (
                                  <td key={rt.key} className="mk-pk-price-cell">
                                    {parsePrice(h.cols?.[rt.colIdx]) ? (
                                      <>
                                        {nf.format(parsePrice(h.cols[rt.colIdx]))}
                                        <em className="mk-pk-price-pp">{t("sr_per_person")}</em>
                                      </>
                                    ) : "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {cats[catTab].note && <p className="mk-pk-tnote">{cats[catTab].note}</p>}
                    </div>
                  )}
                </section>
              )}

              {/* Departure tickets */}
              {dates.length > 0 && (
                <section className="mk-pk-chap" id="ch-dates" data-chapter="">
                  <ChapHead n={++chapN} title={t("pk_dates")} />
                  <div className="mk-pk-tickets">
                    {dates.map((d, i) => (
                      <Reveal as="button" key={d.id ?? i} delay={(i % 4) * 50} className="mk-pk-ticket" onClick={() => openBooking(i)}>
                        <em>{t("pk_departure")}</em>
                        <b>{d.from} → {d.to}</b>
                        <span><Arrow size={13} /></span>
                      </Reveal>
                    ))}
                  </div>
                </section>
              )}

              {/* Location map */}
              {place && (
                <section className="mk-pk-chap" id="ch-map" data-chapter="">
                  <ChapHead n={++chapN} title={t("pk_map")} />
                  <GeoMap
                    markers={[{ lat: place.latlng[0], lng: place.latlng[1], label: pkg.country }]}
                    height={340}
                    zoom={place.city ? 8 : 5}
                    className="mk-pk-geomap"
                  />
                </section>
              )}

              {/* Description — always the last block of the reading column */}
              {desc && (
                <section className="mk-pk-desc">
                  <span className="mk-eyebrow">{t("pk_desc_title")}</span>
                  <button
                    className="mk-pk-desc-teaser"
                    onClick={() => setDescModal({ title: t("pk_desc_title"), text: descFull })}
                    aria-haspopup="dialog"
                  >
                    <span className="mk-pk-desc-clamp">{desc.text}</span>
                    <span className="mk-pk-desc-more">
                      {t("pk_desc_more")}
                      <Arrow size={12} />
                    </span>
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* ── Full-bleed gallery strip ── */}
        {images.length > 1 && (
          <section className="mk-pk-strip" id="ch-gallery" data-chapter="">
            <div className="mk-wrap">
              <div className="mk-pk-strip-head">
                <span className="mk-eyebrow">{t("pk_gallery")}</span>
                <span className="mk-pk-strip-count">{String(images.length).padStart(2, "0")} {t("pk_photos")}</span>
              </div>
            </div>
            <div className="mk-pk-strip-rail">
              {images.map((src, i) => (
                <button key={src} onClick={() => setLb(i)} aria-label={`${t("pk_gallery")} ${i + 1}`}>
                  <img src={src} alt="" loading={i > 2 ? "lazy" : undefined} />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* mobile CTA bar */}
        <div className="mk-pk-mobilebar">
          <div>
            <span>{t("trips_from")}</span>
            <b>{nf.format(priceFrom || 0)} DH</b>
          </div>
          <button className="mk-btn mk-btn--sm" onClick={() => openBooking()}>{t("pk_book")}</button>
        </div>
      </main>
      {!preview && <Footer />}

      {lb !== null && (
        <Lightbox
          images={images}
          index={lb}
          onClose={() => setLb(null)}
          onMove={(d) => setLb((i) => (i + d + images.length) % images.length)}
        />
      )}

      {descModal && (
        <DescModal
          title={descModal.title}
          text={descModal.text}
          closeLabel={t("pk_desc_close")}
          onClose={() => setDescModal(null)}
        />
      )}

      {booking && (
        <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
          <ReservationProvider>
            <BookingFlow
              pkg={pkg}
              preview={preview}
              prefill={{ adults: searchParams.get("adults"), date: searchParams.get("date") }}
              initialDateIdx={bookDateIdx}
              onClose={() => { setBooking(false); setBookDateIdx(null); }}
            />
          </ReservationProvider>
        </GoogleReCaptchaProvider>
      )}
    </div>
  );
}
