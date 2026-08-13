import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePackages } from "../context/PackageViewerContext";
import { ReservationProvider } from "../context/ReservationContext";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal, Arrow } from "./ui";
import BookingFlow from "./BookingFlow";
import { upcomingDepartures } from "./dates";
import GeoMap from "./GeoMap";
import { resolvePlace } from "./geo";
import "./marketing.css";

const parsePrice = (str) => parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

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
export default function PackagePage() {
  const { fetchById, selectedPkg, loading } = usePackages();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pkgId = searchParams.get("pkgId");
  const [booking, setBooking] = useState(false);
  const [bookDateIdx, setBookDateIdx] = useState(null);
  const [lb, setLb] = useState(null);
  const [catTab, setCatTab] = useState(0);
  const [activeCh, setActiveCh] = useState(null);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  useEffect(() => {
    if (pkgId) fetchById(pkgId).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgId]);

  const doc = selectedPkg;
  const pkg = useMemo(
    () => (doc ? { ...(typeof doc.data === "object" ? doc.data : {}), $id: doc.$id, title: doc.title, basePrice: doc.basePrice, country: doc.country } : null),
    [doc]
  );

  const images = useMemo(() => {
    if (!pkg) return [];
    const list = [pkg.heroBg, ...(pkg.gallery || []).map((g) => g.url)].filter(Boolean);
    return [...new Set(list)];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openBooking = (dateIdx = null) => { setBookDateIdx(dateIdx); setBooking(true); };
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
  let chapN = 0;

  const specs = [
    pkg.durationLabel && { k: t("sr_duration"), v: pkg.durationLabel },
    pkg.periodLabel && { k: t("pk_period"), v: pkg.periodLabel },
    pkg.country && { k: t("sr_country"), v: pkg.country },
    cats.length > 0 && { k: t("sr_formules"), v: String(cats.length).padStart(2, "0") },
    dates.length > 0 && { k: t("sr_departures"), v: String(dates.length).padStart(2, "0") },
  ].filter(Boolean);

  return (
    <div className={`mk ${flat ? "mk--flat" : ""}`}>
      <Header />
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
              {(pkg.tagline || pkg.subtitleItalic) && (
                <p className="mk-pk-hero2-tag">{pkg.tagline || pkg.subtitleItalic}</p>
              )}
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

              {/* Itinerary — spine timeline */}
              {(pkg.days || []).length > 0 && (
                <section className="mk-pk-chap" id="ch-days" data-chapter="">
                  <ChapHead n={++chapN} title={pkg.itineraryTitle || t("pk_days")} />
                  <ol className="mk-pk-spine">
                    {pkg.days.map((d, i) => (
                      <Reveal as="li" key={d.id ?? i} delay={(i % 3) * 70}>
                        <div className="mk-pk-spine-mark" aria-hidden="true">
                          <i>{d.num || String(i + 1).padStart(2, "0")}</i>
                        </div>
                        <div className="mk-pk-spine-body">
                          {d.theme && <em className="mk-pk-spine-kicker">{d.theme}</em>}
                          <h3>
                            {d.title}
                            {d.badge && <span className="mk-sr-chip">{d.badge}</span>}
                          </h3>
                          {(d.activities || []).length > 0 && (
                            <ul className="mk-pk-spine-acts">
                              {d.activities.map((a, j) => (
                                <li key={a.id ?? j}>
                                  {a.label}
                                  {a.optional && <em> — {t("pk_optional")}</em>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {d.image && (
                            <figure className="mk-pk-spine-fig">
                              <img src={d.image} alt="" loading="lazy" />
                            </figure>
                          )}
                        </div>
                      </Reveal>
                    ))}
                  </ol>
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
                              <th>Triple</th><th>Double</th><th>Single</th><th>2–5 ans</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cats[catTab].hotels || []).map((h, i) => (
                              <tr key={h.id ?? i}>
                                <td>{h.name}</td>
                                <td>{h.city || "—"}</td>
                                <td>{h.nights || "—"}</td>
                                <td>{h.stars ? `${h.stars}★` : "—"}</td>
                                {[0, 1, 2, 3].map((c) => (
                                  <td key={c} className="mk-pk-price-cell">
                                    {parsePrice(h.cols?.[c]) ? nf.format(parsePrice(h.cols[c])) : "—"}
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
      <Footer />

      {lb !== null && (
        <Lightbox
          images={images}
          index={lb}
          onClose={() => setLb(null)}
          onMove={(d) => setLb((i) => (i + d + images.length) % images.length)}
        />
      )}

      {booking && (
        <ReservationProvider>
          <BookingFlow
            pkg={pkg}
            prefill={{ adults: searchParams.get("adults"), date: searchParams.get("date") }}
            initialDateIdx={bookDateIdx}
            onClose={() => { setBooking(false); setBookDateIdx(null); }}
          />
        </ReservationProvider>
      )}
    </div>
  );
}
