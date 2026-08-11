// Hero slides live in the Appwrite `products` collection as documents whose
// `data` JSON carries { kind: "hero-slide", ... }. That collection is the only
// content collection with public (guest) read access and a large `data`
// attribute, and it is already fetched on the landing page by TravelDataContext
// — so hero content is backend-managed without requiring a new collection
// (which would need console/API-key access to create).

export const HERO_KIND = "hero-slide";

/** Parse a products document into a hero slide, or null if it isn't one. */
export function parseHeroSlide(doc) {
  try {
    const data = JSON.parse(doc.data);
    if (data?.kind !== HERO_KIND) return null;
    return { $id: doc.$id, ...data };
  } catch {
    return null;
  }
}

/** True when a products document is a hero slide (used to hide them from package UIs). */
export function isHeroSlideDoc(doc) {
  return parseHeroSlide(doc) !== null;
}

/** Published hero slides from the raw products array, in display order. */
export function heroSlidesFromPackages(packages) {
  return (packages || [])
    .map(parseHeroSlide)
    .filter(Boolean)
    .filter((s) => s.status !== "draft")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Top-level attributes for a hero slide's products document. */
export function heroSlideDocumentAttrs(slide) {
  return {
    title: `Hero — ${slide.name}`,
    category: "destinations",
    status: "draft", // never surfaces as a real package anywhere
    basePrice: 0,
    tags: [],
    data: JSON.stringify({ kind: HERO_KIND, ...slide, $id: undefined }),
  };
}

// ─── Default slide set (video reference content, images in /public/hero) ─────
// Used by the CMS "import" action to seed Appwrite, and as a local fallback
// when the backend has no published hero slides yet.
export const DEFAULT_HERO_SLIDES = [
  {
    name: "Indonesia",
    cardLabel: "Mount Bromo, Indonesia",
    description:
      "As the largest archipelagic country in the world, Indonesia is blessed with so many different people, cultures, customs, traditions, artworks, food, animals, plants, landscapes, and everything that made it almost like 100 (or even 200) countries melted beautifully into one.",
    dots: 4,
    order: 1,
    status: "published",
    bgLocal: "/hero/indonesia.jpg",
    cardLocal: "/hero/indonesia2.avif",
  },
  {
    name: "Thailand",
    cardLabel: "Khao Sok, Thailand",
    description:
      "Thailand is a Southeast Asian country. It's known for tropical beaches, opulent royal palaces, ancient ruins and ornate temples displaying figures of Buddha. In Bangkok, the capital, an ultramodern cityscape rises next to quiet canalside communities and the iconic temples of Wat Arun, Wat Pho and the Emerald Buddha Temple (Wat Phra Kaew).",
    dots: 5,
    order: 2,
    status: "published",
    bgLocal: "/hero/thailand3.avif",
    cardLocal: "/hero/thailand.avif",
  },
  {
    name: "Bali",
    cardLabel: "Diamond Beach, Bali",
    description:
      "Bali is an Indonesian island known for its forested volcanic mountains, iconic rice paddies, beaches and coral reefs. The island is home to religious sites such as cliffside Uluwatu Temple. To the south, the beachside city of Kuta has lively bars, while Seminyak, Sanur and Nusa Dua are popular resort towns.",
    dots: 5,
    order: 3,
    status: "published",
    bgLocal: "/hero/bali3.avif",
    cardLocal: "/hero/bali2.avif",
  },
  {
    name: "Kerala",
    cardLabel: "Munnar Hills, Kerala",
    description:
      "Kerala, a state on India's tropical Malabar Coast, has nearly 600km of Arabian Sea shoreline. It's known for its palm-lined beaches and backwaters, a network of canals. Inland are the Western Ghats, mountains whose slopes support tea, coffee and spice plantations as well as wildlife.",
    dots: 4,
    order: 4,
    status: "published",
    bgLocal: "/hero/kerala.avif",
    cardLocal: "/hero/kerala.avif",
  },
  {
    name: "Singapore",
    cardLabel: "Marina Bay, Singapore",
    description:
      "Singapore is a global financial center with a tropical climate and multicultural population. Its colonial core centers on the Padang, a cricket field since the 1830s and now flanked by grand buildings such as City Hall, with its 18 Corinthian columns.",
    dots: 5,
    order: 5,
    status: "published",
    bgLocal: "/hero/singapore.avif",
    cardLocal: "/hero/singapore2.avif",
  },
];

/** Fallback slides for when Appwrite has no published hero slides (e.g. before
 *  the first CMS import). Uses the local /public/hero images. */
export function fallbackHeroSlides() {
  return DEFAULT_HERO_SLIDES.map((s, i) => ({
    ...s,
    $id: `local-${i}`,
    bg: s.bgLocal,
    card: s.cardLocal,
  }));
}

/** Resolve a slide's background / card image URL (Appwrite file URL or local). */
export function slideBg(slide) {
  return slide.bgUrl || slide.bg || slide.bgLocal;
}
export function slideCard(slide) {
  return slide.cardUrl || slide.card || slide.cardLocal;
}
