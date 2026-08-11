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

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function PackagePage() {
  const { fetchById, selectedPkg, loading } = usePackages();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pkgId = searchParams.get("pkgId");
  const [booking, setBooking] = useState(false);
  const [lb, setLb] = useState(null);
  const [catTab, setCatTab] = useState(0);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  useEffect(() => {
    if (pkgId) fetchById(pkgId).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgId]);

  const doc = selectedPkg;
  const pkg = useMemo(() => (doc ? { ...(typeof doc.data === "object" ? doc.data : {}), $id: doc.$id, title: doc.title, basePrice: doc.basePrice, country: doc.country } : null), [doc]);

  const images = useMemo(() => {
    if (!pkg) return [];
    const list = [pkg.heroBg, ...(pkg.gallery || []).map((g) => g.url)].filter(Boolean);
    return [...new Set(list)];
  }, [pkg]);

  const dates = useMemo(() => upcomingDepartures(pkg?.departureDates), [pkg]);

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

  const name = `${pkg.destination ?? ""}${pkg.destinationAccent ?? ""}` || pkg.title;
  const cats = pkg.hotelCategories || [];
  const cat = cats[catTab];
  const priceFrom = pkg.basePrice || parsePrice(cats[0]?.basePrice);

  return (
    <div className="mk">
      <Header />
      <main style={{ paddingTop: 108 }}>
        {/* head */}
        <div className="mk-wrap">
          <nav className="mk-pk-crumb" aria-label="breadcrumb">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>{t("pk_home")}</a>
            <i>/</i>
            <a href="/search" onClick={(e) => { e.preventDefault(); navigate("/search"); }}>{t("nav_trips")}</a>
            <i>/</i>
            <span>{name}</span>
          </nav>
          <div className="mk-pk-head">
            <div>
              <Reveal as="h1" className="mk-pk-title">
                {pkg.destination}
                <em>{pkg.destinationAccent}</em>
              </Reveal>
              {(pkg.tagline || pkg.subtitleItalic) && (
                <Reveal as="p" delay={80} className="mk-lead">{pkg.tagline || pkg.subtitleItalic}</Reveal>
              )}
              <Reveal delay={140} className="mk-pk-chips">
                {pkg.durationLabel && <span className="mk-sr-chip">{pkg.durationLabel}</span>}
                {pkg.periodLabel && <span className="mk-sr-chip">{pkg.periodLabel}</span>}
                {pkg.country && <span className="mk-sr-chip">{pkg.country}</span>}
                {cats.length > 0 && <span className="mk-sr-chip">{cats.length} {t("sr_formules").toLowerCase()}</span>}
              </Reveal>
            </div>
          </div>
        </div>

        {/* gallery */}
        {images.length > 0 && (
          <div className="mk-wrap">
            <div className={`mk-pk-gallery n${Math.min(images.length, 5)}`}>
              {images.slice(0, 5).map((src, i) => (
                <button key={src} className="mk-pk-gcell" onClick={() => setLb(i)} aria-label={`${t("pk_gallery")} ${i + 1}`}>
                  <img src={src} alt="" loading={i > 0 ? "lazy" : undefined} />
                  {i === 4 && images.length > 5 && <span className="mk-pk-more">+{images.length - 5}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* content + booking rail */}
        <div className="mk-wrap" style={{ paddingBottom: 120 }}>
          <div className="mk-pk-layout">
            <div className="mk-pk-main">
              {/* sections */}
              {(pkg.sections || []).map((s) => (
                <Reveal as="section" key={s.id ?? s.title} className="mk-pk-block">
                  <h2>{s.title} {s.badge && <span className="mk-sr-chip mk-sr-chip--accent">{s.badge}</span>}</h2>
                  <ul className="mk-pk-items">
                    {(s.items || []).map((it) => (
                      <li key={it.id ?? it.text}>{it.text}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}

              {/* itinerary */}
              {(pkg.days || []).length > 0 && (
                <section className="mk-pk-block">
                  <h2>{pkg.itineraryTitle || t("pk_days")}</h2>
                  <ol className="mk-pk-days">
                    {pkg.days.map((d, i) => (
                      <Reveal as="li" key={d.id ?? i} delay={(i % 4) * 60}>
                        <div className="mk-pk-day-num">{d.num || String(i + 1).padStart(2, "0")}</div>
                        <div className="mk-pk-day-body">
                          <h3>
                            {d.title}
                            {d.badge && <span className="mk-sr-chip">{d.badge}</span>}
                          </h3>
                          {d.theme && <p className="mk-pk-day-theme">{d.theme}</p>}
                          {(d.activities || []).length > 0 && (
                            <ul>
                              {d.activities.map((a, j) => (
                                <li key={a.id ?? j}>
                                  {a.label}
                                  {a.optional && <em> — {t("pk_optional")}</em>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {d.image && <img src={d.image} alt="" loading="lazy" />}
                        </div>
                      </Reveal>
                    ))}
                  </ol>
                </section>
              )}

              {/* formules & hotels */}
              {cats.length > 0 && (
                <section className="mk-pk-block">
                  <h2>{t("pk_formules")}</h2>
                  {cats.length > 1 && (
                    <div className="mk-bk-pills" style={{ marginBottom: 18 }}>
                      {cats.map((c, i) => (
                        <button key={c.id ?? i} className={i === catTab ? "is-active" : ""} onClick={() => setCatTab(i)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {cat && (
                    <div className="mk-pk-tablewrap">
                      <table className="mk-pk-table">
                        <thead>
                          <tr>
                            {(cat.tableHeaders || ["Hôtel", "Ville", "Nuits", "★"]).slice(0, 4).map((h) => <th key={h}>{h}</th>)}
                            <th>Triple</th><th>Double</th><th>Single</th><th>2–5 ans</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cat.hotels || []).map((h, i) => (
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
                      {cat.note && <p className="mk-pk-tnote">{cat.note}</p>}
                    </div>
                  )}
                </section>
              )}

              {/* dates */}
              {dates.length > 0 && (
                <section className="mk-pk-block">
                  <h2>{t("pk_dates")}</h2>
                  <div className="mk-bk-pills mk-bk-pills--dates">
                    {dates.map((d, i) => (
                      <button key={d.id ?? i} onClick={() => setBooking(true)}>{d.from} → {d.to}</button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* booking rail */}
            <aside className="mk-pk-rail">
              <div className="mk-pk-card">
                <div className="mk-pk-card-price">
                  <span>{t("trips_from")}</span>
                  <b>{nf.format(priceFrom || 0)}<i>DH</i></b>
                  <span>{t("sr_per_person")} · {t("sr_night_note")}</span>
                </div>
                <button className="mk-btn" style={{ width: "100%" }} onClick={() => setBooking(true)}>
                  {t("pk_book")}
                </button>
                <div className="mk-pk-card-contact">
                  <span>{t("pk_question")}</span>
                  <a href="tel:+212664586425">+212 664 586 425</a>
                  <a href="tel:+212520655575">+212 520 655 575</a>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* mobile CTA bar */}
        <div className="mk-pk-mobilebar">
          <div>
            <span>{t("trips_from")}</span>
            <b>{nf.format(priceFrom || 0)} DH</b>
          </div>
          <button className="mk-btn mk-btn--sm" onClick={() => setBooking(true)}>{t("pk_book")}</button>
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
            onClose={() => setBooking(false)}
          />
        </ReservationProvider>
      )}
    </div>
  );
}
