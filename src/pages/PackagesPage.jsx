import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Modal } from "../components/UI";
import PackageEditorPage from "./PackageeditorPage";
import { usePackages } from "../context/PackagesContext";
import { useHotels } from "../context/HotelsContext";
import { roomTypesFor } from "../services/roomTypes";
import CreatePackageModal from "../components/CreatePackageModal";
import { TravelDataProvider } from "../context/TravelDataContext";
import { useClickOutside } from "../components/ClickOutSide";
import { toast } from "react-toastify";
import { withTranslations } from "../services/translate";
import { bulkPrice } from "../services/operations";
import { packagePath } from "../marketing/seo";
import "../styles/Analyticsdashboard.css";
import "../styles/PackagesPage.css";

// ── Helper: normalize real package data into display-friendly shape ──

// Normalizes a raw Appwrite package row (row fields + row.data content blob)
// into the shape the rest of this page reads from, both at the top level
// (pkg.status, pkg.tags, pkg.currency, ...) and under pkg.data (pkg.data.destination,
// pkg.data.duration, ...). Content fields are aliased onto both places since
// different components in this file read them from either location.
function normalize(p) {
  const data = p.data || {};
  const name = data.tagline || `${data.destination || ""}${data.destinationAccent || ""}`;
  const destination = `${data.destination || ""}${data.destinationAccent || ""}`;
  const agency = [data.agency1, data.agency2].filter(Boolean).join(" · ");
  const durationMatch = (data.durationLabel || "").match(/(\d+)\s*J[ours]*/i);
  const nightsMatch = (data.durationLabel || "").match(/(\d+)\s*N[uits]*/i);
  const duration = durationMatch ? parseInt(durationMatch[1]) : (data.days?.length || 0);
  const nights = nightsMatch ? parseInt(nightsMatch[1]) : duration - 1;
  const airlineItem = (data.includes || []).find(i => i.icon === "✈️");
  const airline = airlineItem
    ? airlineItem.text.replace(/^billet\s+a\/r\s+(avec\s+)?/i, "").trim()
    : "—";
  const basePrice = parseInt(String(data.basePrice).replace(/\s/g, ""), 10) || 0;
  const departureDates = data.departureDates || [];
  // Packages edited in the current package editor carry data.hotelCategories
  // — one entry per formule (4★, 5★...), each with its own hotels/tableHeaders/
  // note. Older, never-re-saved packages instead have a flat data.hotels list
  // from before formules existed — wrapped here as a single implicit category
  // so they still render, instead of `data.hotels || data.hotelCategories`
  // silently handing a list of *category* objects to code that expects hotels
  // (that mismatch is why the admin detail view stopped reflecting real data).
  const hotelCategories = data.hotelCategories?.length
    ? data.hotelCategories
    : data.hotels?.length
      ? [{ id: "legacy", label: null, hotels: data.hotels, tableHeaders: data.hotelTableHeaders, note: data.hotelTableNote }]
      : [];
  const country = data.country || p.continent || "";

  const enrichedData = {
    ...data,
    agency,
    destination,
    duration,
    nights,
    country,
    basePrice,
    departureDates,
    hotelCategories,
  };

  return {
    ...p,
    ...data,
    _name: name,
    _destination: destination,
    _agency: agency,
    _airline: airline,
    _category: p.category || "summer",
    status: p.status || "active",
    continent: p.continent || data.continent || "Europe",
    country,
    basePrice,
    tags: p.tags || [],
    data: enrichedData,
  };
}

const countHotels = (categories) =>
  (categories || []).reduce((n, cat) => n + (cat.hotels?.length || 0), 0);

// Departure dates are "DD/MM" strings (see marketing/dates.js) — the card
// shows which months have a departure rather than every individual date
// range, which stopped fitting once a package had more than a couple.
const MONTH_NAMES_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const departureMonths = (dates) => {
  const months = new Set();
  (dates || []).forEach((d) => {
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(d?.from || "").trim());
    if (m) months.add(Number(m[2]));
  });
  return [...months].sort((a, b) => a - b).map((m) => MONTH_NAMES_FR[m - 1]);
};

// Pictograms for what's included — detected from the package's own "Offre
// comprend"-style sections rather than shown unconditionally, so a
// land-only package (no flight) doesn't claim one it doesn't have.
const INCLUDE_PICTOS = [
  { key: "flight", match: /\bvols?\b|avion|billet/i, icon: "ti-plane", label: "Vol inclus" },
  { key: "hotel", match: /hôtel|hotel|logement|nuit/i, icon: "ti-bed", label: "Hôtel inclus" },
  { key: "transfer", match: /transfert|navette/i, icon: "ti-car", label: "Transfert inclus" },
];
const includedPictos = (data) => {
  // Two shapes exist in the wild: the current package editor's
  // data.sections[].items, and the older flat data.includes (still what
  // IncludesTab/normalize's airline extraction read) — check both so
  // detection works regardless of which one a given package has.
  const sectionItems = (data?.sections || []).flatMap((s) => s.items || []);
  const flatItems = Array.isArray(data?.includes) ? data.includes : [];
  const text = [...sectionItems, ...flatItems].map((i) => i.text || "").join(" ");
  return INCLUDE_PICTOS.filter((p) => p.match.test(text));
};

