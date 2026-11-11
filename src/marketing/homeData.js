// Données de la page d'accueil : cartes voyage (prochain départ, places),
// diapositives du hero tirées des packages « À la une », format des dates.
import { localizeData } from "../services/translate";
import { upcomingDepartures } from "./dates";
import { packagePath } from "./seo";

const parse = (raw) => {
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) || {};
  } catch {
    return {};
  }
};

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const intlLocale = (locale) => (locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR");

/** « 12 nov. » — date ISO (AAAA-MM-JJ) lue en heure locale, sans décalage de fuseau. */
export function dayLabel(iso, locale, opts = { day: "numeric", month: "short" }) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocale(locale), opts);
}

/** Moins de places que ce seuil : on affiche le nombre restant. */
export const FEW_SEATS = 6;

/**
 * Cartes voyage de l'accueil : « À la une » d'abord, puis par prochain départ.
 * `departures` vient de /v1/departures/upcoming (places restantes réelles) ;
 * à défaut, la prochaine date est calculée depuis les dates du package.
 */
export function packageCards(packages, departures, locale) {
  const next = new Map();
  for (const d of departures || []) if (!d.closed && !next.has(d.packageId)) next.set(d.packageId, d);
  return (packages || [])
    .map((p) => {
      const data = localizeData(parse(p.data), locale);
      const api = next.get(p.$id);
      const local = upcomingDepartures(data.departureDates)[0];
      return {
        id: p.$id,
        title: p.title || data.destination || "—",
        img: data.heroBg || "",
        country: p.country || "",
        continent: p.continent || "",
        duration: data.durationLabel || "",
        price: Number(p.basePrice) || 0,
        departureDates: data.departureDates || [],
        tagline: data.tagline || data.subtitleItalic || "",
        featured: !!p.featured,
        next: api?.start || (local ? isoOf(local.when) : ""),
        remaining: api?.remaining ?? null,
        guaranteed: !!api?.guaranteed,
      };
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (a.next || "9999").localeCompare(b.next || "9999") || a.title.localeCompare(b.title));
}

/** Diapositives hero des packages « À la une » (avec image), avant celles du CMS. */
export function packageHeroSlides(cards, max = 5) {
  return cards
    .filter((c) => c.featured && c.img)
    .slice(0, max)
    .map((c) => ({
      $id: `pkg-${c.id}`,
      name: c.title,
      description: c.tagline || [c.duration, c.country].filter(Boolean).join(" · "),
      bg: c.img,
      card: c.img,
      href: packagePath(c.id, c.title),
      pkg: { id: c.id, price: c.price, next: c.next, remaining: c.remaining },
    }));
}
