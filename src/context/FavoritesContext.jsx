import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getPrefs, updatePrefs } from "../services/appwrite";
import { useAuth } from "./AuthContext";
import { useEvents } from "./EventsContext";

const FavoritesContext = createContext(null);

/** Add/remove `id` from `ids`, pure so it's testable without a provider. */
export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const { trackFavorite } = useEvents();
  const [ids, setIds] = useState([]);
  const [loading, setLoading] = useState(false);
  // Full prefs blob, not just favorites — account.updatePrefs() replaces the
  // whole object, so writing just {favorites} would wipe any other pref key.
  const rawPrefsRef = useRef({});

  useEffect(() => {
    if (!user) {
      setIds([]);
      rawPrefsRef.current = {};
      return;
    }
    let alive = true;
    setLoading(true);
    getPrefs()
      .then((prefs) => {
        if (!alive) return;
        rawPrefsRef.current = prefs || {};
        setIds(Array.isArray(prefs?.favorites) ? prefs.favorites : []);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  const isFavorite = useCallback((id) => ids.includes(id), [ids]);

  /** Throws "AUTH_REQUIRED" when logged out — callers decide how to prompt login. */
  const toggleFavorite = useCallback(
    async ({ id, label }) => {
      if (!user) throw new Error("AUTH_REQUIRED");
      const previous = ids;
      const next = toggleId(ids, id);
      const added = next.includes(id);
      setIds(next); // optimistic — reverted below on failure
      try {
        const merged = { ...rawPrefsRef.current, favorites: next };
        await updatePrefs(merged);
        rawPrefsRef.current = merged;
        trackFavorite({ targetId: id, label, action: added ? "add" : "remove" });
        return added;
      } catch (err) {
        setIds(previous);
        throw err;
      }
    },
    [ids, user, trackFavorite]
  );

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite, toggleFavorite, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
