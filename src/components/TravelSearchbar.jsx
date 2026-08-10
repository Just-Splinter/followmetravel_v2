import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Calendar, Users, Search, Minus, Plus, X } from "lucide-react";
import { useTravelData } from "../context/TravelDataContext";



// ─── Main Component ─────────────────────────────────────────────────────
export function TravelSearchBar() {
  const navigate = useNavigate();
  const { destinations } = useTravelData();
  const containerRef = useRef(null);

  const [openPanel, setOpenPanel] = useState(null);
  const [destinationId, setDestinationId] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [date, setDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedDestination = (destinations || []).find((d) => d.$id === destinationId);

  const filteredDestinations = (destinations || []).filter((d) =>
    (d.name || d.nom || "").toLowerCase().includes(destinationQuery.toLowerCase())
  );

  const travelersLabel = () => {
    const parts = [`${adults} Adulte${adults > 1 ? "s" : ""}`];
    if (children > 0) parts.push(`${children} Enfant${children > 1 ? "s" : ""}`);
    return parts.join(", ");
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (destinationId) params.set("dest", destinationId);
    if (date) params.set("date", date);
    if (adults) params.set("adults", String(adults));
    if (children) params.set("children", String(children));

    navigate(`/search${params.toString() ? `?${params.toString()}` : ""}`);
    setOpenPanel(null);
  };

  const togglePanel = (panel) => {
    setOpenPanel((p) => (p === panel ? null : panel));
  };

  return (
    <div ref={containerRef} className="tsb-container">
      <div className="tsb-bar">
        {/* Destination */}
        <div style={{ position: "relative", flex: 1 }}>
          <div
            className={`tsb-item ${openPanel === "destination" ? "active" : ""}`}
            onClick={() => togglePanel("destination")}
          >
            <div className="tsb-item-icon">
              <MapPin size={18} color="rgb(255, 117, 14)" />
            </div>
            <div className="tsb-item-content">
              <div className="tsb-item-title">Destination</div>
              <div className={`tsb-item-value ${!selectedDestination ? "placeholder" : ""}`}>
                {selectedDestination ? (selectedDestination.name || selectedDestination.nom) : "Où souhaitez-vous partir ?"}
              </div>
            </div>
          </div>

          {openPanel === "destination" && (
            <div className="tsb-popover" style={{ width: 340 }}>
              <input
                autoFocus
                className="tsb-popover-input"
                placeholder="Rechercher une destination…"
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
              />
              <div className="tsb-popover-list">
                {destinationId && (
                  <button
                    className="tsb-clear-btn"
                    onClick={() => {
                      setDestinationId("");
                      setDestinationQuery("");
                    }}
                  >
                    <X size={14} /> Effacer la sélection
                  </button>
                )}
                {filteredDestinations.length === 0 && (
                  <div className="tsb-empty-state">Aucune destination trouvée</div>
                )}
                {filteredDestinations.map((d) => (
                  <button
                    key={d.$id}
                    className={`tsb-dest-item ${d.$id === destinationId ? "selected" : ""}`}
                    onClick={() => {
                      setDestinationId(d.$id);
                      setOpenPanel(null);
                    }}
                  >
                    <MapPin size={15} color="rgb(255, 117, 14)" />
                    {d.name || d.nom}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="tsb-divider" />

        {/* Date */}
        <div style={{ position: "relative", flex: 1 }}>
          <div
            className={`tsb-item ${openPanel === "date" ? "active" : ""}`}
            onClick={() => togglePanel("date")}
          >
            <div className="tsb-item-icon">
              <Calendar size={18} color="rgb(255, 117, 14)" />
            </div>
            <div className="tsb-item-content">
              <div className="tsb-item-title">Départ</div>
              <div className={`tsb-item-value ${!date ? "placeholder" : ""}`}>
                {date
                  ? new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                  : "Choisir une date"}
              </div>
            </div>
          </div>

          {openPanel === "date" && (
            <div className="tsb-popover" style={{ width: 260 }}>
              <input
                type="date"
                autoFocus
                className="tsb-date-input"
                value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDate(e.target.value)}
              />
              {date && (
                <button
                  className="tsb-clear-btn"
                  style={{ marginTop: 8, marginBottom: 0 }}
                  onClick={() => setDate("")}
                >
                  <X size={14} /> Effacer la date
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tsb-divider" />

        {/* Travelers */}
        <div style={{ position: "relative", flex: 1 }}>
          <div
            className={`tsb-item ${openPanel === "travelers" ? "active" : ""}`}
            onClick={() => togglePanel("travelers")}
          >
            <div className="tsb-item-icon">
              <Users size={18} color="rgb(255, 117, 14)" />
            </div>
            <div className="tsb-item-content">
              <div className="tsb-item-title">Voyageurs</div>
              <div className="tsb-item-value">{travelersLabel()}</div>
            </div>
          </div>

          {openPanel === "travelers" && (
            <div className="tsb-popover" style={{ width: 280 }}>
              <TravelerRow
                label="Adultes"
                sublabel="13 ans et plus"
                count={adults}
                min={1}
                onDecrement={() => setAdults((a) => Math.max(1, a - 1))}
                onIncrement={() => setAdults((a) => a + 1)}
              />
              <TravelerRow
                label="Enfants"
                sublabel="2 à 12 ans"
                count={children}
                min={0}
                onDecrement={() => setChildren((c) => Math.max(0, c - 1))}
                onIncrement={() => setChildren((c) => c + 1)}
              />
            </div>
          )}
        </div>

        {/* Search Button */}
        <button className="tsb-search-btn" onClick={handleSearch} aria-label="Rechercher">
          <Search size={24} />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────
function TravelerRow({ label, sublabel, count, min, onDecrement, onIncrement }) {
  return (
    <div className="tsb-traveler-row">
      <div>
        <div className="tsb-traveler-label">{label}</div>
        <div className="tsb-traveler-sublabel">{sublabel}</div>
      </div>
      <div className="tsb-counter">
        <button
          className="tsb-counter-btn"
          onClick={onDecrement}
          disabled={count <= min}
          aria-label={`Diminuer ${label}`}
        >
          <Minus size={14} />
        </button>
        <span className="tsb-counter-value">{count}</span>
        <button
          className="tsb-counter-btn"
          onClick={onIncrement}
          aria-label={`Augmenter ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}