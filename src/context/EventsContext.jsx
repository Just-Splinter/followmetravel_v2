import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
} from "react";

import { ID } from "../services/database";
import { API_URL } from "../services/api";
import { contactKind, detectAcquisition } from "../services/acquisition";

// Analytics events are written by every visitor, including anonymous ones;
// read is staff-only (api/src/collections/policies.ts), so no visitor can
// scrape another session's tracked pages/clicks via a direct API call.
// The dashboard's business view (api/src/analytics) excludes staff traffic.

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
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  if (/Mobi|Android/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Provenance figée au premier événement de la session (premier contact) :
 * une navigation interne ne doit pas la transformer en « direct ».
 */
function getAcquisition() {
  const key = "mta_acquisition";
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    /* sessionStorage indisponible : on recalcule */
  }
  const acq = {
    ...detectAcquisition(window.location.search, document.referrer, window.location.host),
    referrer: document.referrer ? document.referrer.slice(0, 300) : "",
    landing: window.location.pathname,
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(acq));
  } catch {
    /* ignore */
  }
  return acq;
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Envoi groupé ; `keepalive` laisse partir la requête même si l'onglet se ferme. */
function sendBatch(events) {
  return fetch(`${API_URL}/v1/events/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Fmt-Client": "web" },
    body: JSON.stringify({ events }),
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function EventsProvider({ children }) {
  const queue     = useRef([]);           // file d'attente en mémoire
  const timerRef  = useRef(null);         // référence au setInterval
  const sessionId = useRef(getSessionId());
  const device    = useRef(detectDevice());
  const acquisition = useRef(getAcquisition());
  const timeZone  = useRef(getTimeZone());

  // ── Flush : un seul appel API pour tout le lot ───────────────────────────

  const flush = useCallback(() => {
    // Lots de BATCH_SIZE au plus (limite de l'API).
    while (queue.current.length > 0) {
      sendBatch(queue.current.splice(0, BATCH_SIZE));
    }
  }, []);

  const userIdRef = useRef(null);

  const setUserId = useCallback((id) => {
    userIdRef.current = id;
  }, []);

  // ── Démarre le timer de flush périodique ─────────────────────────────────

  useEffect(() => {
    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    // Flush final quand l'onglet passe en arrière-plan ou se ferme
    // (pagehide : seul événement fiable sur mobile / Safari).
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
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
        // Fuseau du navigateur : distingue le Maroc de la clientèle MRE.
        tz:        timeZone.current,
        country:   timeZone.current === "Africa/Casablanca" ? "MA" : null,
        lang:      document.documentElement.lang || navigator.language || "",
        ...acquisition.current,
        createdAt: new Date().toISOString(),
      };

      queue.current.push(payload);

      // Flush anticipé si la queue est pleine
      if (queue.current.length >= BATCH_SIZE) flush();
    },
    [userIdRef, flush]
  );

  // ── Contacts : tout lien téléphone / email / WhatsApp du site, sans avoir
  //    à instrumenter chaque bouton (data-track-label précise le contexte).
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a || window.location.pathname.startsWith("/dashboard")) return;
      const kind = contactKind(a.getAttribute("href"));
      if (!kind) return;
      track({
        event: "contact",
        category: "contact",
        action: kind,
        label: a.dataset.trackLabel || a.textContent?.trim().slice(0, 80) || kind,
        targetId: a.dataset.trackTarget || null,
      });
      // Le visiteur quitte souvent la page (appli téléphone / WhatsApp) : on envoie tout de suite.
      flush();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [track, flush]);

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

  /** Recherche effectuée (results : nombre de voyages trouvés, si connu) */
  const trackSearch = useCallback(
    ({ label, action = "destination", results }) =>
      track({ event: "search", category: "search", action, label, data: results === undefined ? {} : { results } }),
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

  /** Ouverture du formulaire de réservation */
  const trackReserve = useCallback(
    ({ targetId, label, page }) =>
      track({ event: "click", category: "package", action: "reserve", targetId, label, page }),
    [track]
  );

  /**
   * Étape du formulaire de réservation : "travelers" (passage à la saisie des
   * voyageurs), "submit" (envoi), "success", "error" (avec message).
   */
  const trackBookingStep = useCallback(
    ({ targetId, label, step, data }) =>
      track({ event: "booking_step", category: "funnel", action: step, targetId, label, data }),
    [track]
  );

  /** Abandon (appeler dans un useEffect cleanup ou sur unmount du formulaire) */
  const trackAbandon = useCallback(
    ({ targetId, label, page }) =>
      track({ event: "abandon", category: "funnel", action: "checkout", targetId, label, page }),
    [track]
  );

  /** Demande de réservation envoyée (pas un paiement : aucun paiement en ligne). */
  const trackPayment = useCallback(
    ({ targetId, label, data }) =>
      track({ event: "payment", category: "funnel", action: "complete", targetId, label, data }),
    [track]
  );

  /** Prospect : formulaire de contact, newsletter, demande de devis. */
  const trackLead = useCallback(
    ({ action, label }) => {
      track({ event: "lead", category: "lead", action, label });
      flush();
    },
    [track, flush]
  );

  /** Connexion / inscription réussie (method : email, google). */
  const trackAuth = useCallback(
    ({ action = "login", method }) => track({ event: "auth", category: "account", action, label: method }),
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
    trackBookingStep,
    trackAbandon,
    trackPayment,
    trackLead,
    trackAuth,
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
