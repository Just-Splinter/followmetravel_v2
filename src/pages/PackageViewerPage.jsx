import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePackages } from "../context/PackageViewerContext";
import { ReservationModal } from "../components/Reservationmodal";
import { ReservationProvider } from "../context/ReservationContext";
import { useEvents } from "../context/EventsContext";
import { useAuth } from "../context/AuthContext";
import '../styles/PackageViewerPage.css'


// ─── Itinerary Timeline Component (Left-Aligned) ───────────────────
function ItineraryTimeline({ pkg }) {
  const days = pkg.days || [];

  if (!days || days.length === 0) {
    return (
      <div className="pv-timeline-empty">
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
        <p>Aucun programme disponible pour ce voyage.</p>
      </div>
    );
  }

  return (
    <>      
      <div className="pv-card">
        <h2 className="pv-card-title">
          {pkg.itineraryTitle || "Programme du voyage"}
        </h2>
        
        <p className="pv-text" style={{ marginBottom: 24 }}>
          Découvrez jour par jour votre itinéraire et les expériences qui vous attendent.
        </p>

        <div className="pv-timeline">
          {days.map((day, idx) => (
            <div key={day.id} className="pv-timeline-item">
              {/* Marker */}
              <div className="pv-timeline-marker">
                {day.num || (idx + 1).toString().padStart(2, '0')}
              </div>

              {/* Badge */}
              {day.badge && (
                <div className="pv-timeline-badge">{day.badge}</div>
              )}

              {/* Card */}
              <div className="pv-timeline-card">
                {/* Image */}
                <div className="pv-timeline-image-wrap">
                  {day.image ? (
                    <>
                      <img
                        src={day.image}
                        alt={day.title}
                        className="pv-timeline-image"
                        loading="lazy"
                      />
                      <div className="pv-timeline-image-overlay" />
                    </>
                  ) : (
                    <div className="pv-timeline-image-placeholder">
                      📍
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="pv-timeline-body">
                  <div className="pv-timeline-day-label">
                    Jour {day.num || (idx + 1).toString().padStart(2, '0')}
                  </div>
                  
                  <h3 className="pv-timeline-title">{day.title}</h3>
                  
                  {day.theme && (
                    <div className="pv-timeline-theme">
                      {day.theme}
                    </div>
                  )}

                  {day.activities && day.activities.length > 0 && (
                    <>
                      <div className="pv-timeline-divider" />
                      <ul className="pv-timeline-activities">
                        {day.activities.map((activity, actIdx) => (
                          <li key={activity.id || actIdx} className="pv-timeline-activity">
                            <div className="pv-timeline-activity-icon">
                              {activity.optional ? '?' : '✓'}
                            </div>
                            <div className="pv-timeline-activity-text">
                              {activity.label}
                              {activity.optional && (
                                <span className="pv-timeline-activity-optional">
                                  Optionnel
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Theme helpers ─────────────────────────────────────────────────
const DEFAULT_CUSTOM_THEME = {
  primary: "#FF6B35",
  primaryLight: "#FF8C61",
  secondary: "#004E89",
  dark: "#1A1A2E",
  light: "#F7F7F7",
  textDark: "#2D2D2D",
  textMuted: "#6B7280",
  accent: "#FFD23F",
  border: "rgba(0,0,0,0.08)",
  fontDisplay: "'Poppins', sans-serif",
  fontBody: "'Inter', sans-serif",
  fontSizeBase: 14,
};

const PALETTES = [
  { id: "orange", theme: { primary: "#FF6B35", primaryLight: "#FF8C61", secondary: "#004E89", dark: "#1A1A2E", light: "#F7F7F7", textDark: "#2D2D2D", textMuted: "#6B7280", accent: "#FFD23F" } },
  { id: "blue", theme: { primary: "#004E89", primaryLight: "#1A6FB5", secondary: "#FF6B35", dark: "#0A2540", light: "#F0F7FF", textDark: "#1A1A2E", textMuted: "#5A6C7D", accent: "#FFD23F" } },
  { id: "green", theme: { primary: "#2D6A4F", primaryLight: "#40916C", secondary: "#D4A373", dark: "#1B4332", light: "#F0F7F4", textDark: "#1B4332", textMuted: "#52796F", accent: "#FFD23F" } },
  { id: "purple", theme: { primary: "#7209B7", primaryLight: "#9D4EDD", secondary: "#F72585", dark: "#3A0CA3", light: "#F8F5FF", textDark: "#2D2D2D", textMuted: "#6B7280", accent: "#FFD23F" } },
  { id: "red", theme: { primary: "#DC2626", primaryLight: "#EF4444", secondary: "#1E40AF", dark: "#7F1D1D", light: "#FEF2F2", textDark: "#1F2937", textMuted: "#6B7280", accent: "#FCD34D" } },
  { id: "teal", theme: { primary: "#0D9488", primaryLight: "#14B8A6", secondary: "#F59E0B", dark: "#134E4A", light: "#F0FDFA", textDark: "#1F2937", textMuted: "#6B7280", accent: "#FCD34D" } },
  { id: "custom", theme: null },
];

function getTheme(pkg) {
  if (pkg.paletteId === "custom") return { ...DEFAULT_CUSTOM_THEME, ...(pkg.customTheme || {}) };
  const palette = PALETTES.find(p => p.id === pkg.paletteId);
  return { ...DEFAULT_CUSTOM_THEME, ...(palette?.theme || {}) };
}




// ─── Lightbox Component ─────────────────────────────────────────────
export function Lightbox({ images, index, onClose }) {
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrent(c => (c > 0 ? c - 1 : images.length - 1));
      if (e.key === "ArrowRight") setCurrent(c => (c < images.length - 1 ? c + 1 : 0));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  return (
    <div className="pv-lightbox" onClick={onClose}>
      <div className="pv-lightbox-content" onClick={e => e.stopPropagation()}>
        <img src={images[current]?.url || images[current]} alt="" className="pv-lightbox-img" />
        <button className="pv-lightbox-btn pv-lightbox-prev" onClick={() => setCurrent(c => c > 0 ? c - 1 : images.length - 1)}>‹</button>
        <button className="pv-lightbox-btn pv-lightbox-next" onClick={() => setCurrent(c => c < images.length - 1 ? c + 1 : 0)}>›</button>
        <button className="pv-lightbox-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ─── Gallery Section ────────────────────────────────────────────────
function GallerySection({ pkg }) {
  const [lightbox, setLightbox] = useState(null);
  const images = [];

  if (pkg.heroBg) images.push({ url: pkg.heroBg });
  (pkg.gallery || []).forEach(g => {
    if (!images.find(i => i.url === g.url)) images.push(g);
  });

  while (images.length < 5) images.push(null);
  const validImages = images.filter(Boolean);

  return (
    <>
      <div className="pv-gallery">
        {images.slice(0, 5).map((img, i) => (
          <div
            key={i}
            className={`pv-gallery-item ${i === 0 ? 'pv-gallery-main' : ''}`}
            onClick={() => img && setLightbox(i)}
          >
            {img ? (
              <>
                <img src={img.url} alt="" />
                <div className="pv-gallery-overlay">
                  {i === 0 && validImages.length > 5 && (
                    <div className="pv-gallery-more">+{validImages.length - 5} photos</div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#E5E7EB" }} />
            )}
          </div>
        ))}
      </div>

      {lightbox !== null && validImages.length > 0 && (
        <Lightbox images={validImages} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ─── Hotel Categories Preview (formules dynamiques) ────────────────
function hotelCategoryNights(category) {
  return (category.hotels || []).reduce((sum, h) => sum + (Number(h.nights) || 0), 0);
}

function HotelCategoriesPreview({ pkg, th }) {
  const categories = pkg.hotelCategories || [];
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const active = categories.find(c => c.id === activeId) || categories[0];

  if (!categories.length) return null;

  const totalNights = active ? hotelCategoryNights(active) : 0;

  return (
    <div className="pv-card">
      <h2 className="pv-card-title">Hébergements & Formules</h2>

      {categories.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${activeId === cat.id ? th.primary : th.border}`,
                background: activeId === cat.id ? th.primary : "#fff",
                color: activeId === cat.id ? "#fff" : th.textDark,
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 14, color: th.textMuted, fontWeight: 600 }}>
              {totalNights} Nuits / {totalNights + 1} Jours · {(active.hotels || []).length} hôtel(s)
            </div>
            {active.basePrice && (
              <div style={{ fontSize: 20, fontWeight: 700, color: th.primary }}>
                {active.basePrice} <span style={{ fontSize: 13, color: th.textMuted }}>{pkg.currency}</span>
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="pv-hotels-table">
              <thead>
                <tr>
                  {(active.tableHeaders || ["Hôtel", "Ville", "Nuits", "Étoiles"]).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(active.hotels || []).map(hotel => (
                  <tr key={hotel.id}>
                    <td style={{ fontWeight: 600 }}>{hotel.name}</td>
                    <td>{hotel.city}</td>
                    <td style={{ textAlign: "center" }}>{hotel.nights}</td>
                    <td className="pv-hotel-stars">{"★".repeat(hotel.stars)}</td>
                    {(hotel.cols || []).map((col, j) => (
                      <td key={j}>{col}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {active.note && (
            <p style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginTop: 12 }}>{active.note}</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Content ───────────────────────────────────────────────────
function TourContent({ pkg, th }) {
  const otherSections = (pkg.sections || []);

  return (
    <>
      {/* Overview */}
      <div className="pv-card">
        <h2 className="pv-card-title">Aperçu du voyage</h2>
        <p className="pv-text">{pkg.description || pkg.overview || "Découvrez une expérience unique et inoubliable."}</p>

        {pkg.highlights && pkg.highlights.length > 0 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 16 }}>Points forts</h3>
            <div className="pv-highlights">
              {pkg.highlights.map((h, i) => (
                <div key={i} className="pv-highlight">
                  <span className="pv-highlight-icon">✓</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Other Sections */}
      {otherSections.map(section => (
        <div key={section.id} className="pv-card">
          <h2 className="pv-card-title">{section.title}</h2>
          {section.items && section.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {section.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 15, color: "#4B5563", lineHeight: 1.7 }}>
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Includes / Excludes */}
      {/* {(inclus || exclus) && (
        <div className="pv-card">
          <h2 className="pv-card-title">Ce qui est inclus</h2>
          <div className="pv-includes-grid">
            {inclus && (
              <div className="pv-include-section">
                <h4 style={{ color: "#059669" }}>✓ Inclus</h4>
                <ul className="pv-include-list">
                  {(inclus.items || []).map((item, i) => (
                    <li key={i} className="pv-include-item">
                      <span className="pv-include-icon yes">✓</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclus && (
              <div className="pv-include-section">
                <h4 style={{ color: "#DC2626" }}>✗ Non inclus</h4>
                <ul className="pv-include-list">
                  {(exclus.items || []).map((item, i) => (
                    <li key={i} className="pv-include-item">
                      <span className="pv-include-icon no">✗</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Itinerary */}
      {/* {pkg.days && pkg.days.length > 0 && (
        <div className="pv-card">
          <h2 className="pv-card-title">{pkg.itineraryTitle || "Programme du voyage"}</h2>
          <div className="pv-itinerary">
            {pkg.days.map((day, idx) => (
              <ItineraryDay key={day.id} day={day} index={idx} th={th} defaultOpen={idx === 0} />
            ))}
          </div>
        </div>
      )} */}
      {/* Itinerary - TIMELINE */}
      {pkg.days && pkg.days.length > 0 && (
        <ItineraryTimeline pkg={pkg} th={th} />
      )}

      {/* Hotels & Formules */}
      {pkg.hotelCategories && pkg.hotelCategories.length > 0 && (
        <HotelCategoriesPreview pkg={pkg} th={th} />
      )}

      {/* Departure Dates */}
      {pkg.departureDates && pkg.departureDates.length > 0 && (
        <div className="pv-card">
          <h2 className="pv-card-title">Dates de départ</h2>
          <div className="pv-dates-grid">
            {pkg.departureDates.map(date => {
              const [day, month] = date.from.split("/").map(Number);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dep = new Date(today.getFullYear(), month - 1, day);
              if (dep < today) return null;

              return (
                <div key={date.id} className="pv-date-card">
                  <div className="pv-date-from">{date.from}</div>
                  <div className="pv-date-arrow">↓</div>
                  <div className="pv-date-to">{date.to}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Booking Sidebar ────────────────────────────────────────────────
function BookingSidebar({ pkg, onReserve }) {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [date, setDate] = useState("");

  const basePrice = parseFloat(pkg.basePrice) || 0;
  const totalPrice = (adults * basePrice) + (children * basePrice * 0.5);

  return (
    <div className="pv-sidebar">
      {/* Booking Card */}
      <div className="pv-booking-card">
        <div className="pv-booking-header">
          <div className="pv-booking-price-label">{pkg.priceFromLabel || "À partir de"}</div>
          <div className="pv-booking-price">
            <span className="pv-booking-amount">{pkg.basePrice}</span>
            <span className="pv-booking-currency">{pkg.currency || "€"}</span>
          </div>
        </div>

        <div className="pv-booking-body">
          <div className="pv-booking-form">
            <div className="pv-form-group">
              <label>Date de départ</label>
              <input
                type="date"
                className="pv-form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="pv-counter">
              <span className="pv-counter-label">Adultes</span>
              <div className="pv-counter-controls">
                <button
                  className="pv-counter-btn"
                  onClick={() => setAdults(a => Math.max(1, a - 1))}
                  disabled={adults <= 1}
                >
                  −
                </button>
                <span className="pv-counter-value">{adults}</span>
                <button
                  className="pv-counter-btn"
                  onClick={() => setAdults(a => a + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="pv-counter">
              <span className="pv-counter-label">Enfants</span>
              <div className="pv-counter-controls">
                <button
                  className="pv-counter-btn"
                  onClick={() => setChildren(c => Math.max(0, c - 1))}
                  disabled={children <= 0}
                >
                  −
                </button>
                <span className="pv-counter-value">{children}</span>
                <button
                  className="pv-counter-btn"
                  onClick={() => setChildren(c => c + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="pv-booking-total">
            <span className="pv-booking-total-label">Total</span>
            <span className="pv-booking-total-amount">
              {totalPrice.toFixed(0)} {pkg.currency || "€"}
            </span>
          </div>

          <button className="pv-btn-primary" onClick={onReserve}>
            <span>→</span> {pkg.ctaLabel || "Réserver maintenant"}
          </button>
          <p className="pv-booking-help">Confirmation instantanée • Annulation gratuite</p>
        </div>
      </div>

      {/* Contact Card */}
      <div className="pv-contact-card">
        <h3 className="pv-contact-title">Besoin d'aide ?</h3>
        {pkg.phone1 && (
          <div className="pv-contact-item">
            <div className="pv-contact-icon">📞</div>
            <div className="pv-contact-info">
              <div className="pv-contact-label">Téléphone</div>
              <div className="pv-contact-value">
                <a href={`tel:${pkg.phone1}`}>{pkg.phone1}</a>
              </div>
            </div>
          </div>
        )}
        {pkg.phone2 && (
          <div className="pv-contact-item">
            <div className="pv-contact-icon">📞</div>
            <div className="pv-contact-info">
              <div className="pv-contact-label">Téléphone 2</div>
              <div className="pv-contact-value">
                <a href={`tel:${pkg.phone2}`}>{pkg.phone2}</a>
              </div>
            </div>
          </div>
        )}
        {pkg.website && (
          <div className="pv-contact-item">
            <div className="pv-contact-icon">🌐</div>
            <div className="pv-contact-info">
              <div className="pv-contact-label">Site web</div>
              <div className="pv-contact-value">
                <a href={`https://${pkg.website}`} target="_blank" rel="noreferrer">{pkg.website}</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Preview Component ─────────────────────────────────────────
function PackagePreview({ pkg, th }) {
  const [showModal, setShowModal] = useState(false);
  const { trackClick } = useEvents();

  const handleReserve = () => {
    setShowModal(true);
    trackClick({ action: "openReservation", label: "Ouvrir modal reservation", targetId: pkg.$id, page: "packages/view" });
  };

  const cssVars = {
    "--pv-primary": th.primary,
    "--pv-primaryLight": th.primaryLight,
    "--pv-secondary": th.secondary,
    "--pv-accent": th.accent,
  };

  const totalHotels = (pkg.hotelCategories || []).reduce((sum, c) => sum + (c.hotels?.length || 0), 0);

  return (
    <div style={cssVars}>
      {/* Gallery */}
      <GallerySection pkg={pkg} />

      {/* Breadcrumb */}
      <div className="pv-breadcrumb">
        <a href="/">Accueil</a>
        <span className="pv-breadcrumb-sep">›</span>
        <a href="/packages">Voyages</a>
        <span className="pv-breadcrumb-sep">›</span>
        <span className="pv-breadcrumb-current">{pkg.destination}{pkg.destinationAccent}</span>
      </div>

      {/* Main Container */}
      <div className="pv-container">
        {/* Header */}
        <div className="pv-header">
          <div className="pv-header-top">
            <div>
              <h1 className="pv-title">
                {pkg.destination}
                <span style={{ color: th.primary }}>{pkg.destinationAccent}</span>
              </h1>
              <div className="pv-meta">
                {pkg.durationLabel && (
                  <div className="pv-meta-item">
                    <span className="pv-meta-icon">⏱️</span>
                    <span>{pkg.durationLabel}</span>
                  </div>
                )}
                {pkg.periodLabel && (
                  <div className="pv-meta-item">
                    <span className="pv-meta-icon">📅</span>
                    <span>{pkg.periodLabel}</span>
                  </div>
                )}
                <div className="pv-meta-item">
                  <span className="pv-meta-icon">⭐</span>
                  <span>4.8 (124 avis)</span>
                </div>
              </div>
            </div>
            <div className="pv-actions">
              <button className="pv-btn-icon" title="Partager">↗</button>
              <button className="pv-btn-icon" title="Favoris">♡</button>
            </div>
          </div>

          {/* Info Badges */}
          <div className="pv-badges">
            {pkg.destination && (
              <div className="pv-badge">
                <div className="pv-badge-icon">📍</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Destination</div>
                  <div className="pv-badge-value">{pkg.destination}</div>
                </div>
              </div>
            )}
            {pkg.durationLabel && (
              <div className="pv-badge">
                <div className="pv-badge-icon">⏱️</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Durée</div>
                  <div className="pv-badge-value">{pkg.durationLabel}</div>
                </div>
              </div>
            )}
            {pkg.days && (
              <div className="pv-badge">
                <div className="pv-badge-icon">📋</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Programme</div>
                  <div className="pv-badge-value">{pkg.days.length} jours</div>
                </div>
              </div>
            )}
            {pkg.hotelCategories?.length > 0 && (
              <div className="pv-badge">
                <div className="pv-badge-icon">🏨</div>
                <div className="pv-badge-content">
                  <div className="pv-badge-label">Formules</div>
                  <div className="pv-badge-value">{pkg.hotelCategories.length} formule(s) · {totalHotels} hôtel(s)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="pv-layout">
          {/* Left Column - Content */}
          <div>
            <TourContent pkg={pkg} th={th} />
          </div>

          {/* Right Column - Sidebar */}
          <BookingSidebar pkg={pkg} th={th} onReserve={handleReserve} />
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div className="pv-mobile-cta">
        <div className="pv-mobile-price">
          <div className="pv-mobile-price-label">{pkg.priceFromLabel || "À partir de"}</div>
          <div className="pv-mobile-price-amount">
            {pkg.basePrice} {pkg.currency || "€"}
          </div>
        </div>
        <button className="pv-mobile-btn" onClick={handleReserve}>
          Réserver
        </button>
      </div>

      {/* Reservation Modal */}
      {showModal && (
        <ReservationProvider>
          <ReservationModal pkg={pkg} onClose={() => setShowModal(false)} />
        </ReservationProvider>
      )}
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="pv-loading">
      <div className="pv-spinner" />
      <span>Chargement du package...</span>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div className="pv-error">
      <div className="pv-error-icon">⚠️</div>
      <h2 className="pv-error-title">Erreur de chargement</h2>
      <p className="pv-error-message">{message}</p>
      <button className="pv-error-btn" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}

// ─── Not Found State ────────────────────────────────────────────────
function PackageNotFound() {
  return (
    <div className="pv-notfound">
      <div className="pv-notfound-content">
        <div className="pv-notfound-icon">🔍</div>
        <h2 className="pv-notfound-title">Package introuvable</h2>
        <p className="pv-notfound-text">
          Ce voyage n'existe plus ou n'est plus disponible. Veuillez vérifier l'URL ou retourner à la page d'accueil.
        </p>
        <button className="pv-notfound-btn" onClick={() => window.history.back()}>
          ← Retour
        </button>
      </div>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────
export default function PackageViewerPage() {
  const [searchParams] = useSearchParams();
  const pkgId = searchParams.get("pkgId");
  const { user } = useAuth();
  const { trackPackageView, setUserId } = useEvents();
  const { selectedPkg, loading, error, fetchById } = usePackages();


  useEffect(() => {
    if (pkgId) fetchById(pkgId);
  }, [pkgId, fetchById]);

  useEffect(() => {
    if (!selectedPkg) return;
    setUserId(user.$id);
    trackPackageView({ targetId: pkgId, label: selectedPkg.title, page: window.location.pathname });
  }, [selectedPkg?.$id, user, pkgId, setUserId, trackPackageView]);

  const pkg = { ...(selectedPkg?.data ?? selectedPkg), id: pkgId };

  if (loading) return <div className="pv-root"><LoadingState /></div>;
  if (!selectedPkg) return <div className="pv-root"><PackageNotFound /></div>;
  if (error) return <div className="pv-root"><ErrorState message={error} onRetry={() => fetchById(pkgId)} /></div>;
  if (!pkg) return null;

  const th = getTheme(pkg);

  return (
    <div className="pv-root">
      <PackagePreview pkg={pkg} th={th} />
    </div>
  );
}