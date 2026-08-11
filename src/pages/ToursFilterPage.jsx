import { useState, useMemo } from "react";
import { useTravelData } from "../context/TravelDataContext";
import Header from "../marketing/Header";
import { Footer } from "../marketing/Sections";
import { useLocale } from "../marketing/i18n";
import "../marketing/marketing.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Grid3x3, List, LayoutList, SlidersHorizontal, MapPin, Star, Clock } from "lucide-react";
import { isHeroSlideDoc } from "../services/heroSlides";
import "../styles/ToursFilterPage.css";



function formatPrice(p) {
  if (!p && p !== 0) return "—";
  return Number(p).toLocaleString("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  });
}

const IMG_FALLBACK =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80";




// ─── CheckItem ────────────────────────────────────────────────────────────────
function CheckItem({ label, checked, onChange }) {
  return (
    <div className="tf-check-item" onClick={() => onChange(!checked)}>
      <div className={`tf-check-box ${checked ? "checked" : ""}`}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4l3 3 5-6"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="tf-check-label">{label}</span>
    </div>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`tf-accordion ${open ? "open" : ""}`}>
      <button className="tf-accordion-header" onClick={() => setOpen(!open)}>
        <span className="tf-accordion-title">{title}</span>
        <span className="tf-accordion-chevron">›</span>
      </button>
      {open && <div className="tf-accordion-body">{children}</div>}
    </div>
  );
}

