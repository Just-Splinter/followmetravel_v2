import { useEffect } from "react";
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, DEFAULT_TITLE, SITE_NAME, absoluteUrl } from "./seo";

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data) {
  document.head.querySelectorAll("script[data-ld]").forEach((s) => s.remove());
  for (const item of data ? (Array.isArray(data) ? data : [data]) : []) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.dataset.ld = "page";
    s.textContent = JSON.stringify(item);
    document.head.appendChild(s);
  }
}

/**
 * Balises SEO de la page courante : titre, description, URL canonique,
 * Open Graph / Twitter, robots et données structurées (JSON-LD).
 *
 * Le pré-rendu au build (scripts/prerender.mjs) écrit les mêmes balises dans
 * le HTML statique de chaque page publique ; ce hook les tient à jour une fois
 * l'application chargée (navigation interne, langue, pages non pré-rendues).
 *
 * `title` est complété par « — Follow Me Travel » s'il ne contient pas déjà la marque.
 * Options : `path` (canonique, défaut : chemin courant sans paramètres),
 * `image`, `jsonLd` (objet ou tableau), `noindex`.
 */
export function usePageMeta(title, description, { path, image, jsonLd, noindex = false } = {}) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    const full = title ? (title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`) : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = absoluteUrl(path || window.location.pathname);
    const img = absoluteUrl(image || DEFAULT_IMAGE);
    document.title = full;
    setMeta("name", "description", desc);
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
    setCanonical(url);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", img);
    setMeta("name", "twitter:title", full);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
    setJsonLd(ld ? JSON.parse(ld) : null);
    // Pas de nettoyage : la page suivante pose ses propres balises (un retour
    // aux valeurs par défaut au démontage les ferait clignoter entre deux routes).
  }, [title, description, path, image, ld, noindex]);
}
