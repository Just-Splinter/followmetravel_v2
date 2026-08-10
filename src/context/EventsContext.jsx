import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
} from "react";

import db, { Collections, ID } from "../services/database";

// ─── Constants ───────────────────────────────────────────────────────────────

const BATCH_INTERVAL_MS = 5000; // flush toutes les 5 secondes
const BATCH_SIZE        = 50;   // ou dès que la queue atteint 50 events

// ─── Context ─────────────────────────────────────────────────────────────────

const EventsContext = createContext(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Génère un sessionId stable pour toute la durée de la session navigateur */
function getSessionId() {
  const key = "mta_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = ID.unique();
    sessionStorage.setItem(key, id);
  }
  return id;
}

/** Détecte grossièrement le type d'appareil */
function detectDevice() {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function EventsProvider({ children }) {
  const queue     = useRef([]);           // file d'attente en mémoire
  const timerRef  = useRef(null);         // référence au setInterval
  const sessionId = useRef(getSessionId());
  const device    = useRef(detectDevice());

  // ── Flush : envoie le contenu de la queue vers Appwrite ──────────────────

  const flush = useCallback(async () => {
    if (queue.current.length === 0) return;

    // Prend tout ce qui est en queue et vide immédiatement
    const batch = queue.current.splice(0, queue.current.length);

    // Envoie chaque event (Appwrite n'a pas de bulk-insert natif,
    // on parallélise avec Promise.allSettled pour ne jamais bloquer)
    await Promise.allSettled(
      batch.map((event) =>
        db.create(Collections.EVENTS, event, ID.unique())
      )
    );
  }, []);

  const userIdRef = useRef(null);

  const setUserId = useCallback((id) => {
    userIdRef.current = id;
  }, []);

  // ── Démarre le timer de flush périodique ─────────────────────────────────

  useEffect(() => {
    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    // Flush final quand l'onglet se ferme / change de page
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush(); // dernier flush au démontage
    };
  }, [flush]);

  // ── track : méthode principale ───────────────────────────────────────────

  const track = useCallback(
    ({
      event    = "click",
      category = null,
      action   = null,
      label    = null,
      targetId = null,
      page     = window.location.pathname,
      data     = {},
    }) => {
      const payload = {
        userId: userIdRef.current,
        sessionId: sessionId.current,
        event,
        category,
        action,
        label,
        targetId,
        page,
        data:      JSON.stringify(data),
        device:    device.current,
        country:   "MA",                // à remplacer par géoloc si besoin
        createdAt: new Date().toISOString(),
      };

      queue.current.push(payload);

      // Flush anticipé si la queue est pleine
      if (queue.current.length >= BATCH_SIZE) flush();
    },
    [userIdRef, flush]
  );

  // ── Raccourcis sémantiques ────────────────────────────────────────────────

  /** Suivi automatique de page_view — à appeler dans un useEffect([location]) */
  const trackPageView = useCallback(
    (page = window.location.pathname) =>
      track({ event: "page_view", page }),
    [track]
  );

  /** Clic sur un bouton / CTA */
  const trackClick = useCallback(
    ({ category = "cta", action, label, targetId, page }) =>
      track({ event: "click", category, action, label, targetId, page }),
    [track]
  );

  /** Recherche effectuée */
  const trackSearch = useCallback(
    ({ label, action = "destination" }) =>
      track({ event: "search", category: "search", action, label }),
    [track]
  );

  /** Vue d'un package */
  const trackPackageView = useCallback(
    ({ targetId, label, page }) =>
      track({ event: "view", category: "package", action: "view", targetId, label, page }),
    [track]
  );

  /** Ajout aux favoris */
  const trackFavorite = useCallback(
    ({ targetId, label, action = "add" }) =>
      track({ event: "favorite", category: "package", action, targetId, label }),
    [track]
  );

  /** Début de réservation */
  const trackReserve = useCallback(
    ({ targetId, label, page }) =>
      track({ event: "click", category: "package", action: "reserve", targetId, label, page }),
    [track]
  );

  /** Abandon (appeler dans un useEffect cleanup ou sur unmount du formulaire) */
  const trackAbandon = useCallback(
    ({ targetId, label, page }) =>
      track({ event: "abandon", category: "funnel", action: "checkout", targetId, label, page }),
    [track]
  );

  /** Paiement complété */
  const trackPayment = useCallback(
    ({ targetId, label, data }) =>
      track({ event: "payment", category: "funnel", action: "complete", targetId, label, data }),
    [track]
  );

  // ─────────────────────────────────────────────────────────────────────────

  const value = {
    track,
    trackPageView,
    trackClick,
    trackSearch,
    trackPackageView,
    trackFavorite,
    trackReserve,
    trackAbandon,
    trackPayment,
    setUserId,
    flush, // exposé si besoin de flush manuel
  };

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEvents must be used inside EventsProvider");
  return ctx;
}