// ─── View Mode Switcher ───────────────────────────────────────────────────────
function ViewModeSwitcher({ mode, onChange }) {
  const modes = [
    { key: "grid", icon: <Grid3x3 size={16} />, label: "Grille" },
    { key: "list", icon: <List size={16} />, label: "Liste" },
    { key: "compact", icon: <LayoutList size={16} />, label: "Compact" },
  ];

  return (
    <div className="tf-view-switcher" role="tablist" aria-label="Mode d'affichage">
      {modes.map((m) => (
        <button
          key={m.key}
          className={`tf-view-btn ${mode === m.key ? "active" : ""}`}
          onClick={() => onChange(m.key)}
          aria-label={m.label}
          aria-pressed={mode === m.key}
          title={m.label}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

// ─── Tour Card (Grid View) ────────────────────────────────────────────────────
function TourCardGrid({ item, index }) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const data = JSON.parse(item.data || "{}");
  const title = item.title || item.name || "Sans titre";
  const country = item.country || item.destination || "—";
  const price = item.basePrice ?? 0;
  const duration = item.duration || item.duree || null;
  const rating = item.rating ?? item.note ?? null;
  const image = data?.heroBg || item.image || IMG_FALLBACK;
  const type = item.type || "package";
  const typeLabel = { package: "Séjour", tour: "Tour", aventure: "Aventure" }[type] || "Séjour";

  return (
    <div
      className="tf-grid-card"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
      onClick={() => navigate(`/packages/view?pkgId=${item.$id}`)}
    >
      <img src={image} alt={title} className="tf-grid-card-img" loading="lazy" />
      <div className="tf-grid-card-overlay" />
      <div className={`tf-grid-card-badge ${type === "aventure" ? "adventure" : ""}`}>
        {typeLabel}
      </div>
      {rating !== null && (
        <div className="tf-grid-card-rating">
          <span className="star">★</span>
          {Number(rating).toFixed(1)}
        </div>
      )}
      <div className="tf-grid-card-content">
        <div className="tf-grid-card-location">
          <MapPin size={12} /> {country}
        </div>
        <h3 className="tf-grid-card-title">{title}</h3>
        <div className="tf-grid-card-meta">
          {duration && (
            <span className="tf-grid-card-meta-item">
              <Clock size={13} /> {duration} {duration > 1 ? "jours" : "jour"}
            </span>
          )}
        </div>
        <div className="tf-grid-card-footer">
          <div>
            <div className="tf-grid-card-price">{formatPrice(price)}</div>
            <div className="tf-grid-card-price-sub">/ par personne</div>
          </div>
          <button className="tf-grid-card-cta">{t("card_book")} →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tour Card (List View) ────────────────────────────────────────────────────
function TourCardList({ item, index }) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const data = JSON.parse(item.data || "{}");
  const title = item.title || item.name || "Sans titre";
  const country = item.country || item.destination || "—";
  const price = item.basePrice ?? 0;
  const duration = item.duration || item.duree || null;
  const rating = item.rating ?? item.note ?? null;
  const image = data?.heroBg || item.image || IMG_FALLBACK;
  const type = item.type || "package";
  const typeLabel = { package: "Séjour", tour: "Tour", aventure: "Aventure" }[type] || "Séjour";
  const description = data?.tagline || data?.subtitleItalic || item.description || "Découvrez une expérience de voyage unique et inoubliable.";

  return (
    <div
      className="tf-list-card"
      style={{ animationDelay: `${Math.min(index * 0.08, 0.5)}s` }}
      onClick={() => navigate(`/packages/view?pkgId=${item.$id}`)}
    >
      <div className="tf-list-card-img-wrap">
        <img src={image} alt={title} className="tf-list-card-img" loading="lazy" />
        <div className="tf-list-card-badges">
          <div className={`tf-list-card-badge ${type === "aventure" ? "adventure" : ""}`}>
            {typeLabel}
          </div>
          {rating !== null && (
            <div className="tf-list-card-rating">
              <span className="star">★</span>
              {Number(rating).toFixed(1)}
            </div>
          )}
        </div>
      </div>
      <div className="tf-list-card-body">
        <div>
          <div className="tf-list-card-location">
            <MapPin size={12} /> {country}
          </div>
          <h3 className="tf-list-card-title">{title}</h3>
          <p className="tf-list-card-desc">{description}</p>
        </div>
        <div className="tf-list-card-features">
          {duration && (
            <div className="tf-list-card-feature">
              <div className="tf-list-card-feature-icon">
                <Clock size={14} />
              </div>
              <span>{duration} {duration > 1 ? "jours" : "jour"}</span>
            </div>
          )}
          {rating !== null && (
            <div className="tf-list-card-feature">
              <div className="tf-list-card-feature-icon">
                <Star size={14} />
              </div>
              <span>{Number(rating).toFixed(1)} / 5</span>
            </div>
          )}
        </div>
        <div className="tf-list-card-footer">
          <div>
            <div className="tf-list-card-price">{formatPrice(price)}</div>
            <div className="tf-list-card-price-sub">/ par personne</div>
          </div>
          <button className="tf-list-card-cta">
            {t("card_book")} <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tour Card (Compact View) ─────────────────────────────────────────────────
function TourCardCompact({ item, index }) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const data = JSON.parse(item.data || "{}");
  const title = item.title || item.name || "Sans titre";
  const country = item.country || item.destination || "—";
  const price = item.basePrice ?? 0;
  const duration = item.duration || item.duree || null;
  const rating = item.rating ?? item.note ?? null;
  const image = data?.heroBg || item.image || IMG_FALLBACK;
  const type = item.type || "package";
  const typeLabel = { package: "Séjour", tour: "Tour", aventure: "Aventure" }[type] || "Séjour";

  return (
    <div
      className="tf-compact-card"
      style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}
      onClick={() => navigate(`/packages/view?pkgId=${item.$id}`)}
    >
      <div className="tf-compact-card-img-wrap">
        <img src={image} alt={title} className="tf-compact-card-img" loading="lazy" />
        <div className={`tf-compact-card-badge ${type === "aventure" ? "adventure" : ""}`}>
          {typeLabel}
        </div>
        {rating !== null && (
          <div className="tf-compact-card-rating">
            <span className="star">★</span>
            {Number(rating).toFixed(1)}
          </div>
        )}
      </div>
      <div className="tf-compact-card-body">
        <div className="tf-compact-card-location">
          <MapPin size={10} /> {country}
        </div>
        <h3 className="tf-compact-card-title">{title}</h3>
        <div className="tf-compact-card-meta">
          {duration && (
            <span className="tf-compact-card-meta-item">
              <Clock size={11} /> {duration}j
            </span>
          )}
        </div>
        <div className="tf-compact-card-footer">
          <div className="tf-compact-card-price">{formatPrice(price)}</div>
          <button className="tf-compact-card-cta">{t("card_view")} →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard({ mode }) {
  return <div className={`tf-skeleton ${mode}`} />;
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <div className="tf-chip">
      {label}
      <button className="tf-chip-remove" onClick={onRemove} aria-label="Retirer le filtre">
        ×
      </button>
    </div>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────
function SidebarContent({ props }) {
  const { t } = useLocale();
  const {
    search, setSearch,
    destinationId, setDestinationId,
    destinations,
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    minRating, setMinRating,
    tours, selectedTours, toggleTour,
    adventures, selectedAdventures, toggleAdventure,
    activeFilterCount, resetFilters,
  } = props;

  return (
    <div className="tf-sidebar-content">
      <div className="tf-sidebar-header">
        <span className="tf-sidebar-title">{t("search_filters")}</span>
        {activeFilterCount > 0 && (
          <button className="tf-sidebar-clear" onClick={resetFilters}>
            {t("flt_clear")} ({activeFilterCount})
          </button>
        )}
      </div>

      <Accordion title={t("flt_search")}>
        <div className="tf-input-search-wrap">
          <span className="tf-input-search-icon">🔍</span>
          <input
            className="tf-input tf-input-search"
            placeholder="Nom, destination…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Accordion>

      <Accordion title={t("flt_dest")}>
        <select
          className="tf-select"
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
        >
          <option value="">{t("flt_all")}</option>
          {(destinations || []).map((d) => (
            <option key={d.$id} value={d.$id}>
              {d.name || d.nom}
            </option>
          ))}
        </select>
      </Accordion>

      <Accordion title={t("flt_budget")}>
        <div className="tf-price-row">
          <input
            type="number"
            placeholder="Min"
            className="tf-input"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            min={0}
          />
          <span className="tf-price-sep">–</span>
          <input
            type="number"
            placeholder="Max"
            className="tf-input"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            min={0}
          />
        </div>
      </Accordion>

      <Accordion title={t("flt_rating")} defaultOpen={false}>
        <div className="tf-rating-row">
          {[0, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`tf-rating-btn ${minRating === n ? "active" : ""}`}
              onClick={() => setMinRating(n)}
            >
              {n === 0 ? "Tous" : `${n}★+`}
            </button>
          ))}
        </div>
      </Accordion>

      {tours && tours.length > 0 && (
        <Accordion title={t("flt_tours")} defaultOpen={false}>
          {tours.map((t) => (
            <CheckItem
              key={t.$id}
              label={t.name}
              checked={!!selectedTours[t.$id]}
              onChange={() => toggleTour(t.$id)}
            />
          ))}
        </Accordion>
      )}

      {adventures && adventures.length > 0 && (
        <Accordion title={t("flt_adv")} defaultOpen={false}>
          {adventures.map((a) => (
            <CheckItem
              key={a.$id}
              label={a.name}
              checked={!!selectedAdventures[a.$id]}
              onChange={() => toggleAdventure(a.$id)}
            />
          ))}
        </Accordion>
      )}

      {activeFilterCount > 0 && (
        <button className="tf-reset-btn" onClick={resetFilters}>
          {t("flt_reset")}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ToursFilterPage() {
  const { packages, destinations, tours, adventures, loading } = useTravelData();
  const { t } = useLocale();
  const [searchParams] = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const [search, setSearch] = useState("");
  const [destinationId, setDestinationId] = useState(searchParams.get("dest") || "");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState("default");
  const [selectedTours, setSelectedTours] = useState({});
  const [selectedAdventures, setSelectedAdventures] = useState(() => {
    const adv = searchParams.get("adventures");
    if (!adv) return {};
    return adv.split(",").reduce((acc, id) => { acc[id] = true; return acc; }, {});
  });

  const toggleTour = (id) => setSelectedTours((p) => ({ ...p, [id]: !p[id] }));
  const toggleAdventure = (id) => setSelectedAdventures((p) => ({ ...p, [id]: !p[id] }));

  const resetFilters = () => {
    setSearch("");
    setDestinationId("");
    setPriceMin("");
    setPriceMax("");
    setMinRating(0);
    setSortBy("default");
    setSelectedTours({});
    setSelectedAdventures({});
  };

  const activeFilterCount = [
    search.trim() !== "",
    destinationId !== "",
    priceMin !== "",
    priceMax !== "",
    minRating > 0,
    Object.values(selectedTours).some(Boolean),
    Object.values(selectedAdventures).some(Boolean),
  ].filter(Boolean).length;

  const results = useMemo(() => {
    let list = (packages || []).filter((p) => !isHeroSlideDoc(p));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.title || i.name || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q)
      );
    }

    if (destinationId) {
      list = list.filter((i) => i.destinations === destinationId);
    }

    const activeTours = Object.keys(selectedTours).filter((k) => selectedTours[k]);
    if (activeTours.length) {
      list = list.filter((pkg) => activeTours.some((t) => (pkg.tours || []).includes(t)));
    }

    const activeAdventures = Object.keys(selectedAdventures).filter((k) => selectedAdventures[k]);
    if (activeAdventures.length) {
      list = list.filter((pkg) => activeAdventures.some((a) => (pkg.adventures || []).includes(a)));
    }

    const pMin = priceMin !== "" ? Number(priceMin) : null;
    const pMax = priceMax !== "" ? Number(priceMax) : null;
    if (pMin !== null) list = list.filter((i) => (i.basePrice ?? i.prix ?? 0) >= pMin);
    if (pMax !== null) list = list.filter((i) => (i.basePrice ?? i.prix ?? 0) <= pMax);

    if (minRating > 0) {
      list = list.filter((i) => (i.rating ?? i.note ?? 0) >= minRating);
    }

    if (sortBy === "price_asc") list.sort((a, b) => (a.basePrice ?? a.prix ?? 0) - (b.basePrice ?? b.prix ?? 0));
    if (sortBy === "price_desc") list.sort((a, b) => (b.basePrice ?? b.prix ?? 0) - (a.basePrice ?? a.prix ?? 0));
    if (sortBy === "rating") list.sort((a, b) => (b.rating ?? b.note ?? 0) - (a.rating ?? a.note ?? 0));
    if (sortBy === "duration") list.sort((a, b) => (a.duration || a.duree || 0) - (b.duration || b.duree || 0));
    if (sortBy === "name") list.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));

    return list;
  }, [packages, search, destinationId, priceMin, priceMax, minRating, sortBy, selectedTours, selectedAdventures]);

  const sidebarProps = {
    search, setSearch,
    destinationId, setDestinationId,
    destinations,
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    minRating, setMinRating,
    tours, selectedTours, toggleTour,
    adventures, selectedAdventures, toggleAdventure,
    activeFilterCount, resetFilters,
  };

  const renderCards = () => {
    if (loading) {
      return Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} mode={viewMode} />
      ));
    }

    if (results.length === 0) {
      return (
        <div className="tf-empty">
          <div className="tf-empty-icon">🧭</div>
          <p className="tf-empty-title">{t("flt_empty")}</p>
          <p className="tf-empty-text">{t("flt_widen")}</p>
          <button className="tf-empty-btn" onClick={resetFilters}>
            {t("flt_reset")}
          </button>
        </div>
      );
    }

    const CardComponent =
      viewMode === "list" ? TourCardList :
      viewMode === "compact" ? TourCardCompact :
      TourCardGrid;

    const containerClass =
      viewMode === "list" ? "tf-list" :
      viewMode === "compact" ? "tf-compact" :
      "tf-grid";

    return (
      <div className={containerClass} key={viewMode}>
        {results.map((item, i) => (
          <CardComponent key={item.$id} item={item} index={i} />
        ))}
      </div>
    );
  };

  return (
    <section className="mk tf-page" style={{ background: "var(--paper)" }}>
      <Header />
      <div className="mk-wrap mk-page-head" style={{ paddingBottom: 20 }}>
        <span className="mk-eyebrow">{t("dest_eyebrow")}</span>
        <h1 className="mk-h2" style={{ margin: "16px 0 0" }}>{t("search_title")}</h1>
      </div>

      {/* Mobile filter bar */}
      <div className="tf-mobile-filter-bar">
        <button className="tf-mobile-filter-btn" onClick={() => setSidebarOpen(true)}>
          <SlidersHorizontal size={16} />
          {t("search_filters")}
          {activeFilterCount > 0 && (
            <span className="tf-mobile-filter-count">{activeFilterCount}</span>
          )}
        </button>
        <select
          className="tf-sort-select"
          style={{ flex: 1 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="default">{t("sort_by")}</option>
          <option value="price_asc">{t("sort_price_asc")}</option>
          <option value="price_desc">{t("sort_price_desc")}</option>
          <option value="rating">{t("sort_rating")}</option>
          <option value="duration">{t("sort_duration")}</option>
          <option value="name">{t("sort_name")}</option>
        </select>
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="tf-mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div
        className="tf-mobile-drawer"
        style={{
          transform: sidebarOpen ? "translateY(0)" : "translateY(100%)",
          pointerEvents: sidebarOpen ? "auto" : "none",
        }}
      >
        <div className="tf-mobile-drawer-handle">
          <div className="tf-mobile-drawer-handle-bar" />
        </div>
        <SidebarContent props={sidebarProps} />
      </div>

      {/* Main layout */}
      <div className="tf-container">
        <div className="tf-layout">
          {/* Desktop Sidebar */}
          <aside className="tf-sidebar">
            <SidebarContent props={sidebarProps} />
          </aside>

          {/* Results */}
          <div>
            <div className="tf-results-header">
              <div>
                <p className="tf-results-count" style={{ fontSize: 14 }}>
                  {loading ? "…" : `${results.length} ${t("search_results")}`}
                </p>
              </div>
              <div className="tf-header-controls">
                <ViewModeSwitcher mode={viewMode} onChange={setViewMode} />
                <select
                  className="tf-sort-select tf-desktop-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="default">{t("sort_by")}</option>
                  <option value="price_asc">{t("sort_price_asc")}</option>
                  <option value="price_desc">{t("sort_price_desc")}</option>
                  <option value="rating">{t("sort_rating")}</option>
                  <option value="duration">{t("sort_duration")}</option>
                  <option value="name">{t("sort_name")}</option>
                </select>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && !loading && (
              <div className="tf-chips">
                {search && (
                  <FilterChip label={`"${search}"`} onRemove={() => setSearch("")} />
                )}
                {destinationId && destinations && (
                  <FilterChip
                    label={destinations.find((d) => d.$id === destinationId)?.name || "Destination"}
                    onRemove={() => setDestinationId("")}
                  />
                )}
                {priceMin && <FilterChip label={`Min ${formatPrice(priceMin)}`} onRemove={() => setPriceMin("")} />}
                {priceMax && <FilterChip label={`Max ${formatPrice(priceMax)}`} onRemove={() => setPriceMax("")} />}
                {minRating > 0 && <FilterChip label={`${minRating}★ et +`} onRemove={() => setMinRating(0)} />}
              </div>
            )}

            {/* Cards */}
            {renderCards()}
          </div>
        </div>
      </div>

      <Footer />
    </section>
  );
}