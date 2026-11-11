import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import WhatsAppButton from "./WhatsAppButton";
import { useAgency } from "../services/useAgency";
import { getAvailability } from "../services/operations";
import { cancellationLines, whatsappLink } from "../services/agency";
import { upcomingDepartures } from "./dates";
import GeoMap from "./GeoMap";
import { resolvePlace } from "./geo";
import { packageFromDoc, bookingPath } from "./packageDoc";
import { usePageMeta } from "./usePageMeta";
import { formuleMode } from "../services/formules";
import { breadcrumbJsonLd, packageJsonLd, packagePath, packageSeo } from "./seo";
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
  const params = useParams();
  const location = useLocation();
  // /voyages/<id>/<slug> (canonique) ou l'ancienne /packages/view?pkgId=<id>
  const pkgId = params.id || searchParams.get("pkgId");
  const [booking, setBooking] = useState(false);
  const [bookDateIdx, setBookDateIdx] = useState(null);
  const [lb, setLb] = useState(null);
  const [descModal, setDescModal] = useState(null); // {title, text} | null
  const [catTab, setCatTab] = useState(0);
  const [activeCh, setActiveCh] = useState(null);
  // Carte de réservation : départ, formule et voyageurs choisis avant d'ouvrir la page de réservation.
  const [selDate, setSelDate] = useState(null);
  const [selCat, setSelCat] = useState(0);
  const [selPax, setSelPax] = useState(2);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  useEffect(() => {
    if (preview) return;
    if (pkgId) fetchById(pkgId).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgId]);

  const doc = previewDoc || selectedPkg;
  const pkg = useMemo(() => packageFromDoc(doc, locale), [doc, locale]);

  // Une seule URL par voyage : l'ancienne adresse et un slug périmé sont
  // remplacés par /voyages/<id>/<slug> (contexte de réservation conservé).
  // Les liens d'aperçu de l'équipe (?mode=admin) restent tels quels.
  const canonicalPath = doc && !preview ? packagePath(doc.$id, doc.title) : null;
  useEffect(() => {
    if (!canonicalPath || searchParams.get("mode") || location.pathname === canonicalPath) return;
    const qs = new URLSearchParams(searchParams);
    qs.delete("pkgId");
    const q = qs.toString();
    navigate(`${canonicalPath}${q ? `?${q}` : ""}${location.hash}`, { replace: true });
  }, [canonicalPath, location.pathname, location.hash, searchParams, navigate]);

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
  const agency = useAgency();

  // Places restantes / supplément / garanti par départ (agrégats publics, sans donnée client).
  const [availability, setAvailability] = useState([]);
  const availId = preview ? null : doc?.$id;
  useEffect(() => {
    if (!availId) return;
    let alive = true;
    getAvailability(availId).then((a) => alive && setAvailability(a.departures)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [availId]);
  const availOf = (d) => availability.find((a) => a.from === d.from && (!d.to || a.to === d.to)) || null;

  const seo = useMemo(() => (doc && !preview ? packageSeo(doc) : null), [doc, preview]);
  const jsonLd = useMemo(() => {
    if (!seo) return null;
    const deps = availability.filter((a) => a.start).map((a) => ({ start: a.start, closed: a.closed, price: seo.price + (Number(a.supplement) || 0) }));
    return [packageJsonLd(seo, deps), breadcrumbJsonLd([["Accueil", "/"], ["Voyages", "/search"], [seo.title, seo.path]])];
  }, [seo, availability]);
  // Voyage retiré ou inexistant (l'API ne renvoie que les voyages publiés) : jamais indexé.
  const notFound = !pkg && !loading;
  usePageMeta(notFound ? t("pk_notfound") : pkg?.title || pkg?.destination, seo?.description, {
    path: seo?.path,
    image: seo?.image,
    jsonLd,
    noindex: notFound || preview || !!searchParams.get("mode"),
  });
  const cancellation = useMemo(() => cancellationLines(pkg?.cancellationPolicy ?? agency.cancellationPolicy), [pkg, agency]);
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
    list.push({ id: "ch-terms", label: "Conditions & garanties" });
    if (place) list.push({ id: "ch-map", label: t("pk_map") });
    // La galerie est en haut de fiche (mosaïque + visionneuse) : pas de chapitre.
    return list;

  }, [pkg, cats.length, dates.length, place, t]);

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

  const openBooking = (dateIdx = null, opts = {}) => {
    trackReserve({ targetId: pkg.$id, label: pkg.title || pkg.destination, page: window.location.pathname });
    // Aperçu de l'éditeur : pas d'URL publique, la page de réservation s'affiche sur place.
    if (preview) {
      setBookDateIdx(dateIdx);
      setBooking(true);
      window.scrollTo(0, 0);
      return;
    }
    navigate(bookingPath(pkg.$id, {
      dateIdx,
      adults: opts.adults ?? searchParams.get("adults"),
      date: searchParams.get("date"),
      formule: opts.formule,
    }));
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

  if (preview && booking) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
        <ReservationProvider>
          <BookingFlow
            asPage
            pkg={pkg}
            preview
            initialDateIdx={bookDateIdx}
            onClose={() => { setBooking(false); setBookDateIdx(null); }}
          />
        </ReservationProvider>
      </GoogleReCaptchaProvider>
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

  const kicker = [pkg.country, pkg.periodLabel ? `${t("pk_edition")} ${pkg.periodLabel}` : ""].filter(Boolean).join(" · ");
  // Accroche courte sous le titre, seulement si la description longue existe à part (sinon doublon).
  const lede = pkg.description ? String(pkg.tagline || pkg.subtitleItalic || "").trim() : "";
  const firstOpen = Math.max(0, dates.findIndex((d) => !availOf(d)?.closed));
  const dateValue = selDate ?? (dates.length ? firstOpen : null);
  const phones = agency.phones?.length ? agency.phones : [];
  const wa = whatsappLink(agency, `Bonjour, une question sur le voyage « ${pkg.title || pkg.destination} ».`);

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
        {/* ── Haut de fiche : fil d'Ariane + galerie mosaïque ── */}
        <section className="mk-pk-top">
          <div className="mk-wrap">
            <div className="mk-pk-top-bar">
              <nav className="mk-pk-crumb" aria-label="breadcrumb" style={{ margin: 0 }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>{t("pk_home")}</a>
                <i>/</i>
                <a href="/search" onClick={(e) => { e.preventDefault(); navigate("/search"); }}>{t("nav_trips")}</a>
                <i>/</i>
                <span aria-current="page">{pkg.title}</span>
              </nav>
            </div>

            {images.length > 0 && (
              <div className={`mk-pk-mosaic mk-pk-mosaic--${Math.min(images.length, 5)}`}>
                {images.slice(0, 5).map((src, i) => (
                  <button key={src} onClick={() => setLb(i)} aria-label={`${t("pk_gallery")} ${i + 1}`}>
                    <img src={src} alt="" fetchPriority={i === 0 ? "high" : undefined} loading={i > 0 ? "lazy" : undefined} />
                  </button>
                ))}
                {images.length > 1 && (
                  <button className="mk-pk-mosaic-all" onClick={() => setLb(0)}>
                    {t("pk_gallery")} · {String(images.length).padStart(2, "0")} {t("pk_photos")}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Corps : colonne de lecture + carte de réservation (sticky) ── */}
        <div className="mk-wrap">
          <div className="mk-pk-body">
            <div className="mk-pk-read">
              <header className="mk-pk-head">
                {kicker && <span className="mk-eyebrow">{kicker}</span>}
                <h1 className="mk-h2 mk-pk-title">{pkg.title || `${pkg.destination ?? ""}${pkg.destinationAccent ?? ""}`}</h1>
                {lede && <p className="mk-lead mk-pk-lede">{lede}</p>}
                {/* la description longue ferme la colonne de lecture — voir `.mk-pk-desc` */}
                <dl className="mk-pk-specs2">
                  {specs.map((r) => (
                    <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd></div>
                  ))}
                </dl>
              </header>

              {chapters.length > 1 && (
                <nav className="mk-pk-tabs" aria-label={t("pk_toc")}>
                  {chapters.map((c) => (
                    <a
                      key={c.id}
                      href={`#${c.id}`}
                      className={activeCh === c.id ? "is-active" : ""}
                      aria-current={activeCh === c.id ? "true" : undefined}
                      onClick={(e) => { e.preventDefault(); goCh(c.id); }}
                    >
                      {c.label}
                    </a>
                  ))}
                </nav>
              )}

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
                      <em className="mk-pk-sheet-cap">
                        {t("pk_table_note")}
                        {(cats[catTab].hotels || []).length > 1 && ` · ${t(formuleMode(cats[catTab]) === "circuit" ? "pk_circuit_note" : "pk_sejour_note")}`}
                      </em>
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
                    {dates.map((d, i) => {
                      const a = availOf(d);
                      const full = !!a?.closed;
                      return (
                        <Reveal as="button" key={d.id ?? i} delay={(i % 4) * 50} className={`mk-pk-ticket${full ? " is-full" : ""}`} disabled={full} onClick={() => !full && openBooking(i)}>
                          <em>{t("pk_departure")}</em>
                          <b>{d.from} → {d.to}</b>
                          {a && (
                            <small className="mk-pk-ticket-meta">
                              {full ? <i className="is-full">Complet</i> : a.remaining !== null && a.remaining <= 6 ? <i className="is-low">Plus que {a.remaining} place{a.remaining > 1 ? "s" : ""}</i> : null}
                              {a.guaranteed && !full && <i className="is-ok">Départ garanti</i>}
                              {a.supplement !== 0 && <i>{a.supplement > 0 ? "+" : "−"}{nf.format(Math.abs(a.supplement))} DH / pers.</i>}
                            </small>
                          )}
                          <span><Arrow size={13} /></span>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Conditions & garanties : confiance avant de réserver */}
              <section className="mk-pk-chap" id="ch-terms" data-chapter="">
                <ChapHead n={++chapN} title="Conditions & garanties" />
                <ul className="mk-pk-trust">
                  {(agency.trustBadges || []).map((b) => <li key={b}>✓ {b}</li>)}
                  {agency.licenceNumber && <li>✓ Licence d'agence de voyages n° {agency.licenceNumber}</li>}
                </ul>
                <h4 className="mk-pk-terms-h">Conditions d'annulation</h4>
                <ul className="mk-pk-terms">
                  {cancellation.map((l) => <li key={l}>{l}</li>)}
                </ul>
                <p className="mk-pk-terms-note">
                  Paiement : acompte de {agency.depositPercent} % à la confirmation, solde {agency.balanceDaysBeforeDeparture} jours avant le départ.{" "}
                  <a href="/legal/cgv" target="_blank" rel="noreferrer">Conditions générales de vente</a>
                </p>
              </section>

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

            <aside className="mk-pk-toc">
              <div className="mk-pk-book">
                <div className="mk-pk-book-top">
                  <div className="mk-pk-hero-price">
                    <span>{t("trips_from")}</span>
                    <b>{nf.format(priceFrom || 0)}<i>DH</i></b>
                    <span>{t("sr_per_person")} · {t("sr_night_note")}</span>
                  </div>
                  {!preview && <FavoriteButton id={pkg.$id} label={pkg.title || pkg.destination} className="mk-pk-fav" />}
                </div>
                {dates.length > 0 && (
                  <label className="mk-pk-field">
                    <span>{t("bk_date")}</span>
                    <select value={dateValue ?? ""} onChange={(e) => setSelDate(Number(e.target.value))}>
                      {dates.map((d, i) => {
                        const a = availOf(d);
                        const note = a?.closed ? t("dep_full") : a?.guaranteed ? t("dep_guaranteed") : "";
                        return (
                          <option key={d.id ?? i} value={i} disabled={!!a?.closed}>
                            {d.from} → {d.to}{note ? ` · ${note}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
                {cats.length > 1 && (
                  <label className="mk-pk-field">
                    <span>{t("bk_formule")}</span>
                    <select value={selCat} onChange={(e) => setSelCat(Number(e.target.value))}>
                      {cats.map((c, i) => <option key={c.id ?? i} value={i}>{c.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="mk-pk-field">
                  <span>{t("bk_pax_label")}</span>
                  <select value={selPax} onChange={(e) => setSelPax(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} {t("bk_travelers")}</option>
                    ))}
                  </select>
                </label>
                <button className="mk-btn" onClick={() => openBooking(dateValue, { adults: selPax, formule: cats.length > 1 ? selCat : undefined })}>
                  {t("pk_book")}
                  <span className="mk-btn-arrow"><Arrow size={14} /></span>
                </button>
                <p className="mk-pk-book-note">{t("pk_no_pay")}</p>
              </div>
              {(phones.length > 0 || wa) && (
                <div className="mk-pk-ask">
                  <b>{t("pk_question")}</b>
                  {phones.map((p) => <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a>)}
                  {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                </div>
              )}
            </aside>
          </div>
        </div>

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

      {!preview && <WhatsAppButton packageTitle={pkg.title || pkg.destination} />}
    </div>
  );
}
