// Pré-rendu SEO, lancé après `vite build` (npm run build).
//
// Le site est une SPA : sans JavaScript, un moteur ou un aperçu de lien
// (WhatsApp, Facebook) ne voit qu'une page vide. Ce script écrit, pour chaque
// page publique et chaque voyage publié, un HTML statique avec ses balises
// (titre, description, canonique, Open Graph, JSON-LD) et son contenu texte,
// que React remplace au chargement. Il génère aussi sitemap.xml.
//
//   dist/index.html                     accueil (pré-rendu)
//   dist/search.html, omra.html, …      pages publiques
//   dist/voyages/<id>/<slug>.html       une page par voyage publié
//   dist/app.html                       coquille SPA (pages privées, voyages ajoutés depuis le build)
//   dist/sitemap.xml
//
// Apache sert ces fichiers via public/.htaccess. Les données (voyages, prix,
// dates) sont celles de l'API au moment du build : rebuilder après un ajout
// ou une modification importante du catalogue. API injoignable : pages
// statiques seulement, le build ne casse pas.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadEnv } from "vite";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const env = loadEnv("production", ROOT, "VITE_");
Object.assign(process.env, env); // seo.js lit VITE_SITE_URL sous Node

const seo = await import("../src/marketing/seo.js");
const { omraFromPackages, omraYear } = await import("../src/services/omra.js");
const { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, absoluteUrl, packageSeo, packageJsonLd, agencyJsonLd, websiteJsonLd, breadcrumbJsonLd } = seo;
const API_URL = (env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const PUBLIC_STATUSES = ["active", "published"];

// ── Données ──────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const kindOf = (doc) => {
  try {
    return JSON.parse(doc.data)?.kind || null;
  } catch {
    return null;
  }
};

function isPublic(doc, today) {
  if (kindOf(doc) || !PUBLIC_STATUSES.includes(doc.status)) return false;
  if (doc.publishAt && String(doc.publishAt).slice(0, 10) > today) return false;
  if (doc.unpublishAt && String(doc.unpublishAt).slice(0, 10) <= today) return false;
  return true;
}

let products = [];
let departures = [];
let apiOk = true;
try {
  const q = encodeURIComponent(JSON.stringify({ method: "limit", values: [5000] }));
  [products, departures] = await Promise.all([
    api(`/v1/collections/products/documents?queries=${q}`).then((r) => r.documents || []),
    api("/v1/departures/upcoming?days=365&limit=50").catch(() => []),
  ]);
} catch (e) {
  apiOk = false;
  console.warn(`[prerender] API injoignable (${API_URL}) : pages statiques seulement — ${e.message}`);
}

const today = new Date().toISOString().slice(0, 10);
const packages = products.filter((d) => isPublic(d, today)).map(packageSeo);
const agencyDoc = products.find((d) => kindOf(d) === "agency");
const agency = agencyDoc ? JSON.parse(agencyDoc.data) : {};
const depsByPkg = new Map();
for (const d of departures) depsByPkg.set(d.packageId, [...(depsByPkg.get(d.packageId) || []), d]);

// ── HTML ─────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => `${Number(n).toLocaleString("fr-FR").replace(/\u202f/g, " ")} DH`;
const dateFr = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const link = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;

// Gabarit : la sortie de Vite (index.html), ou sa copie app.html si le script est relancé seul.
const template = await readFile(join(DIST, "app.html"), "utf8")
  .then((html) => (html.includes("<!-- seo:start") ? html : Promise.reject()))
  .catch(() => readFile(join(DIST, "index.html"), "utf8"));
if (!template.includes("<!-- seo:start") || !template.includes('<div id="root"></div>')) {
  throw new Error("dist/index.html : marqueurs seo:start / #root introuvables.");
}

// Contenu lisible avant le chargement de React (puis remplacé par l'application).
const SNAP_STYLE = `<style>.seo-snap{max-width:880px;margin:0 auto;padding:88px 20px 64px;font:16px/1.65 "Instrument Sans",system-ui,sans-serif;color:#1b1713}.seo-snap h1,.seo-snap h2{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.15}.seo-snap h1{font-size:40px;margin:0 0 16px}.seo-snap h2{font-size:24px;margin:40px 0 12px}.seo-snap a{color:inherit}.seo-snap li{margin:6px 0}.seo-snap nav{font-size:13px;margin-bottom:24px}</style>`;

