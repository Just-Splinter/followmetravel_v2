/**
 * Slug d'URL — identique à slugify() de src/marketing/seo.js (le site) :
 * « Grand Tour de Thaïlande » → « grand-tour-de-thailande ».
 */
export function slugify(text: string): string {
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

/** Chemin canonique d'une fiche voyage sur le site : /voyages/<id>/<slug>. */
export function packagePath(id: string, title: string): string {
  const slug = slugify(title);
  return `/voyages/${encodeURIComponent(id)}${slug ? `/${slug}` : ""}`;
}
