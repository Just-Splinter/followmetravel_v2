import { useState, useRef, useMemo } from "react";
import { Hotel } from "lucide-react";
import { useHotels, parseHotelRoomTypes } from "../context/HotelsContext";
import { useClickOutside } from "./ClickOutSide";
import "./HotelPicker.css";

/**
 * Autocomplete over the shared hotel catalog (useHotels). Still plain text
 * underneath — typing a name with no catalog match is accepted as-is — this
 * only makes picking an existing hotel faster and fills city/stars for you.
 */
export default function HotelPicker({ value, onSelect, placeholder = "Nom de l'hôtel", theme = "light", inputClassName, className = "", style }) {
  const { hotels, loading } = useHotels();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const matches = useMemo(() => {
    const q = String(value || "").trim().toLowerCase();
    const list = !q
      ? hotels
      : hotels.filter(
          (h) => h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q)
        );
    return list.slice(0, 8);
  }, [hotels, value]);

  const pick = (h) => {
    onSelect({ name: h.name, city: h.city, stars: h.stars, id: h.$id, roomTypes: parseHotelRoomTypes(h.rooms) });
    setOpen(false);
  };

  return (
    <div ref={ref} className={`hp-wrap ${theme === "dark" ? "hp-wrap--dark" : ""} ${className}`} style={style}>
      <input
        value={value || ""}
        placeholder={placeholder}
        // id: null — typing invalidates any previously picked catalog link;
        // keeping a stale id here would attribute this row's rooms to the
        // wrong hotel once availability is computed from it.
        onChange={(e) => onSelect({ name: e.target.value, id: null })}
        onFocus={() => setOpen(true)}
        className={`hp-field ${inputClassName || "hp-input"}`}
      />
      {open && !loading && matches.length > 0 && (
        <div className="hp-pop">
          {matches.map((h) => (
            <button key={h.$id} type="button" className="hp-item" onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
              <Hotel size={13} />
              <span className="hp-item-name">{h.name}</span>
              {(h.city || h.stars) && (
                <em className="hp-item-meta">{[h.city, h.stars ? `${h.stars}★` : null].filter(Boolean).join(" · ")}</em>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
