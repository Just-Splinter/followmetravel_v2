import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTravelData } from "../context/TravelDataContext";
import { isHeroSlideDoc } from "../services/heroSlides";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import { Arrow } from "./ui";
import QuickPrice from "./QuickPrice";
import GeoMap from "./GeoMap";
import { resolvePlace } from "./geo";
import { useClickOutside } from "../components/ClickOutSide";
import "./marketing.css";

/* ─── Small icons ────────────────────────────────────────────────────────── */
const Ico = {
  list: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  grid: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>,
  rows: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="16" height="7" rx="1" /><rect x="4" y="14" width="16" height="6" rx="1" /></svg>,
  filter: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>,
  star: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" /></svg>,
};

const parse = (p) => { try { return JSON.parse(p.data) || {}; } catch { return {}; } };

/* ─── Dual-handle price slider ───────────────────────────────────────────── */
function PriceSlider({ bounds, value, onChange }) {
  const [lo, hi] = value;
  const [bLo, bHi] = bounds;
  const span = Math.max(1, bHi - bLo);
  const pct = (v) => ((v - bLo) / span) * 100;
  return (
    <div className="mk-sr-slider">
      <div className="mk-sr-slider-track">
        <div
          className="mk-sr-slider-fill"
          style={{ insetInlineStart: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
      </div>
      <input type="range" min={bLo} max={bHi} step={100} value={lo}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi - 100), hi])} />
      <input type="range" min={bLo} max={bHi} step={100} value={hi}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + 100)])} />
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function SearchPage() {
  const { packages, destinations, adventures, loading } = useTravelData();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");

  /* items */
  const items = useMemo(
    () =>
      (packages || [])
        .filter((p) => !isHeroSlideDoc(p))
        .map((p) => {
          const d = parse(p);
          return {
            id: p.$id,
            title: p.title || d.destination || "—",
            country: p.country || "—",
            destId: p.destinations || "",
            advIds: typeof p.adventures === "string" && p.adventures ? [p.adventures] : p.adventures || [],
            img: d.heroBg || null,
            price: p.basePrice ?? 0,
            rating: p.rating ?? null,
            durationLabel: d.durationLabel || "",
            formules: Array.isArray(d.hotelCategories) ? d.hotelCategories.length : 0,
            departureDates: d.departureDates || [],
            departures: Array.isArray(d.departureDates) ? d.departureDates.length : 0,
            featured: p.status === "active",
            tagline: d.tagline || d.subtitleItalic || "",
          };
        }),
    [packages]
  );

  const bounds = useMemo(() => {
    const prices = items.map((i) => i.price).filter((n) => n > 0);
    if (!prices.length) return [0, 20000];
    return [Math.floor(Math.min(...prices) / 500) * 500, Math.ceil(Math.max(...prices) / 500) * 500];
  }, [items]);

  /* filters */
  const [view, setView] = useState("list");
  const [sortBy, setSortBy] = useState("default");
  const [destId, setDestId] = useState(searchParams.get("dest") || "");
  const [country, setCountry] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [range, setRange] = useState(null); // [lo, hi] | null = full
  const [selAdv, setSelAdv] = useState(() => {
    const adv = searchParams.get("adventures");
    return adv ? Object.fromEntries(adv.split(",").map((id) => [id, true])) : {};
  });
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [pill, setPill] = useState(null); // 'price' | 'moods' | null
  const pillRef = useRef(null);
  useClickOutside(pillRef, () => setPill(null));

  const [lo, hi] = range ?? bounds;

  const countries = useMemo(
    () => [...new Set(items.map((i) => i.country).filter((c) => c && c !== "—"))].sort(),
    [items]
  );

  /* destination facet (CMS names when readable, else countries) */
  const facet = useMemo(() => {
    if (destinations?.length) {
      return destinations.map((d) => ({
        key: d.$id, label: d.name,
        count: items.filter((i) => i.destId === d.$id).length,
        active: destId === d.$id,
        toggle: () => { setDestId((v) => (v === d.$id ? "" : d.$id)); setPage(1); },
      }));
    }
    return countries.map((c) => ({
      key: c, label: c,
      count: items.filter((i) => i.country === c).length,
      active: country === c,
      toggle: () => { setCountry((v) => (v === c ? "" : c)); setPage(1); },
    }));
  }, [destinations, countries, items, destId, country]);

  const geoMarkers = useMemo(() => {
    const groups = {};
    items.forEach((i) => {
      const place = resolvePlace(i.title, i.country);
      if (!place) return;
      const g = (groups[place.key] ||= { lat: place.latlng[0], lng: place.latlng[1], count: 0, country: i.country, label: place.key });
      g.count += 1;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      active: country === g.country,
      onClick: () => { setCountry((v) => (v === g.country ? "" : g.country)); setPage(1); },
    }));
  }, [items, country]);

  const quick = useMemo(() => {
    const [a, b] = bounds;
    const step = Math.round((b - a) / 4 / 500) * 500 || 500;
    return [
      { label: `${t("sr_under")} ${nf.format(a + step)} DH`, lo: a, hi: a + step },
      { label: `${nf.format(a + step)} – ${nf.format(a + 2 * step)} DH`, lo: a + step, hi: a + 2 * step },
      { label: `${nf.format(a + 2 * step)} – ${nf.format(a + 3 * step)} DH`, lo: a + 2 * step, hi: a + 3 * step },
      { label: `${t("sr_over")} ${nf.format(a + 3 * step)} DH`, lo: a + 3 * step, hi: b },
    ];
  }, [bounds, nf, t]);

  const histo = useMemo(() => {
    const N = 12;
    const [a, b] = bounds;
    const span = Math.max(1, b - a);
    const buckets = Array(N).fill(0);
    items.forEach((i) => {
      if (i.price <= 0) return;
      const k = Math.min(N - 1, Math.floor(((i.price - a) / span) * N));
      buckets[k] += 1;
    });
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => v / max);
  }, [items, bounds]);

  const results = useMemo(() => {
    let list = [...items];
    if (featuredOnly) list = list.filter((i) => i.featured);
    if (destId) list = list.filter((i) => i.destId === destId);
    if (country) list = list.filter((i) => i.country === country);
    const adv = Object.keys(selAdv).filter((k) => selAdv[k]);
    if (adv.length) list = list.filter((i) => adv.some((a) => i.advIds.includes(a)));
    list = list.filter((i) => i.price >= lo && i.price <= hi);
    if (minRating > 0) list = list.filter((i) => (i.rating ?? 0) >= minRating);
    if (sortBy === "price_asc") list.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") list.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sortBy === "name") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [items, destId, country, selAdv, lo, hi, minRating, sortBy, featuredOnly]);

  const pageSize = view === "list" ? 5 : view === "grid" ? 9 : 12;
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const slice = results.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);

  const activeCount =
    (destId ? 1 : 0) + (country ? 1 : 0) + (range ? 1 : 0) + (minRating ? 1 : 0) + (featuredOnly ? 1 : 0) +
    Object.values(selAdv).filter(Boolean).length;

  const reset = () => {
    setDestId(""); setCountry(""); setMinRating(0); setRange(null); setSelAdv({}); setSortBy("default"); setFeaturedOnly(false); setPage(1);
  };

  // carry the hero-form context (travellers, wished date) into the package page
  const go = (id) => {
    const qs = new URLSearchParams({ pkgId: id });
    ["adults", "date"].forEach((k) => {
      const v = searchParams.get(k);
      if (v) qs.set(k, v);
    });
    navigate(`/packages/view?${qs.toString()}`);
  };

  /* ── sidebar ── */
  const sidebar = (
    <div className="mk-sr-side">
      {/* live map — one pin per resolved location, click filters */}
      {geoMarkers.length > 0 && <GeoMap markers={geoMarkers} height={235} className="mk-sr-geomap" />}

      {facet.length > 0 && (
      <section className="mk-sr-block">
        <h4>{t("sr_dests")}</h4>
        <ul className="mk-sr-cols">
          {facet.map((f) => (
            <li key={f.key}>
              <button className={f.active ? "is-active" : ""} onClick={f.toggle}>
                {f.label} <span>({f.count})</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      )}

      {adventures?.length > 0 && (
        <section className="mk-sr-block">
          <h4>{t("sr_moods")}</h4>
          <ul className="mk-sr-radios">
            {adventures.map((a) => (
              <li key={a.$id}>
                <button
                  className={selAdv[a.$id] ? "is-active" : ""}
                  onClick={() => { setSelAdv((p) => ({ ...p, [a.$id]: !p[a.$id] })); setPage(1); }}
                >
                  <i /> {a.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mk-sr-block">
        <h4>{t("sr_budget")}</h4>
        <PriceSlider bounds={bounds} value={[lo, hi]} onChange={(v) => { setRange(v); setPage(1); }} />
        <div className="mk-sr-slider-labels">
          <span>{nf.format(lo)} DH</span>
          <span>{nf.format(hi)} DH</span>
        </div>
      </section>

      <section className="mk-sr-block">
        <h4>{t("sr_country")} · {t("flt_rating")}</h4>
        <div className="mk-sr-selects">
          <div className="mk-sr-selectwrap">
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
              <option value="">{t("sr_all_countries")}</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="mk-sr-selectwrap">
            <select value={minRating} onChange={(e) => { setMinRating(Number(e.target.value)); setPage(1); }}>
              <option value={0}>{t("sort_rating")} — ★</option>
              {[3, 4, 5].map((n) => <option key={n} value={n}>{n}★+</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="mk-sr-block">
        <h4>{t("sr_quick")}</h4>
        <ul className="mk-sr-quick">
          {quick.map((q) => (
            <li key={q.label}>
              <button
                className={range && lo === q.lo && hi === q.hi ? "is-active" : ""}
                onClick={() => { setRange([q.lo, q.hi]); setPage(1); }}
              >
                {q.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {activeCount > 0 && (
        <button className="mk-sr-reset" onClick={reset}>{t("flt_reset")} ({activeCount})</button>
      )}
    </div>
  );

  /* ── cards ── */
  const Stars = ({ r }) =>
    r == null ? null : (
      <span className="mk-sr-stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < Math.round(r) ? "on" : ""}>{Ico.star}</span>
        ))}
        <b>{Number(r).toFixed(1)}</b>
      </span>
    );

  const Specs = ({ it }) => (
    <dl className="mk-sr-specs">
      <div><dt>{t("sr_country")}</dt><dd>{it.country}</dd></div>
      <div><dt>{t("sr_duration")}</dt><dd>{it.durationLabel ? it.durationLabel.split("·").pop().trim() : "—"}</dd></div>
      <div><dt>{t("sr_formules")}</dt><dd>{it.formules || "—"}</dd></div>
      <div><dt>{t("sr_departures")}</dt><dd>{it.departures || "—"}</dd></div>
    </dl>
  );

  const Price = ({ it }) => (
    <div className="mk-sr-price">
      <b>{nf.format(it.price)}<i>DH</i></b>
      <span>{t("sr_per_person")}</span>
    </div>
  );

  const ListCard = ({ it }) => (
    <article className="mk-sr-card">
      <figure onClick={() => go(it.id)}>
        {it.img ? <img src={it.img} alt={it.title} loading="lazy" /> : <span className="mk-sr-imgfall">{it.title.charAt(0)}</span>}
      </figure>
      <div className="mk-sr-card-body">
        <div className="mk-sr-card-head">
          <div>
            <h3 onClick={() => go(it.id)}>{it.title}</h3>
            <div className="mk-sr-sub">
              <span>{it.country}</span>
              <Stars r={it.rating} />
            </div>
          </div>
          <Price it={it} />
        </div>
        <div className="mk-sr-chips">
          {it.durationLabel && <span className="mk-sr-chip">{it.durationLabel}</span>}
          {it.featured && <span className="mk-sr-chip mk-sr-chip--accent">{t("sr_featured")}</span>}
        </div>
        <Specs it={it} />
        <div className="mk-sr-actions">
          <button className="mk-btn mk-btn--sm" onClick={() => go(it.id)}>{t("card_book")}</button>
          <QuickPrice pkgId={it.id} price={it.price} departureDates={it.departureDates} compact />
        </div>
      </div>
    </article>
  );

  const GridCard = ({ it }) => (
    <article className="mk-sr-gcard" onClick={() => go(it.id)}>
      <figure>
        {it.img ? <img src={it.img} alt={it.title} loading="lazy" /> : <span className="mk-sr-imgfall">{it.title.charAt(0)}</span>}
        {it.featured && <span className="mk-sr-chip mk-sr-chip--accent">{t("sr_featured")}</span>}
      </figure>
      <div className="mk-sr-gcard-meta">
        <span>{it.country}</span>
        <Stars r={it.rating} />
      </div>
      <h3>{it.title}</h3>
      <div className="mk-sr-gcard-foot">
        <Price it={it} />
        <span className="mk-sr-gcard-go"><Arrow size={14} /></span>
      </div>
      <div className="mk-sr-gcard-more">
        <QuickPrice pkgId={it.id} price={it.price} departureDates={it.departureDates} compact />
      </div>
    </article>
  );

  const CompactRow = ({ it }) => (
    <article className="mk-sr-row" onClick={() => go(it.id)}>
      <figure>{it.img ? <img src={it.img} alt="" loading="lazy" /> : <span className="mk-sr-imgfall">{it.title.charAt(0)}</span>}</figure>
      <div className="mk-sr-row-main">
        <h3>{it.title}</h3>
        <span>{it.country}{it.durationLabel ? ` — ${it.durationLabel}` : ""}</span>
      </div>
      <Price it={it} />
    </article>
  );

  const first = results.length ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, results.length);

  const flat = new URLSearchParams(window.location.search).has("flat");

  return (
    <div className={`mk ${flat ? "mk--flat" : ""}`}>
      <Header />
      <main>
        <div className="mk-wrap mk-page-head" style={{ paddingBottom: 28 }}>
          <span className="mk-eyebrow">{t("dest_eyebrow")}</span>
          <h1 className="mk-h2" style={{ marginTop: 16 }}>{t("search_title")}</h1>
        </div>

        {/* toolbar */}
        <div className="mk-wrap">
          <div className="mk-sr-toolbar">
            <div className="mk-sr-sort">
              {Ico.filter}
              <label htmlFor="sr-sort">{t("sort_by")}</label>
              <select id="sr-sort" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
                <option value="default">—</option>
                <option value="price_asc">{t("sort_price_asc")}</option>
                <option value="price_desc">{t("sort_price_desc")}</option>
                <option value="rating">{t("sort_rating")}</option>
                <option value="name">{t("sort_name")}</option>
              </select>
            </div>

            <div className="mk-sr-views" role="tablist">
              {[
                { k: "list", ico: Ico.list, label: t("sr_view_list") },
                { k: "grid", ico: Ico.grid, label: t("sr_view_grid") },
                { k: "compact", ico: Ico.rows, label: t("sr_view_compact") },
              ].map((v) => (
                <button key={v.k} role="tab" aria-selected={view === v.k}
                  className={view === v.k ? "is-active" : ""}
                  onClick={() => { setView(v.k); setPage(1); }}>
                  {v.ico}<span>{v.label}</span>
                </button>
              ))}
            </div>

            <div className="mk-sr-pager">
              <span>{loading ? "…" : `${first}–${last} ${t("sr_of")} ${results.length} ${t("search_results")}`}</span>
              <button aria-label={t("hero_prev")} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <span style={{ transform: "scaleX(-1)", display: "flex" }}><Arrow size={13} /></span>
              </button>
              <button aria-label={t("hero_next")} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <Arrow size={13} />
              </button>
            </div>

            <button className="mk-sr-filterbtn" onClick={() => setDrawer(true)}>
              {Ico.filter} {t("search_filters")}{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>

          {/* pill filters (reference: toggle · price histogram · amenities) */}
          <div className="mk-fl-row" ref={pillRef}>
            <button
              className={`mk-fl-pill ${featuredOnly ? "is-on" : ""}`}
              onClick={() => { setFeaturedOnly((v) => !v); setPage(1); }}
              role="switch"
              aria-checked={featuredOnly}
            >
              <i className="mk-fl-ico">★</i>
              <span>{t("fl_only_featured")}</span>
              <em className="mk-fl-switch"><u /></em>
            </button>

            <div className="mk-fl-wrap">
              <button className={`mk-fl-pill ${pill === "price" ? "is-open" : ""} ${range ? "is-on" : ""}`}
                onClick={() => setPill(pill === "price" ? null : "price")}>
                <i className="mk-fl-ico">DH</i>
                <span>{t("fl_price")}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {pill === "price" && (
                <div className="mk-fl-pop">
                  <em className="mk-fl-pop-title">{t("fl_price_pp")}</em>
                  <div className="mk-fl-histo" aria-hidden="true">
                    {histo.map((h, i) => {
                      const [a, b] = bounds;
                      const bl = a + ((b - a) / 12) * i;
                      const br = a + ((b - a) / 12) * (i + 1);
                      const active = br >= lo && bl <= hi;
                      return <i key={i} style={{ height: `${8 + h * 92}%` }} className={active ? "is-on" : ""} />;
                    })}
                  </div>
                  <PriceSlider bounds={bounds} value={[lo, hi]} onChange={(v) => { setRange(v); setPage(1); }} />
                  <div className="mk-sr-slider-labels">
                    <span>{nf.format(lo)} DH</span>
                    <span>{nf.format(hi)} DH</span>
                  </div>
                </div>
              )}
            </div>

            {adventures?.length > 0 && (
              <div className="mk-fl-wrap">
                <button className={`mk-fl-pill ${pill === "moods" ? "is-open" : ""} ${Object.values(selAdv).some(Boolean) ? "is-on" : ""}`}
                  onClick={() => setPill(pill === "moods" ? null : "moods")}>
                  <i className="mk-fl-ico">◆</i>
                  <span>{t("sr_moods")}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {pill === "moods" && (
                  <div className="mk-fl-pop mk-fl-pop--checks">
                    {adventures.map((a) => (
                      <button key={a.$id}
                        className={`mk-fl-check ${selAdv[a.$id] ? "is-on" : ""}`}
                        onClick={() => { setSelAdv((prev) => ({ ...prev, [a.$id]: !prev[a.$id] })); setPage(1); }}>
                        <i>{selAdv[a.$id] ? "✓" : ""}</i>
                        <img src={a.emoji} alt="" />
                        <span>{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* layout */}
        <div className="mk-wrap" style={{ paddingBottom: 110 }}>
          <div className="mk-sr-layout">
            <aside className="mk-sr-aside">{sidebar}</aside>

            <div className="mk-sr-results">
              {slice.length === 0 && !loading ? (
                <div className="mk-sr-empty">
                  <p className="mk-quote" style={{ fontSize: 26 }}>{t("flt_empty")}</p>
                  <p style={{ color: "var(--ink-2)", margin: "10px 0 22px" }}>{t("flt_widen")}</p>
                  <button className="mk-btn mk-btn--sm" onClick={reset}>{t("flt_reset")}</button>
                </div>
              ) : view === "list" ? (
                <div className="mk-sr-list">{slice.map((it) => <ListCard key={it.id} it={it} />)}</div>
              ) : view === "grid" ? (
                <div className="mk-sr-grid">{slice.map((it) => <GridCard key={it.id} it={it} />)}</div>
              ) : (
                <div className="mk-sr-compact">{slice.map((it) => <CompactRow key={it.id} it={it} />)}</div>
              )}
            </div>
          </div>
        </div>

        {/* mobile drawer */}
        {drawer && <div className="mk-sr-overlay" onClick={() => setDrawer(false)} />}
        <div className={`mk-sr-drawer ${drawer ? "is-open" : ""}`}>
          <div className="mk-sr-drawer-head">
            <b>{t("search_filters")}</b>
            <button onClick={() => setDrawer(false)} aria-label="Close">✕</button>
          </div>
          {sidebar}
        </div>
      </main>
      <Footer />
    </div>
  );
}
