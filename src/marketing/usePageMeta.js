import { useEffect } from "react";

const SITE_TITLE = "Follow Me Travel";
const DEFAULT_TITLE = "Follow me travel agence de voyages au Maroc.";

function setMeta(selector, attr, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/**
 * Sets document.title (and og:title/description) for the current page.
 * This is a plain SPA — there's no server-side render, so a link shared
 * before a crawler ever executes JS still falls back to index.html's
 * static tags. This only helps once the page has actually loaded: browser
 * tabs/history, and re-shares/refreshes after that point.
 *
 * `title` is used as-is if it already contains "Follow Me Travel",
 * otherwise " — Follow Me Travel" is appended so every tab keeps the brand.
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    const full = title ? (title.includes(SITE_TITLE) ? title : `${title} — ${SITE_TITLE}`) : DEFAULT_TITLE;
    document.title = full;
    setMeta('meta[property="og:title"]', "content", full);
    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
    }
    // Intentionally no cleanup: the next page to mount sets its own title,
    // and resetting to DEFAULT_TITLE on unmount would just flash it
    // between routes during the transition.
  }, [title, description]);
}
