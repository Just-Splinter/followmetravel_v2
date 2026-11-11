// SEO du site public : URLs canoniques des fiches voyage, titres et
// descriptions par défaut, données structurées schema.org (JSON-LD).
// Module sans dépendance navigateur : utilisé par le site (usePageMeta) et
// par le pré-rendu au build (scripts/prerender.mjs, sous Node).

// Sous Node (pré-rendu), la valeur vient de process.env (chargée depuis .env par le script).
export const SITE_URL = (import.meta.env?.VITE_SITE_URL || globalThis.process?.env?.VITE_SITE_URL || "https://www.followmetravel.ma").replace(/\/$/, "");
export const SITE_NAME = "Follow Me Travel";
export const DEFAULT_TITLE = "Follow Me Travel — Agence de voyages au Maroc : circuits, séjours et Omra";
export const DEFAULT_DESCRIPTION =
  "Agence de voyages marocaine : circuits organisés au départ de Casablanca, séjours, Omra et voyages sur mesure. Dates fixes, prix détaillés, règlement en plusieurs fois.";
export const DEFAULT_IMAGE = "/hero/indonesia.jpg";

export const absoluteUrl = (pathOrUrl) => (/^https?:\/\//.test(pathOrUrl || "") ? pathOrUrl : `${SITE_URL}${pathOrUrl || "/"}`);

/** « Grand Tour de Thaïlande » → « grand-tour-de-thailande ». */
export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents : marques combinantes après NFD
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** URL canonique d'une fiche voyage : /voyages/<id>/<titre-en-slug>. */
export function packagePath(id, title) {
  const slug = slugify(title);
  return `/voyages/${encodeURIComponent(id)}${slug ? `/${slug}` : ""}`;
}

/** Lien vers une fiche voyage, avec le contexte de réservation (date, voyageurs). */
export function packageHref(id, title, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const q = qs.toString();
  return `${packagePath(id, title)}${q ? `?${q}` : ""}`;
}

/** Texte brut, une ligne, coupé proprement pour une meta description (~155 caractères). */
export function metaText(text, max = 155) {
  const clean = String(text || "").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

const parse = (raw) => {
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) || {};
  } catch {
    return {};
  }
};

/** Champs utiles au SEO d'un document `products` (package). */
export function packageSeo(doc) {
  const d = parse(doc.data);
  const title = doc.title || d.destination || "Voyage";
  const days = Array.isArray(d.days) ? d.days.filter((x) => x?.title) : [];
  const included = (d.sections || []).flatMap((s) => (/compren|inclu/i.test(s.title || "") ? s.items || [] : [])).map((i) => i.text).filter(Boolean);
  const price = Number(doc.basePrice) || Number(d.basePrice) || 0;
  const lead = d.tagline || d.subtitleItalic || "";
  // Phrases entières tant qu'elles tiennent (~155 caractères), dans l'ordre d'importance.
  const sentences = [
    lead,
    [d.durationLabel, doc.country].filter(Boolean).join(", "),
    price > 0 ? `À partir de ${price.toLocaleString("fr-FR").replace(/\u202f/g, " ")} DH par personne` : "",
    days.length > 1 ? `Étapes : ${days.slice(1, 4).map((x) => x.title).join(", ")}` : "",
  ].filter(Boolean);
  let description = "";
  for (const part of sentences) {
    const next = description ? `${description}. ${part}` : part;
    if (next.length > 155 && description) break;
    description = next;
  }
  description = metaText(`${description}.`);
  return {
    id: doc.$id,
    title,
    path: packagePath(doc.$id, title),
    description,
    lead,
    image: d.heroBg || (d.gallery || [])[0]?.url || "",
    images: [d.heroBg, ...(d.gallery || []).map((g) => g?.url)].filter(Boolean).slice(0, 6),
    price,
    country: doc.country || d.country || "",
    duration: d.durationLabel || "",
    days,
    included,
    updatedAt: doc.$updatedAt || doc.$createdAt || "",
  };
}

const ORG_ID = `${SITE_URL}/#agence`;

/** L'agence (TravelAgency) — page d'accueil et contact. */
export function agencyJsonLd(agency = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": ORG_ID,
    name: agency.tradeName || SITE_NAME,
    ...(agency.legalName ? { legalName: agency.legalName } : {}),
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/logo.png`,
    image: absoluteUrl(DEFAULT_IMAGE),
    ...(agency.phones?.[0] ? { telephone: agency.phones[0] } : {}),
    ...(agency.email ? { email: agency.email } : {}),
    address: {
      "@type": "PostalAddress",
      ...(agency.address ? { streetAddress: agency.address } : {}),
      addressLocality: agency.city || "Casablanca",
      addressCountry: "MA",
    },
    areaServed: "MA",
    currenciesAccepted: "MAD",
    ...(agency.googleReviewsUrl ? { sameAs: [agency.googleReviewsUrl] } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#site`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: ["fr", "en", "ar"],
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absoluteUrl(path) })),
  };
}

/**
 * Fiche voyage : TouristTrip (programme jour par jour) + Product (offres par
 * date de départ, prix en MAD, disponibilité) pour les résultats enrichis.
 */
export function packageJsonLd(seo, departures = []) {
  const url = absoluteUrl(seo.path);
  const offers = departures
    .filter((d) => d.price > 0)
    .map((d) => ({
      "@type": "Offer",
      price: d.price,
      priceCurrency: "MAD",
      availability: d.closed ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      availabilityStarts: d.start,
      validThrough: d.start,
      url: `${url}?date=${d.start}`,
      seller: { "@id": ORG_ID },
    }));
  if (!offers.length && seo.price > 0) {
    offers.push({ "@type": "Offer", price: seo.price, priceCurrency: "MAD", availability: "https://schema.org/InStock", url, seller: { "@id": ORG_ID } });
  }
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "TouristTrip"],
    "@id": `${url}#voyage`,
    name: seo.title,
    description: seo.description,
    url,
    ...(seo.images.length ? { image: seo.images.map(absoluteUrl) } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    provider: { "@id": ORG_ID },
    touristType: "Voyage organisé",
    ...(seo.days.length
      ? {
          itinerary: {
            "@type": "ItemList",
            numberOfItems: seo.days.length,
            itemListElement: seo.days.map((day, i) => ({ "@type": "ListItem", position: i + 1, name: `Jour ${i + 1} : ${day.title}` })),
          },
        }
      : {}),
    ...(offers.length ? { offers: offers.length === 1 ? offers[0] : { "@type": "AggregateOffer", priceCurrency: "MAD", lowPrice: Math.min(...offers.map((o) => o.price)), highPrice: Math.max(...offers.map((o) => o.price)), offerCount: offers.length, offers } } : {}),
  };
}
