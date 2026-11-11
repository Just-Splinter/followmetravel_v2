import { useState, useRef, useMemo } from "react";
import { CheckCircle2, Hotel } from "lucide-react";
import { useHotels, parseHotelRoomTypes } from "../context/HotelsContext";
import { useClickOutside } from "./ClickOutSide";
import "./HotelPicker.css";

/**
 * Choix d'un hôtel du catalogue partagé (page Hôtels). À l'ouverture, tout
 * le catalogue est proposé ; la liste ne se filtre qu'une fois qu'on tape.
 * Un nom tapé sans correspondance reste accepté (texte libre), mais sans lien
 * au catalogue — donc sans suivi de stock ni tarifs par défaut.
 */
export default function HotelPicker({ value, linked = false, onSelect, placeholder = "Choisir un hôtel du catalogue…", theme = "light", inputClassName, className = "", style }) {
  const { hotels, loading } = useHotels();
  const [open, setOpen] = useState(false);
  // null : rien tapé depuis l'ouverture → tout le catalogue.
  const [query, setQuery] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const matches = useMemo(() => {
    const q = String(query ?? "").trim().toLowerCase();
    const list = !q
      ? hotels
      : hotels.filter((h) => h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q));
    return [...list].sort((a, b) => String(a.city).localeCompare(String(b.city)) || String(a.name).localeCompare(String(b.name)));
  }, [hotels, query]);

  const pick = (h) => {
    onSelect({ name: h.name, city: h.city, stars: h.stars, id: h.$id, roomTypes: parseHotelRoomTypes(h.rooms) });
    setOpen(false);
    setQuery(null);
  };

  return (
    <div ref={ref} className={`hp-wrap ${theme === "dark" ? "hp-wrap--dark" : ""} ${className}`} style={style}>
      <input
        value={value || ""}
        placeholder={placeholder}
        // id: null — typing invalidates any previously picked catalog link;
        // keeping a stale id here would attribute this row's rooms to the
        // wrong hotel once availability is computed from it.
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onSelect({ name: e.target.value, id: null });
        }}
        onFocus={() => {
          setQuery(null);
          setOpen(true);
        }}
        className={`hp-field ${inputClassName || "hp-input"}`}
        title={linked ? "Hôtel du catalogue" : value ? "Texte libre : non relié au catalogue" : undefined}
      />
      {linked && <CheckCircle2 size={14} className="hp-linked" aria-label="Relié au catalogue" />}
      {open && !loading && (
        <div className="hp-pop">
          {hotels.length === 0 ? (
            <div className="hp-empty">
              Le catalogue d'hôtels est vide. <a href="/dashboard/hotel" target="_blank" rel="noreferrer">Ajouter des hôtels</a>
            </div>
          ) : matches.length === 0 ? (
            <div className="hp-empty">
              Aucun hôtel « {query} » dans le catalogue — gardé en texte libre (sans suivi de stock).{" "}
              <a href="/dashboard/hotel" target="_blank" rel="noreferrer">Ajouter au catalogue</a>
            </div>
          ) : (
            matches.map((h) => (
              <button key={h.$id} type="button" className="hp-item" onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
                <Hotel size={13} />
                <span className="hp-item-name">{h.name}</span>
                {(h.city || h.stars) && (
                  <em className="hp-item-meta">{[h.city, h.stars ? `${h.stars}★` : null].filter(Boolean).join(" · ")}</em>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