const CATEGORY_META = {
  summer: { label: "Summer", color: "#2563eb", bg: "#eff6ff", text: "#1d4ed8" },
  luxury: { label: "Luxury", color: "#d97706", bg: "#fffbeb", text: "#92400e" },
  mythique: { label: "Mythique", color: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9" },
};

const STATUS_META = {
  active: { label: "Actif", bg: "#f0fdf4", text: "#15803d", dot: "#15803d" },
  published: { label: "Publié", bg: "#f0fdf4", text: "#15803d", dot: "#15803d" },
  draft: { label: "Brouillon", bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  archived: { label: "Archivé", bg: "#fffbeb", text: "#92400e", dot: "#d97706" },
};

const CONTINENTS = ["Tous", "Europe", "Asie", "Afrique", "Amériques", "Océanie"];
const CATEGORIES = ["Tous", "summer", "luxury", "mythique"];
const STATUSES = ["Tous", "active", "draft", "archived"];
const SORT_OPTIONS = [
  { value: "updatedAt_desc", label: "Récemment modifié" },
  { value: "basePrice_asc", label: "Prix croissant" },
  { value: "basePrice_desc", label: "Prix décroissant" },
  { value: "name_asc", label: "Nom A → Z" },
  { value: "departures_desc", label: "Plus de départs" },
];

export default function PackagesManager() {
  const {
    createPackage,
    updatePackage,
    deletePackage,
    findPackages,
    loading,
  } = usePackages();
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [rawPackages, setRawPackages] = useState([]);
  const packages = useMemo(() => rawPackages.map(normalize), [rawPackages]);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openEditInfo, setOpenEditInfo] = useState(false);


  const [search, setSearch] = useState("");
  const [filterContinent, setFilterContinent] = useState("Tous");
  const [filterCategory, setFilterCategory] = useState("Tous");
  const [filterStatus, setFilterStatus] = useState("Tous");
  const [filterAgency, setFilterAgency] = useState("Tous");
  const [priceRange, setPriceRange] = useState([0, 30000]);
  const [sortBy, setSortBy] = useState("updatedAt_desc");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [detailPkg, setDetailPkg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = packages.filter((p) => {
      // Recherche texte
      if (q) {
        const searchableText = [
          p.title,
          p.destination,
          p.destinationAccent,
          p.itineraryTitle,
          p.agency1,
          p.agency2,
          ...(p.data.tags || [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(q)) {
          return false;
        }
      }

      // Statut
      if (
        filterStatus !== "Tous" &&
        p.status !== filterStatus
      ) {
        return false;
      }

      // Catégorie
      if (
        filterCategory !== "Tous" &&
        p.category !== filterCategory
      ) {
        return false;
      }
      // Continent
      if (
        filterContinent !== "Tous" &&
        p.continent !== filterContinent
      ) {
        return false;
      }

      // Prix
      const price = Number(
        String(p.basePrice || "0").replace(/\s/g, "")
      );

      if (
        price < priceRange[0] ||
        price > priceRange[1]
      ) {
        return false;
      }

      return true;
    });

    const [field, dir] = sortBy.split("_");

    list.sort((a, b) => {
      let va;
      let vb;

      switch (field) {
        case "departures":
          va = a.departureDates?.length || 0;
          vb = b.departureDates?.length || 0;
          break;

        case "basePrice":
          va = Number(
            String(a.basePrice || "0").replace(/\s/g, "")
          );
          vb = Number(
            String(b.basePrice || "0").replace(/\s/g, "")
          );
          break;

        case "name":
          va = a.title || "";
          vb = b.title || "";
          break;

        default:
          va = a.updated_at || "";
          vb = b.updated_at || "";
      }

      if (typeof va === "string") {
        return dir === "asc"
          ? va.localeCompare(vb)
          : vb.localeCompare(va);
      }

      return dir === "asc"
        ? va - vb
        : vb - va;
    });

    return list;
  }, [
    packages,
    search,
    filterCategory,
    filterStatus,
    filterContinent,
    priceRange,
    sortBy
  ]);


  const duplicatePackage = async (pkg) => {
    const raw = rawPackages.find((r) => r.$id === pkg.$id);
    if (!raw) return;
    const copy = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("$")));
    try {
      await createPackage({
        ...copy,
        title: `${raw.title || "Package"} (copie)`,
        status: "draft",
        publishAt: "",
        unpublishAt: "",
        data: JSON.stringify(raw.data || {}),
      });
      toast.success("Package dupliqué en brouillon.");
      await loadPackages();
    } catch (e) {
      toast.error(e?.message || "Duplication impossible.");
    }
  };

  const [bulkOpen, setBulkOpen] = useState(false);

  const toggleSelect = id => setSelectedIds(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const doDelete = async (id) => {
    try {
      setLoadingStatusId?.(id);

      await deletePackage(id);

      setRawPackages((p) => p.filter((x) => x.$id !== id));

      toast.success("Package supprimé avec succès.");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(
        err?.message || "Impossible de supprimer le package."
      );
      console.error(err);
    } finally {
      setLoadingStatusId?.(null);
    }
  };

  const [loadingStatusId, setLoadingStatusId] = useState(null);

  // one-call LLM translation of a package's content (EN/AR) via OpenRouter
  const [translatingId, setTranslatingId] = useState(null);
  const handleTranslate = async (pkg) => {
    if (translatingId) return;
    setTranslatingId(pkg.$id);
    try {
      // translate the RAW stored blob, not the normalized/enriched copy
      const raw = rawPackages.find((r) => r.$id === pkg.$id);
      let data = raw?.data ?? {};
      if (typeof data === "string") { try { data = JSON.parse(data) || {}; } catch { data = {}; } }
      const next = await withTranslations(data);
      await updatePackage(pkg.$id, { data: JSON.stringify(next) });
      toast.success("Traductions EN/AR mises à jour");
    } catch (e) {
      toast.error("Traduction échouée : " + (e?.message || e));
    } finally {
      setTranslatingId(null);
    }
  };

  const statusMessages = {
    published: {
      success: "Package publié avec succès.",
    },
    archived: {
      success: "Package archivé.",
    },
    draft: {
      success: "Package sauvegardé en brouillon.",
    },
    active: {
      success: "Package activé.",
    },
  };

  const toggleStatus = async (id, status) => {
    try {
      setLoadingStatusId(id);

      await updatePackage(id, { status });

      setRawPackages((p) =>
        p.map((x) =>
          x.$id === id ? { ...x, status } : x
        )
      );

      toast.success(
        statusMessages?.[status]?.success ||
        "🔄 Statut mis à jour."
      );
    } catch (err) {
      toast.error(
        err?.message || "Impossible de modifier le statut."
      );
    } finally {
      setLoadingStatusId(null);
    }
  };


  const activeFilters = [filterContinent, filterCategory, filterStatus, filterAgency]
    .filter(f => f !== "Tous").length + (search ? 1 : 0);

  // Aplatit row.data (JSON string) + métadonnées du row
  const loadPackages = useCallback(async () => {
    try {
      const result = await findPackages();
      const rows = (Array.isArray(result?.documents) ? result.documents : []).map(r => {
        let data = r.data;

        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            data = {}; // ou garder r.data selon ton besoin
          }
        }

        return {
          ...r,
          data
        };
      })
        // Les réglages du site vivent aussi dans `products` (data.kind : hero
        // slides, omra, contact, notifications, agence) mais se gèrent depuis
        // Paramètres, pas ici.
        .filter(r => !r.data?.kind);
      setRawPackages(rows);
    } catch (err) {
      console.error("Erreur chargement packages:", err);
    }
  }, [findPackages]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  return (
    <div className="pkg-root">

      {/* ── Header ── */}
      <div className="pkg-page-header">
        <div className="pkg-page-header-inner">
          <div>
            <h1 className="pkg-page-title">Gestion des packages</h1>
            <p className="pkg-page-subtitle">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} · Dernière mise à jour aujourd'hui
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="em-action-btn" disabled={selectedIds.size === 0} onClick={() => setBulkOpen(true)}
              title={selectedIds.size ? "" : "Cochez des packages pour modifier leurs prix"}>
              <i className="ti ti-percentage" aria-hidden="true" /> Prix en masse{selectedIds.size ? ` (${selectedIds.size})` : ""}
            </button>
            <button className="em-action-btn primary" onClick={() => setOpenCreate(true)}>
              <i className="ti ti-plus" aria-hidden="true" /> Nouveau package
            </button>
          </div>
        </div>
      </div>

      <div className="pkg-main">
        {/* ── Filters ── */}
        <div className="pkg-filters">
          <div className="pkg-filters-row">
            <div className="em-search-wrap" style={{ maxWidth: 260 }}>
              <div className="em-search">
                <i className="ti ti-search em-search-icon" aria-hidden="true" />
                <input type="text" placeholder="Rechercher destination, nom…" value={search} onChange={e => setSearch(e.target.value)} />
                {search && (
                  <button className="em-search-clear" onClick={() => setSearch("")}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {[
              { value: filterContinent, set: setFilterContinent, opts: CONTINENTS, icon: "ti-world", placeholder: "Continent" },
              { value: filterCategory, set: setFilterCategory, opts: CATEGORIES, icon: "ti-tag", placeholder: "Catégorie", labelFn: v => v === "Tous" ? "Catégorie" : CATEGORY_META[v]?.label ?? v },
              { value: filterStatus, set: setFilterStatus, opts: STATUSES, icon: "ti-toggle-right", placeholder: "Statut", labelFn: v => v === "Tous" ? "Statut" : STATUS_META[v]?.label ?? v }
            ].map((f, i) => (
              <div key={i} className="pkg-select-wrap">
                <i className={`ti ${f.icon} pkg-select-icon`} aria-hidden="true" />
                <select
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  className={`pkg-select ${f.value !== "Tous" ? "has-value" : ""}`}
                >
                  {f.opts.map((o, index) => <option key={index} value={o}>{f.labelFn ? f.labelFn(o) : (o === "Tous" ? f.placeholder : o)}</option>)}
                </select>
                <i className="ti ti-chevron-down pkg-select-chevron" aria-hidden="true" />
              </div>
            ))}

            <div className="pkg-select-wrap" style={{ marginLeft: "auto" }}>
              <i className="ti ti-arrows-sort pkg-select-icon" aria-hidden="true" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="pkg-select" style={{ minWidth: 180 }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <i className="ti ti-chevron-down pkg-select-chevron" aria-hidden="true" />
            </div>

            <div className="pkg-view-toggle">
              {[["grid", "ti-layout-grid"], ["list", "ti-list"]].map(([m, icon]) => (
                <button key={m} onClick={() => setViewMode(m)} className={`pkg-view-btn ${viewMode === m ? "active" : ""}`}>
                  <i className={`ti ${icon}`} aria-hidden="true" />
                </button>
              ))}
            </div>

            {activeFilters > 0 && (
              <button onClick={() => { setSearch(""); setFilterContinent("Tous"); setFilterCategory("Tous"); setFilterStatus("Tous"); setFilterAgency("Tous"); }} className="pkg-clear-filters">
                <i className="ti ti-x" aria-hidden="true" /> {activeFilters} filtre{activeFilters > 1 ? "s" : ""} actif{activeFilters > 1 ? "s" : ""}
              </button>
            )}
          </div>

          <div className="pkg-price-range">
            <span className="pkg-price-label">Prix :</span>
            <input type="range" min={0} max={30000} step={500} value={priceRange[0]} onChange={e => setPriceRange([+e.target.value, priceRange[1]])} />
            <span className="pkg-price-value">{priceRange[0].toLocaleString("fr-MA") || 0} DH</span>
            <span className="pkg-price-sep">—</span>
            <input type="range" min={0} max={30000} step={500} value={priceRange[1]} onChange={e => setPriceRange([priceRange[0], +e.target.value])} />
            <span className="pkg-price-value">{priceRange[1].toLocaleString("fr-MA") || 0} DH</span>
          </div>
        </div>

        {/* ── Grid / List ── */}
        {loading ? (
          <div className="em-loading">
            <div className="em-spinner" />
            <span>Chargement des packages...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="em-empty">
            <div className="em-empty-icon">
              <i className="ti ti-search-off" style={{ fontSize: 32 }} aria-hidden="true" />
            </div>
            <p className="em-empty-title">Aucun package trouvé</p>
            <p className="em-empty-text">Essayez de modifier vos filtres</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="pkg-grid">
            {filtered.map((pkg) => (
              <PackageCard
                key={pkg.$id}
                pkg={pkg}
                selected={selectedIds.has(pkg.$id)}
                loadingStatus={loadingStatusId === pkg.$id}
                onSelect={() => toggleSelect(pkg.$id)}
                onDetail={() => {
                  setDetailPkg(pkg);
                  setOpenDetail(true);
                }}
                onDelete={() => setConfirmDelete(pkg)}
                onDuplicate={() => duplicatePackage(pkg)}
                onEditInfo={() => {
                  setDetailPkg(pkg);
                  setOpenEditInfo(true);
                }}
                onSave={(pkg) => {
                  setLoadingStatusId(pkg.$id);
                }}
                onEdit={() => {
                  setDetailPkg(pkg);
                  setOpenEdit(true);
                }}
                onTranslate={() => handleTranslate(pkg)}
                translating={translatingId === pkg.$id}
                onToggleStatus={(status) =>
                  setConfirmStatus({
                    id: pkg.$id,
                    title: pkg.title,
                    status,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ListHeader />

            {filtered.map((pkg) => (
              <PackageRow
                key={pkg.$id}
                pkg={pkg}
                selected={selectedIds.has(pkg.$id)}
                onSelect={() => toggleSelect(pkg.$id)}
                onDetail={() => {
                  setDetailPkg(pkg);
                  setOpenDetail(true);
                }}
                onDelete={() => setConfirmDelete(pkg)}
                onDuplicate={() => duplicatePackage(pkg)}
                onEdit={() => {
                  setDetailPkg(pkg);
                  setOpenEdit(true);
                }}
                onTranslate={() => handleTranslate(pkg)}
                translating={translatingId === pkg.$id}
                onToggleStatus={(status) =>
                  setConfirmStatus({
                    id: pkg.$id,
                    title: pkg.title,
                    status,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {detailPkg && openDetail && (
        <DetailPanel pkg={detailPkg} onClose={() => setOpenDetail(false)} onEdit={() => setOpenEdit(true)}
          onTranslate={() => detailPkg && handleTranslate(detailPkg)} translating={translatingId === detailPkg?.$id}
          onDelete={() => { setConfirmDelete(detailPkg); setDetailPkg(null); setOpenDetail(false) }} />
      )}

      {confirmDelete && (
        <div className="em-modal-backdrop" style={{ alignItems: "center" }}>
          <div className="em-confirm">
            <div className="em-confirm-icon">
              <i className="ti ti-trash" style={{ fontSize: 22 }} aria-hidden="true" />
            </div>
            <h3 className="em-confirm-title">Supprimer ce package ?</h3>
            <p className="em-confirm-text">
              <strong>{confirmDelete.title}</strong> sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="em-confirm-actions">
              <button onClick={() => setConfirmDelete(null)} className="em-btn-secondary">Annuler</button>
              <button onClick={() => doDelete(confirmDelete.$id)} className="em-btn-danger">Supprimer</button>
            </div>
          </div>
        </div>
      )}
      {confirmStatus && (
        <div className="em-modal-backdrop" style={{ alignItems: "center" }}>
          <div className="em-confirm">
            <div className="em-confirm-icon" style={{ background: "#eff6ff", color: "#ff750e" }}>
              <i className="ti ti-refresh" style={{ fontSize: 22 }} aria-hidden="true" />
            </div>
            <h3 className="em-confirm-title">Changer le statut ?</h3>
            <p className="em-confirm-text">
              Le package <strong>{confirmStatus.title}</strong> sera passé au
              statut <strong>{STATUS_META[confirmStatus.status]?.label}</strong>.
            </p>
            <div className="em-confirm-actions">
              <button onClick={() => setConfirmStatus(null)} className="em-btn-secondary">Annuler</button>
              <button
                onClick={async () => {
                  await toggleStatus(
                    confirmStatus.id,
                    confirmStatus.status
                  );
                  setConfirmStatus(null);
                }}
                className="em-action-btn primary"
                style={{ padding: "10px 22px", fontSize: 13 }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {openEdit && (
        <PackageEditorModal
          pkg={detailPkg}
          onSave={(pkg) => {
            setOpenEdit(false);
            setLoadingStatusId(pkg.$id);
            setDetailPkg({ ...pkg, data: JSON.parse(pkg.data) })
            setRawPackages(prev =>
              prev.map(item =>
                item.$id === pkg.$id
                  ? { ...pkg, data: JSON.parse(pkg.data) }
                  : item
              )
            );
            setLoadingStatusId(undefined);
          }}
          onClose={() => setOpenEdit(false)}
        />
      )}
      {openCreate && (
        <TravelDataProvider>
          {bulkOpen && (
            <BulkPriceModal
              ids={[...selectedIds]}
              titles={rawPackages.filter((r) => selectedIds.has(r.$id)).map((r) => r.title)}
              onClose={() => setBulkOpen(false)}
              onDone={async () => {
                setBulkOpen(false);
                setSelectedIds(new Set());
                await loadPackages();
              }}
            />
          )}
          <CreatePackageModal
            pkg={undefined}
            onClose={() => setOpenCreate(false)}
            onCreated={loadPackages}  // recharge la liste après création
          />
        </TravelDataProvider>

      )}
      {openEditInfo && (
        <TravelDataProvider>
          <CreatePackageModal
            pkg={detailPkg}
            onClose={() => setOpenEditInfo(false)}
            onCreated={loadPackages}  // recharge la liste après création
          />
        </TravelDataProvider>

      )}
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────
/**
 * Hausse (ou baisse) de prix sur les packages cochés : prix « à partir de »,
 * tarifs des chambres, suppléments de départ — arrondis. Les réservations
 * existantes ne changent pas.
 */
function BulkPriceModal({ ids, titles, onClose, onDone }) {
  const [percent, setPercent] = useState("5");
  const [amount, setAmount] = useState("");
  const [roundTo, setRoundTo] = useState("10");
  const [apply, setApply] = useState({ base: true, rooms: true, departures: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await bulkPrice({ ids, percent: Number(percent) || 0, amount: Number(amount) || 0, roundTo: Number(roundTo) || 1, apply });
      toast.success(`${r.updated} package(s) mis à jour.`);
      await onDone();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };
  const box = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#475569" };
  const inp = { padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontFamily: "inherit" };
  return (
    <Modal onClose={onClose} title={`Modifier les prix — ${ids.length} package(s)`}>
      <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>{titles.join(" · ")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <label style={box}>Variation (%)<input style={inp} type="number" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} /></label>
        <label style={box}>et / ou montant (DH)<input style={inp} type="number" step="50" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
        <label style={box}>Arrondi à<input style={inp} type="number" min="1" value={roundTo} onChange={(e) => setRoundTo(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: 16, margin: "14px 0", fontSize: 13 }}>
        {[["base", "Prix « à partir de »"], ["rooms", "Tarifs des chambres"], ["departures", "Suppléments de départ"]].map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={apply[k]} onChange={(e) => setApply((a) => ({ ...a, [k]: e.target.checked }))} /> {l}
          </label>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8" }}>Exemple : +5 % et arrondi à 10 → 13 900 DH devient 14 600 DH. Les réservations déjà enregistrées gardent leur prix.</p>
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>⚠ {error}</p>}
      <div className="adm-modal-footer">
        <button className="em-action-btn" onClick={onClose}>Annuler</button>
        <button className="em-action-btn primary" disabled={saving} onClick={run}>{saving ? "…" : "Appliquer"}</button>
      </div>
    </Modal>
  );
}

function PackageCard({ pkg, selected, onDetail, onDelete, onToggleStatus, onEdit, onDuplicate, loadingStatus, onEditInfo, onTranslate, translating }) {
  const cat = CATEGORY_META[pkg._category] || CATEGORY_META.summer;
  const st = STATUS_META[pkg.status] || STATUS_META.draft;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  useClickOutside(menuRef, () => setMenuOpen(false));

  return (
    <div className={`pkg-card ${selected ? "selected" : ""}`}>
      {loadingStatus && (
        <div className="pkg-card-loading">
          <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 26, color: "#ff750e" }} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#ff750e" }}>Mise à jour...</span>
        </div>
      )}

      <div
        className="pkg-card-hero"
        style={pkg.data.heroBg
          ? { backgroundImage: `url(${pkg.data.heroBg})` }
          : { background: `linear-gradient(135deg, ${cat.color}22 0%, ${cat.color}44 100%)` }}
      >
        {!pkg.data.heroBg && <div style={{ fontSize: 36, opacity: 0.25 }}>✈️</div>}
        <div className="pkg-card-hero-badges">
          <span className="pkg-badge" style={{ background: cat.bg, color: cat.text }}>{pkg.country}</span>
          <span className="pkg-badge" style={{ background: st.bg, color: st.text }}>
            <span className="pkg-badge-dot" style={{ background: st.dot }} />{st.label}
          </span>
        </div>
        <button className="pkg-menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
          <i className="ti ti-dots-vertical" aria-hidden="true" />
        </button>
        {menuOpen && (
          <div ref={menuRef} className="pkg-menu" onClick={e => e.stopPropagation()}>
            {[
              {
                icon: "ti-eye", label: "Ouvrir", fn: () => {
                  window.open(`${window.location.origin}${packagePath(pkg.$id, pkg.title)}`, "_blank");
                }
              },
              {
                icon: "ti-copy", label: "Copier lien", fn: () => {
                  navigator.clipboard.writeText(`${window.location.origin}${packagePath(pkg.$id, pkg.title)}?mode=admin`);
                }
              },
              { icon: "ti-edit", label: "Modifier Infos", fn: onEditInfo },
              { icon: "ti-copy", label: "Dupliquer", fn: onDuplicate },
              ...(pkg.status !== "active" && pkg.status !== "published" ? [{ icon: "ti-circle-check", label: "Activer", fn: () => onToggleStatus("active") }] : []),
              ...(pkg.status !== "draft" ? [{ icon: "ti-edit", label: "Brouillon", fn: () => onToggleStatus("draft") }] : []),
              ...(pkg.status !== "archived" ? [{ icon: "ti-archive", label: "Archiver", fn: () => onToggleStatus("archived") }] : []),
              { icon: "ti-trash", label: "Supprimer", fn: onDelete, red: true },
            ].map((item, i) => (
              <button key={i} onClick={() => { item.fn(); setMenuOpen(false); }} className={`pkg-menu-item ${item.red ? "danger" : ""}`}>
                <i className={`ti ${item.icon}`} aria-hidden="true" /> {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pkg-card-body" onClick={onDetail}>
        <div className="pkg-card-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pkg-card-name">{pkg.title}</div>
            <div className="pkg-card-sub">
              {pkg._country && pkg._country !== pkg._destination ? `, ${pkg._country}` : ""}
            </div>
          </div>
          <div className="pkg-card-price">
            <div className="pkg-card-price-from">À partir de</div>
            <div className="pkg-card-price-value">{pkg.basePrice?.toLocaleString("fr-MA")}</div>
            <div className="pkg-card-price-unit">{pkg.currency || "DH"}/pers.</div>
          </div>
        </div>

        {pkg._periodLabel && (
          <div className="pkg-card-period">
            <i className="ti ti-calendar-event" aria-hidden="true" />
            {pkg._periodLabel}
          </div>
        )}

        <div className="pkg-card-meta">
          {[
            { icon: "ti-world", label: pkg.country },
            { icon: "ti-map-pin", label: pkg._destination || pkg.title },
            { icon: "ti-calendar", label: `${pkg.data.departureDates.length} départ${pkg.data.departureDates.length !== 1 ? "s" : ""}` },
            { icon: "ti-bed", label: (() => { const n = countHotels(pkg.data.hotelCategories); return `${n} hôtel${n !== 1 ? "s" : ""}`; })() },
          ].map((m, i) => (
            <div key={i} className="pkg-card-meta-item">
              <i className={`ti ${m.icon}`} aria-hidden="true" />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
            </div>
          ))}
        </div>

        {includedPictos(pkg.data).length > 0 && (
          <div className="pkg-card-includes">
            {includedPictos(pkg.data).map((p) => (
              <span key={p.key} className="pkg-card-picto" title={p.label}>
                <i className={`ti ${p.icon}`} aria-hidden="true" /> {p.label.replace(" inclus", "")}
              </span>
            ))}
          </div>
        )}

        {departureMonths(pkg.data?.departureDates).length > 0 && (
          <div className="pkg-card-dates">
            {departureMonths(pkg.data.departureDates).map((m) => (
              <span key={m} className="pkg-tag">{m}</span>
            ))}
          </div>
        )}

        {pkg.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {pkg.tags.slice(0, 3).map(t => (
              <span key={t} className="pkg-tag">#{t}</span>
            ))}
          </div>
        )}

        <div className="pkg-card-actions">
          <button onClick={e => { e.stopPropagation(); onDetail(); }} className="em-action-btn" style={{ flex: 1, justifyContent: "center", border: "1px solid #e2e8f0" }}>
            <i className="ti ti-eye" aria-hidden="true" /> Détails
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="em-action-btn primary" style={{ flex: 1, justifyContent: "center" }}>
            <i className="ti ti-edit" aria-hidden="true" /> Editor
          </button>
          <button
            onClick={e => { e.stopPropagation(); onTranslate && onTranslate(); }}
            className="em-action-btn"
            disabled={translating}
            title="Mettre à jour les traductions (EN/AR)"
            style={{ border: "1px solid #e2e8f0", justifyContent: "center", minWidth: 40 }}
          >
            {translating ? "…" : <i className="ti ti-language" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────
function ListHeader() {
  return (
    <div className="pkg-list-header">
      <span /><span>Package</span><span>Destination</span><span>Durée</span><span>Prix</span><span>Départs</span><span>Catégorie</span><span>Statut</span><span style={{ textAlign: "right" }}>Actions</span>
    </div>
  );
}

function PackageRow({ pkg, selected, onSelect, onDetail, onDelete, onEdit, onTranslate, translating }) {
  const cat = CATEGORY_META[pkg._category] || CATEGORY_META.summer;
  const st = STATUS_META[pkg.status] || STATUS_META.draft;
  return (
    <div className={`pkg-row ${selected ? "selected" : ""}`}>
      <div onClick={e => { e.stopPropagation(); onSelect(); }} className={`pkg-row-check ${selected ? "checked" : ""}`}>
        {selected && <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true" />}
      </div>
      <div>
        <div className="pkg-row-title">{pkg.title}</div>
        <div className="pkg-row-sub">{pkg.data.agency}</div>
      </div>
      <div>
        <div style={{ fontSize: 13 }}>{pkg.data.destination}</div>
        <div className="pkg-row-sub">{pkg.data.country}</div>
      </div>
      <div>
        <div style={{ fontSize: 12 }}>{pkg.data.duration}J / {pkg.data.nights}N</div>
        <div className="pkg-row-sub">{pkg.data.periodLabel}</div>
      </div>
      <span className="pkg-row-price">{pkg.data.basePrice.toLocaleString("fr-MA")}<span style={{ fontSize: 10, fontWeight: 400, color: "#64748b" }}> DH</span></span>
      <span style={{ color: "#64748b", fontSize: 12 }}>{pkg.data.departureDates.length} départ{pkg.data.departureDates.length !== 1 ? "s" : ""}</span>
      <span className="pkg-badge" style={{ background: cat.bg, color: cat.text }}>{cat.label}</span>
      <span className="pkg-badge" style={{ background: st.bg, color: st.text }}>
        <span className="pkg-badge-dot" style={{ background: st.dot }} />{st.label}
      </span>
      <div className="pkg-row-actions" onClick={e => e.stopPropagation()}>
        <button onClick={onDetail} className="pkg-row-action-btn">
          <i className="ti ti-eye" aria-hidden="true" />
        </button>
        <button onClick={onEdit} className="pkg-row-action-btn edit">
          <i className="ti ti-edit" aria-hidden="true" />
        </button>
        <button
          onClick={() => onTranslate && onTranslate()}
          className="pkg-row-action-btn"
          disabled={translating}
          title="Mettre à jour les traductions (EN/AR)"
        >
          {translating ? "…" : <i className="ti ti-language" aria-hidden="true" />}
        </button>
        <button onClick={onDelete} className="pkg-row-action-btn danger">
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────
function DetailPanel({ pkg, onClose, onDelete, onEdit, onTranslate, translating }) {
  const st = STATUS_META[pkg.status] || STATUS_META.draft;
  const [tab, setTab] = useState("overview");
  const { refreshAvailability } = useHotels();
  useEffect(() => { refreshAvailability(); }, [refreshAvailability]);

  return (
    <div className="pkg-detail-overlay" onClick={onClose}>
      <div className="pkg-detail-panel" onClick={e => e.stopPropagation()}>

        <div className="pkg-detail-header">
          <div className="pkg-detail-title-row">
            <h2 className="pkg-detail-title">{pkg.title}</h2>
            <button onClick={onClose} className="em-modal-close" style={{ border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="pkg-price-chip">
              <div className="pkg-price-chip-label">{pkg.priceFromLabel || "À partir de"}</div>
              <div className="pkg-price-chip-value">{pkg.basePrice?.toLocaleString("fr-MA") || 0} <span style={{ fontSize: 13, fontWeight: 500 }}>{pkg.currency || "DH"}</span></div>
            </div>
            <div className="pkg-detail-facts">
              <span className="pkg-badge" style={{ background: st.bg, color: st.text, marginBottom: 4 }}>
                <span className="pkg-badge-dot" style={{ background: st.dot }} />{st.label}
              </span>
            </div>
          </div>
        </div>

        <div className="em-tabs" style={{ padding: "0 24px" }}>
          {[["overview", "Aperçu"], ["includes", "Inclus / Options"], ["departures", "Départs"], ["hotels", "Hôtels & Tarifs"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`em-tab ${tab === id ? "active" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="pkg-detail-body">
          {tab === "overview" && <OverviewTab pkg={pkg} />}
          {tab === "includes" && <IncludesTab pkg={pkg} />}
          {tab === "departures" && <DeparturesTab pkg={pkg} />}
          {tab === "hotels" && <HotelsTab pkg={pkg} />}
        </div>

        <div className="pkg-detail-footer">
          <button onClick={onDelete} className="em-action-btn danger" style={{ border: "1px solid #fecaca", background: "#fef2f2" }}>
            <i className="ti ti-trash" aria-hidden="true" /> Supprimer
          </button>
          <button onClick={onTranslate} disabled={translating} className="em-action-btn" title="Mettre à jour les traductions (EN/AR)" style={{ border: "1px solid #e2e8f0" }}>
            {translating ? "…" : <i className="ti ti-language" aria-hidden="true" />}
          </button>
          <button onClick={onEdit} className="em-action-btn primary" style={{ flex: 1, justifyContent: "center" }}>
            <i className="ti ti-edit" aria-hidden="true" /> Modifier ce package
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ pkg }) {
  const pictos = includedPictos(pkg.data);
  return (
    <div>
      {pictos.length > 0 && (
        <div className="pkg-card-includes" style={{ marginBottom: 16 }}>
          {pictos.map((p) => (
            <span key={p.key} className="pkg-card-picto" title={p.label}>
              <i className={`ti ${p.icon}`} aria-hidden="true" /> {p.label.replace(" inclus", "")}
            </span>
          ))}
        </div>
      )}

      <Section title="Informations générales">
        {[
          { icon: "ti-map-pin", label: "Ville(s)", value: pkg._destination || pkg.title },
          { icon: "ti-world", label: "Pays", value: pkg.country },
          { icon: "ti-id", label: "Référence", value: String(pkg.$id) },
          {
            icon: "ti-calendar-event",
            label: "Créé le",
            value: new Date(pkg.$createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          {
            icon: "ti-clock-edit",
            label: "Modifié le",
            value: new Date(pkg.$updatedAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          { icon: "ti-world-www", label: "Lien", value: `${window.location.origin}${packagePath(pkg.$id, pkg.title)}?mode=admin` }
        ].map((r, i) => (
          <div key={i} className="pkg-info-row">
            <span className="pkg-info-row-label">
              <i className={`ti ${r.icon}`} aria-hidden="true" />{r.label}
            </span>
            <span className="pkg-info-row-value">{r.value}</span>
          </div>
        ))}
      </Section>

      {pkg.tags.length > 0 && (
        <Section title="Tags">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pkg.tags.map(t => (
              <span key={t} className="pkg-tag">#{t}</span>
            ))}
          </div>
        </Section>
      )}


    </div>
  );
}

function IncludesTab({ pkg }) {
  const includesList = Array.isArray(pkg.data.includes) ? pkg.data.includes : [];
  const optionsList = Array.isArray(pkg.data.options) ? pkg.data.options : [];
  return (
    <div>
      <Section title={`${includesList.length} service${includesList.length !== 1 ? "s" : ""} inclus`}>
        {includesList.length === 0
          ? <p style={{ color: "#64748b", fontSize: 13 }}>Aucun service renseigné</p>
          : includesList.map(item => (
            <div key={item.id} className="pkg-include-item">
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))
        }
      </Section>

      {optionsList.length > 0 && (
        <Section title={`${optionsList.length} option${optionsList.length !== 1 ? "s" : ""} disponibles`}>
          {optionsList.map(item => (
            <div key={item.id} className="pkg-option-item">
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
          {pkg.optionPackageLabel && (
            <div className="em-info-box blue" style={{ marginTop: 8, marginBottom: 0, justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#ff750e" }}>{pkg.optionPackageLabel}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ff750e" }}>{pkg.optionPackagePrice} DH {pkg.optionPackagePer}</span>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function DeparturesTab({ pkg }) {
  return (
    <div>
      <Section title={`${pkg.data.departureDates.length} date${pkg.data.departureDates.length !== 1 ? "s" : ""} de départ`}>
        {pkg.data.departureDates.length === 0
          ? <p style={{ color: "#64748b", fontSize: 13 }}>Aucune date configurée</p>
          : pkg.data.departureDates.map((d, i) => (
            <div key={d.id} className="pkg-departure-item">
              <div className="pkg-departure-num">{String(i + 1).padStart(2, "0")}</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{d.from}</span>
                <i className="ti ti-arrow-right" style={{ fontSize: 13, margin: "0 8px", color: "#94a3b8" }} aria-hidden="true" />
                <span style={{ fontWeight: 500, fontSize: 14 }}>{d.to}</span>
              </div>
              <i className="ti ti-plane-departure" style={{ fontSize: 15, color: "#ff750e" }} aria-hidden="true" />
            </div>
          ))
        }
      </Section>
    </div>
  );
}

function HotelsTab({ pkg }) {
  const { getBooked } = useHotels();
  const categories = pkg.data.hotelCategories || [];

  if (!categories.length) {
    return (
      <Section title="Hôtels & Tarifs">
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Aucune formule hôtelière configurée pour ce package.</p>
      </Section>
    );
  }

  return (
    <div>
      {categories.map((cat, catIdx) => {
        const hotels = cat.hotels || [];
        // Price columns are always the last N headers, where N = cols.length
        // on the hotel rows — robust whether this category came from the
        // current editor (4 fixed prefix columns: Hôtel/Ville/Nuits/★) or an
        // old never-re-saved package (2-prefix legacy shape).
        const colCount = hotels[0]?.cols?.length || 0;
        const headers = cat.tableHeaders || [];
        const colHeaders = colCount ? headers.slice(headers.length - colCount) : [];
        const catRoomTypes = roomTypesFor(cat);
        const title = cat.label
          ? `${cat.label} — ${hotels.length} hôtel${hotels.length !== 1 ? "s" : ""}`
          : `${hotels.length} hôtel${hotels.length !== 1 ? "s" : ""} disponible${hotels.length !== 1 ? "s" : ""}`;

        return (
          <Section key={cat.id ?? catIdx} title={title}>
            {hotels.map(h => (
              <div key={h.id} className="pkg-hotel-card">
                <div className="pkg-hotel-head">
                  <div className="pkg-hotel-icon">
                    <i className="ti ti-building" aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {[h.city, h.nights ? `${h.nights}N` : null].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ fontSize: 12, color: "#d97706", marginTop: 2 }}>{"★".repeat(h.stars || 0)}</div>
                  </div>
                </div>
                {h.cols && h.cols.length > 0 && (
                  <div className="pkg-hotel-cols" style={{ gridTemplateColumns: `repeat(${colHeaders.length}, 1fr)` }}>
                    {colHeaders.map((col, ci) => {
                      // Availability is keyed by the column's own label — the
                      // same string BookingFlow writes onto a reservation —
                      // so custom columns ("Baby 1-2") track too.
                      const rt = catRoomTypes[ci];
                      const total = rt ? Number(h.allotment?.[rt.colIdx]) || 0 : 0;
                      const booked = total > 0 && h.hotelId ? getBooked(h.hotelId, pkg.$id, rt.label) : null;
                      return (
                        <div key={ci} className="pkg-hotel-col">
                          <div className="pkg-hotel-col-label">{col}</div>
                          <div className="pkg-hotel-col-value">{h.cols[ci] || "—"}</div>
                          {booked !== null && (
                            <div className={`pkg-hotel-col-avail ${booked > total ? "over" : ""}`}>{booked}/{total}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {cat.note && (
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>{cat.note}</p>
            )}
          </Section>
        );
      })}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="pkg-section">
      <h3 className="pkg-section-title">{title}</h3>
      {children}
    </div>
  );
}

// ── Editor modal ──────────────────────────────────────────────────
function PackageEditorModal({ pkg, onChange, onSave, onClose }) {
  return (
    <Modal onClose={onClose} fullscreen>
      {pkg && (
        <PackageEditorPage
          pkg={pkg}
          onChange={onChange}
          onClose={onClose}
          onSave={onSave}
        />
      )}

    </Modal>
  );
}