function render({ path, title, description, image, jsonLd = [], body, noindex = false, ogType = "website" }) {
  const fullTitle = title ? (title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`) : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = absoluteUrl(path);
  const img = absoluteUrl(image || DEFAULT_IMAGE);
  const tags = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${esc(fullTitle)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(fullTitle)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    // data-ld : remplacés par usePageMeta une fois l'application chargée.
    ...jsonLd.map((d) => `<script type="application/ld+json" data-ld="page">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`),
    SNAP_STYLE,
  ].join("\n    ");
  return template
    .replace(/<!-- seo:start[\s\S]*?<!-- seo:end -->/, tags)
    .replace('<div id="root"></div>', `<div id="root"><main class="seo-snap">${body}</main></div>`);
}

async function write(file, html) {
  const out = join(DIST, file);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html, "utf8");
}

const footerInfo = () =>
  `<h2>Contact</h2><p>${esc(agency.tradeName || SITE_NAME)}${agency.city ? ` — ${esc(agency.city)}` : ""}<br />${(agency.phones || []).map(esc).join(" · ")}${agency.email ? `<br />${esc(agency.email)}` : ""}</p><p>${link("/contact", "Nous contacter")} · ${link("/legal/cgv", "Conditions générales de vente")}</p>`;

const packageList = (list) =>
  `<ul>${list
    .map((p) => `<li>${link(p.path, p.title)}${p.duration ? ` — ${esc(p.duration)}` : ""}${p.country ? `, ${esc(p.country)}` : ""}${p.price > 0 ? ` — à partir de ${money(p.price)}` : ""}</li>`)
    .join("")}</ul>`;

const pages = []; // [fichier, chemin pour le sitemap, lastmod?, images?]

// Coquille SPA : pages privées et voyages ajoutés depuis le build (balises génériques).
await write("app.html", template);

// Page « Bientôt en ligne » activée (Paramètres → Agence) : seule l'accueil
// est pré-rendue, avec le contenu de la page d'attente ; les voyages et le
// reste du site ne sont pas publiés dans le HTML statique ni dans le sitemap.
const comingSoon = !!agency.comingSoon;
if (comingSoon) {
  const title = agency.comingSoonTitle?.trim() || "Le voyage commence bientôt.";
  const message = agency.comingSoonMessage?.trim() || "Notre nouvelle agence en ligne arrive : circuits organisés, séjours, Omra et voyages sur mesure au départ du Maroc. Laissez votre e-mail, nous vous prévenons dès l'ouverture.";
  await write("index.html", render({
    path: "/",
    title: "Bientôt en ligne",
    description: message,
    body: `<h1>${esc(title)}</h1><p>${esc(message)}</p>${agency.launchDate ? `<p>Ouverture le ${dateFr(String(agency.launchDate).slice(0, 10))}.</p>` : ""}${footerInfo()}`,
    jsonLd: [agencyJsonLd(agency)],
  }));
  pages.push(["/", "1.0", "daily"]);
}

// Accueil
if (!comingSoon) {
  const deps = departures.filter((d) => !d.closed).slice(0, 8);
  const body = [
    `<h1>Agence de voyages au Maroc : circuits, séjours et Omra</h1>`,
    `<p>${esc(DEFAULT_DESCRIPTION)}</p>`,
    deps.length
      ? `<h2>Prochains départs</h2><ul>${deps.map((d) => `<li>${link(seo.packageHref(d.packageId, d.title, { date: d.start }), d.title)} — ${dateFr(d.start)}${d.price > 0 ? ` — à partir de ${money(d.price)}` : ""}</li>`).join("")}</ul>`
      : "",
    packages.length ? `<h2>Nos voyages organisés</h2>${packageList(packages)}` : "",
    `<h2>Omra</h2><p>${link("/omra", "Découvrir notre programme Omra")}</p>`,
    footerInfo(),
  ].join("");
  await write("index.html", render({ path: "/", body, jsonLd: [agencyJsonLd(agency), websiteJsonLd()] }));
  pages.push(["/", "1.0", "daily"]);
}

if (!comingSoon) {
// Recherche (liste complète : point d'entrée du maillage interne)
await write(
  "search.html",
  render({
    path: "/search",
    // Mêmes textes que l'application (i18n : search_meta_title / search_meta_desc).
    title: "Voyages organisés et circuits au départ du Maroc",
    description: "Tous nos circuits et séjours au départ de Casablanca : dates fixes, formules d'hôtels, prix détaillés et places restantes. Réservation simple, règlement en plusieurs fois.",
    body: `<h1>Tous nos voyages</h1>${packages.length ? packageList(packages) : "<p>Catalogue en cours de mise à jour.</p>"}${footerInfo()}`,
    jsonLd: [breadcrumbJsonLd([["Accueil", "/"], ["Voyages", "/search"]])],
  }),
);
pages.push(["/search", "0.9", "daily"]);

// Omra
{
  const year = omraYear(omraFromPackages(products)); // même année que la page Omra
  await write(
    "omra.html",
    render({
      path: "/omra",
      title: `Omra ${year} au départ du Maroc`, // i18n : om_meta_title / om_meta_desc
      description: `Omra ${year} avec Follow Me Travel : Makkah et Madinah, vols, hôtels proches du Haram, accompagnement et assistance pendant tout le voyage.`,
      image: "/omra/hero-makkah.jpg",
      body: `<h1>Omra ${year}</h1><p>Makkah et Madinah, préparées avec le soin qu'exige le voyage d'une vie : vols, hôtels, transferts et accompagnement.</p>${footerInfo()}`,
      jsonLd: [breadcrumbJsonLd([["Accueil", "/"], ["Omra", "/omra"]])],
    }),
  );
  pages.push(["/omra", "0.8", "weekly"]);
}

// Contact
await write(
  "contact.html",
  render({
    path: "/contact",
    title: "Contact",
    // Même texte que ContactPage (cta_sub + adresse).
    description: "Devis précis sous 24 h ouvrées — départs de Casablanca, règlement en plusieurs fois. Offices Center B, N° 402 Bd Mohammed V — 4ᵉ étage, Casablanca 20000",
    body: `<h1>Contact</h1>${footerInfo()}`,
    jsonLd: [agencyJsonLd(agency)],
  }),
);
pages.push(["/contact", "0.5", "monthly"]);

// Pages légales
for (const [slug, title] of [["cgv", "Conditions générales de vente"], ["confidentialite", "Politique de confidentialité"], ["cookies", "Politique des cookies"]]) {
  await write(`legal/${slug}.html`, render({ path: `/legal/${slug}`, title, body: `<h1>${esc(title)}</h1>${footerInfo()}` }));
  pages.push([`/legal/${slug}`, "0.3", "yearly"]);
}

// Une page par voyage publié
for (const p of packages) {
  const deps = depsByPkg.get(p.id) || [];
  const body = [
    `<nav>${link("/", "Accueil")} › ${link("/search", "Voyages")} › ${esc(p.title)}</nav>`,
    `<h1>${esc(p.title)}</h1>`,
    p.lead ? `<p>${esc(p.lead)}</p>` : "",
    `<p>${[p.duration, p.country].filter(Boolean).map(esc).join(" — ")}${p.price > 0 ? `<br />À partir de <strong>${money(p.price)}</strong> par personne` : ""}</p>`,
    p.days.length
      ? `<h2>Programme</h2><ol>${p.days.map((d) => `<li><strong>${esc(d.title)}</strong>${(d.activities || []).length ? ` : ${d.activities.map((a) => esc(a.label)).filter(Boolean).join(", ")}` : ""}</li>`).join("")}</ol>`
      : "",
    p.included.length ? `<h2>Le prix comprend</h2><ul>${p.included.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "",
    deps.length
      ? `<h2>Dates de départ</h2><ul>${deps.map((d) => `<li>${dateFr(d.start)} → ${dateFr(d.end)}${d.price > 0 ? ` — ${money(d.price)}` : ""}${d.closed ? " — complet" : d.remaining !== null && d.remaining <= 6 ? ` — ${d.remaining} places restantes` : ""}</li>`).join("")}</ul>`
      : "",
    footerInfo(),
  ].join("");
  const file = `${p.path.slice(1)}.html`;
  await write(
    decodeURIComponent(file),
    render({
      path: p.path,
      title: p.title,
      description: p.description,
      image: p.image,
      ogType: "product",
      body,
      jsonLd: [packageJsonLd(p, deps), breadcrumbJsonLd([["Accueil", "/"], ["Voyages", "/search"], [p.title, p.path]])],
    }),
  );
  pages.push([p.path, "0.8", "weekly", p.updatedAt, p.images]);
}
}

// ── Sitemap ──────────────────────────────────────────────────────────
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages
  .map(
    ([path, priority, freq, lastmod, images = []]) => `  <url>
    <loc>${esc(absoluteUrl(path))}</loc>${lastmod ? `\n    <lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : ""}
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>${images.map((src) => `\n    <image:image><image:loc>${esc(absoluteUrl(src))}</image:loc></image:image>`).join("")}
  </url>`,
  )
  .join("\n")}
</urlset>
`;
await writeFile(join(DIST, "sitemap.xml"), sitemap, "utf8");

console.log(`[prerender] ${pages.length} pages (${packages.length} voyages${apiOk ? "" : ", API injoignable"}) + sitemap.xml → ${SITE_URL}`);
