// Données de test pour toutes les pages (site public + dashboard), créées via
// l'API comme le ferait le dashboard : permissions réelles, images dans MinIO.
//
//   node api/scripts/seed-test-data.mjs <API_URL> <adminEmail> <adminPassword> [clientEmail] > seed-extra.sql
//
// Rejouable : ids fixes préfixés "seed-", création sinon mise à jour.
// Sur stdout : un SQL à passer à psql pour ce que l'API ne permet pas de
// fixer (dates de création antidatées pour les réservations, ~400
// événements analytics répartis sur 30 jours). Journal sur stderr.
//
// Les singletons (hero, omra, contact, réglages email) sont fabriqués par les
// mêmes fonctions que le dashboard (src/services/*.js) : mêmes formats.

import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_HERO_SLIDES, heroSlideDocumentAttrs } from "../../src/services/heroSlides.js";
import { exampleOmra, omraDocumentAttrs } from "../../src/services/omra.js";
import { contactDocumentAttrs } from "../../src/services/siteContact.js";
import { EMAIL_TRIGGERS, emailSettingsDocumentAttrs } from "../../src/services/emailSettings.js";
import { DEFAULT_AGENCY, agencyDocumentAttrs } from "../../src/services/agency.js";

const [API, ADMIN_EMAIL, ADMIN_PASSWORD, CLIENT_EMAIL] = process.argv.slice(2);
if (!ADMIN_PASSWORD) {
  console.error("usage: node api/scripts/seed-test-data.mjs <API_URL> <adminEmail> <adminPassword> [clientEmail]");
  process.exit(1);
}
const PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));
const log = (...a) => console.error(...a);

// ── Client HTTP (session admin) ──────────────────────────────────────
let cookie = "";
async function call(method, path, body) {
  const headers = { "X-Fmt-Client": "seed" };
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(API + path, { method, headers, body: payload });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    if (pair.startsWith("fmt_session=")) cookie = pair;
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status} ${json?.message ?? text}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Crée le document, ou le met à jour s'il existe déjà (seed rejouable). */
async function upsert(collection, id, data) {
  try {
    return await call("POST", `/v1/collections/${collection}/documents`, { documentId: id, data });
  } catch (err) {
    if (err.status !== 409) throw err;
    return call("PATCH", `/v1/collections/${collection}/documents/${id}`, { data });
  }
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".avif": "image/avif", ".webp": "image/webp" };
const images = {};
/** Envoie public/<rel> dans MinIO sous l'id seed-img-<nom> ; renvoie l'URL publique. */
async function upload(rel) {
  const name = rel.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-");
  const form = new FormData();
  form.append("fileId", `seed-img-${name}`);
  form.append("file", new Blob([await readFile(join(PUBLIC_DIR, rel))], { type: MIME[extname(rel)] }), rel.split("/").pop());
  const file = await call("POST", "/v1/storage/files", form);
  images[rel] = { url: file.url, fileId: file.$id };
  return file.url;
}
const img = (rel) => images[rel].url;

// ── Connexion ────────────────────────────────────────────────────────
await call("POST", "/v1/account/sessions/email", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
const admin = await call("GET", "/v1/account");
if (!admin.labels.includes("admin")) throw new Error(`${ADMIN_EMAIL} n'est pas admin`);
log(`connecté : ${admin.email}`);

// ── Images ───────────────────────────────────────────────────────────
const IMAGE_FILES = [
  "hero/indonesia.jpg", "hero/indonesia2.avif", "hero/bali2.avif", "hero/bali3.avif", "hero/kerala.avif",
  "hero/singapore.avif", "hero/singapore2.avif", "hero/thailand.avif", "hero/thailand3.avif",
  "omra/desert-dawn.jpg", "omra/hero-makkah.jpg", "omra/madinah-dome.jpg", "omra/makkah-tawaf.jpg",
  "office/office-1.jpg", "office/office-2.jpg", "office/office-3.jpg", "logo-256.png",
];
for (const f of IMAGE_FILES) await upload(f);
log(`${IMAGE_FILES.length} images envoyées dans MinIO`);

// ── Destinations / aventures / circuits / équipe / avis (CMS) ────────
const GRADIENTS = [
  "linear-gradient(135deg,#0ea5e9,#6366f1)", "linear-gradient(135deg,#f97316,#db2777)",
  "linear-gradient(135deg,#10b981,#0d9488)", "linear-gradient(135deg,#eab308,#f97316)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)", "linear-gradient(135deg,#64748b,#0f172a)",
];
const DESTINATIONS = [
  { id: "seed-dest-bali", name: "Bali", emoji: "hero/bali3.avif", listing: "3 offres", rating: "4.9" },
  { id: "seed-dest-thailande", name: "Thaïlande", emoji: "hero/thailand3.avif", listing: "2 offres", rating: "4.8" },
  { id: "seed-dest-singapour", name: "Singapour", emoji: "hero/singapore.avif", listing: "1 offre", rating: "4.7" },
  { id: "seed-dest-indonesie", name: "Indonésie", emoji: "hero/indonesia.jpg", listing: "2 offres", rating: "4.9" },
  { id: "seed-dest-kerala", name: "Kerala", emoji: "hero/kerala.avif", listing: "1 offre", rating: "4.6" },
  { id: "seed-dest-arabie", name: "Arabie Saoudite", emoji: "omra/hero-makkah.jpg", listing: "Omra", rating: "5.0" },
];
for (const [i, d] of DESTINATIONS.entries()) {
  await upsert("destinations", d.id, { name: d.name, emoji: img(d.emoji), listing: d.listing, rating: d.rating, gradient: GRADIENTS[i], status: "published" });
}
await upsert("destinations", "seed-dest-brouillon", { name: "Maldives (brouillon)", emoji: img("hero/bali2.avif"), listing: "0 offre", rating: "—", gradient: GRADIENTS[0], status: "draft" });

const ADVENTURES = [
  { id: "seed-adv-bromo", name: "Lever de soleil sur le Bromo", emoji: "hero/indonesia2.avif", category: "Randonnée" },
  { id: "seed-adv-plongee", name: "Plongée à Nusa Penida", emoji: "hero/bali2.avif", category: "Mer" },
  { id: "seed-adv-temples", name: "Temples de Bangkok", emoji: "hero/thailand.avif", category: "Culture" },
  { id: "seed-adv-desert", name: "Nuit dans le désert", emoji: "omra/desert-dawn.jpg", category: "Désert" },
];
for (const [i, a] of ADVENTURES.entries()) {
  await upsert("adventures", a.id, { name: a.name, emoji: img(a.emoji), category: a.category, gradient: GRADIENTS[i + 1], status: "published" });
}

const TOURS = [
  { id: "seed-tour-bali", name: "Bali Essentiel", emoji: "hero/bali3.avif", loc: "Ubud · Seminyak", nights: "8J / 7N", price: "14 900 DH", offer: "-10% avant le 30/11" },
  { id: "seed-tour-thai", name: "Grand Tour de Thaïlande", emoji: "hero/thailand3.avif", loc: "Bangkok · Phuket", nights: "10J / 9N", price: "16 500 DH", offer: "" },
  { id: "seed-tour-sing", name: "Singapour & Kuala Lumpur", emoji: "hero/singapore2.avif", loc: "Singapour · KL", nights: "7J / 6N", price: "13 200 DH", offer: "Vol inclus" },
  { id: "seed-tour-java", name: "Java Volcans", emoji: "hero/indonesia.jpg", loc: "Yogyakarta · Bromo", nights: "9J / 8N", price: "15 800 DH", offer: "" },
];
for (const t of TOURS) await upsert("tours", t.id, { ...t, id: undefined, emoji: img(t.emoji), status: "published" });

const TEAM = [
  { id: "seed-team-1", name: "Yassine Bennani", role: "Directeur d'agence", email: "direction@followmetravel.ma", emoji: "office/office-1.jpg" },
  { id: "seed-team-2", name: "Salma El Idrissi", role: "Conseillère voyages Asie", email: "asie@followmetravel.ma", emoji: "office/office-2.jpg" },
  { id: "seed-team-3", name: "Karim Alaoui", role: "Responsable Omra", email: "omra@followmetravel.ma", emoji: "office/office-3.jpg" },
  { id: "seed-team-4", name: "Nadia Tazi", role: "Service client", email: "contact@followmetravel.ma", emoji: "logo-256.png", status: "inactive" },
];
for (const m of TEAM) await upsert("team", m.id, { name: m.name, role: m.role, email: m.email, emoji: img(m.emoji), status: m.status || "active" });

const TESTIMONIALS = [
  { name: "Imane R.", role: "Voyage à Bali, juillet", rating: "5", text: "Organisation parfaite du début à la fin. Les hôtels étaient exactement comme sur les photos et l'assistance a répondu à chaque question en quelques minutes." },
  { name: "Mehdi & Ghita", role: "Voyage de noces en Thaïlande", rating: "5", text: "Un voyage de noces inoubliable. Mention spéciale pour l'excursion à Phi Phi et pour l'accueil à l'aéroport." },
  { name: "Famille Berrada", role: "Singapour, vacances de printemps", rating: "4", text: "Très bon séjour en famille, programme adapté aux enfants. Seul bémol : un vol retour un peu tôt le matin." },
  { name: "Hajj Abdelkader", role: "Omra Ramadan", rating: "5", text: "Hôtels très proches du Haram, encadrement sérieux et bienveillant. Je recommande Follow Me Travel les yeux fermés." },
  { name: "Sofia L.", role: "Java & Bromo", rating: "5", text: "Le lever de soleil sur le Bromo restera gravé. Guide local excellent, rythme bien dosé." },
];
for (const [i, t] of TESTIMONIALS.entries()) {
  await upsert("testimonials", `seed-testimonial-${i + 1}`, { ...t, emoji: img("logo-256.png"), status: "published" });
}
log("CMS : destinations, aventures, circuits, équipe, avis");

// ── Hôtels (catalogue partagé) ───────────────────────────────────────
const rooms = (triple, double, single, child) =>
  JSON.stringify([
    { type: "Triple", price: triple },
    { type: "Double", price: double },
    { type: "Single", price: single },
    { type: "2–5 ans", price: child },
  ]);
const HOTELS = [
  { id: "seed-hotel-ubud", name: "Ubud Rice Terrace Villas", city: "Ubud", stars: 4, image: "hero/bali2.avif", prices: [12900, 13900, 17900, 6500] },
  { id: "seed-hotel-seminyak", name: "Seminyak Ocean Resort", city: "Seminyak", stars: 5, image: "hero/bali3.avif", prices: [15900, 16900, 21900, 7500] },
  { id: "seed-hotel-bangkok", name: "Bangkok Riverside Inn", city: "Bangkok", stars: 4, image: "hero/thailand.avif", prices: [14900, 15900, 19900, 6900] },
  { id: "seed-hotel-phuket", name: "Phuket Andaman Bay", city: "Phuket", stars: 5, image: "hero/thailand3.avif", prices: [17500, 18500, 23900, 7900] },
  { id: "seed-hotel-marina", name: "Marina Skyline Hotel", city: "Singapour", stars: 4, image: "hero/singapore.avif", prices: [12200, 13200, 16900, 6200] },
  { id: "seed-hotel-yogya", name: "Yogyakarta Heritage", city: "Yogyakarta", stars: 4, image: "hero/indonesia2.avif", prices: [14800, 15800, 19500, 6800] },
  { id: "seed-hotel-makkah", name: "Dar Al Haram Makkah", city: "La Mecque", stars: 5, image: "omra/makkah-tawaf.jpg", prices: [0, 0, 0, 0] },
  { id: "seed-hotel-madinah", name: "Rawdat Al Madinah", city: "Médine", stars: 4, image: "omra/madinah-dome.jpg", prices: [0, 0, 0, 0] },
];
for (const h of HOTELS) {
  await upsert("hotels", h.id, {
    name: h.name, city: h.city, address: `${h.city} — adresse de test`, stars: h.stars, image: img(h.image),
    rooms: rooms(...h.prices),
  });
}
const hotel = (id) => HOTELS.find((h) => h.id === id);
log(`${HOTELS.length} hôtels`);

// ── Packages ─────────────────────────────────────────────────────────
const HEADERS = ["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans"];
let uidN = 1;
const uid = () => uidN++;
const hotelRow = (id, nights, allotment = [6, 10, 4, 6]) => {
  const h = hotel(id);
  return { id: uid(), hotelId: h.id, name: h.name, city: h.city, stars: h.stars, nights, cols: h.prices.map(String), allotment, blockWhenFull: false };
};
const gallery = (...rels) => rels.map((rel) => ({ id: uid(), fileId: images[rel].fileId, url: img(rel), caption: rel.split("/").pop().replace(/\.[^.]+$/, "") }));
const day = (num, title, theme, activities, image = null, badge = "") => ({
  id: uid(), num: String(num).padStart(2, "0"), title, badge, theme, image: image && img(image),
  activities: activities.map((a, i) => ({ id: i + 1, label: a.replace(/^\?/, ""), optional: a.startsWith("?") })),
});
const commonBlob = {
  agency1: "Asfari Voyage", agency1Sub: "Agence de voyage et tourisme",
  agency2: "Follow Me Travel", agency2Sub: "www.followmetravel.ma",
  currency: "DH", priceFromLabel: "À partir de",
  tabs: [
    { id: "itinerary", label: "Itinéraire" }, { id: "gallery", label: "Galerie" },
    { id: "hotels", label: "Hôtels & Tarifs" }, { id: "dates", label: "Dates" },
  ],
  ctaLabel: "Réserver maintenant", phone1: "0664 586 425", phone2: "0608 800 854", website: "www.followmetravel.ma",
};
const sections = (flight, extras, optionBadge, options) => [
  { id: 1, title: "Offre comprend", icon: "🧳", items: [
    { id: 1, icon: "✈️", text: `Billet A/R avec ${flight}` },
    { id: 2, icon: "🛏️", text: "Logement en petit déjeuner" },
    { id: 3, icon: "🚗", text: "Transfert Aéroport – Hôtel – Aéroport" },
    ...extras.map((t, i) => ({ id: 4 + i, icon: "⭐", text: t })),
    { id: 20, icon: "🎧", text: "Assistance durant le voyage" },
  ] },
  { id: 2, title: "En option", icon: "⭐", badge: optionBadge, items: options.map((t, i) => ({ id: i + 1, icon: "📍", text: t })) },
];
const dates = (...pairs) => pairs.map(([from, to], i) => ({ id: i + 1, from, to }));

const PACKAGES = [
  {
    id: "seed-pkg-bali",
    top: { title: "Bali Évasion", category: "summer", status: "published", country: "Indonésie", continent: "Asie", destinations: "seed-dest-bali", tours: "seed-tour-bali", adventures: "seed-adv-plongee", basePrice: 13900, featured: true },
    blob: {
      durationLabel: "Séjour découverte · 08 Jours / 07 Nuits", destination: "BA", destinationAccent: "LI",
      subtitleItalic: "Island of Gods", tagline: "Rizières, temples et plages de l'île des dieux", periodLabel: "JUIL – SEPT 2026",
      basePrice: "13900", heroBg: img("hero/bali3.avif"), gallery: gallery("hero/bali3.avif", "hero/bali2.avif", "hero/indonesia2.avif"),
      sections: sections("Emirates", ["Excursion rizières de Tegallalang", "Coucher de soleil à Uluwatu"], "Pack Excursions : 900 DH / pers.", ["Plongée à Nusa Penida", "Cours de cuisine balinaise"]),
      itineraryTitle: "Ubud & Seminyak",
      days: [
        day(1, "Casablanca → Denpasar", "Arrivée & Installation", ["Vol via Dubaï", "Accueil à l'aéroport", "Transfert Ubud"]),
        day(2, "Ubud", "Culture & Rizières", ["Rizières de Tegallalang", "Forêt des singes", "?Massage balinais"], "hero/bali2.avif", "Incluse"),
        day(3, "Temples sacrés", "Spiritualité", ["Tirta Empul", "Temple de Besakih"]),
        day(4, "Nusa Penida", "Mer & Falaises", ["?Snorkeling avec les raies manta", "Kelingking Beach"], "hero/bali3.avif", "Optionnelle"),
        day(5, "Seminyak", "Plage & Détente", ["Transfert Seminyak", "Après-midi libre"]),
        day(6, "Uluwatu", "Coucher de soleil", ["Temple d'Uluwatu", "Danse Kecak"]),
        day(7, "Journée libre", "Détente & Shopping", ["Shopping libre"]),
        day(8, "Denpasar → Casablanca", "Fin du séjour", ["Transfert aéroport", "Vol retour"]),
      ],
      hotelCategories: [
        { id: uid(), label: "4 Étoiles", tableHeaders: HEADERS, note: "Tarifs par personne en dirhams – sous réserve de disponibilités",
          hotels: [hotelRow("seed-hotel-ubud", 4), { ...hotelRow("seed-hotel-seminyak", 3), cols: ["0", "0", "0", "0"], allotment: [] }] },
        { id: uid(), label: "5 Étoiles", tableHeaders: HEADERS, note: "Tarifs par personne en dirhams – sous réserve de disponibilités",
          hotels: [hotelRow("seed-hotel-seminyak", 7, [4, 8, 2, 4])] },
      ],
      departureDates: [
        { id: 1, from: "04/07", to: "11/07", supplement: 0, capacity: 20, guaranteed: true },
        { id: 2, from: "18/07", to: "25/07", supplement: 800, capacity: 20 },
        { id: 3, from: "01/08", to: "08/08", supplement: 1500, capacity: 16 },
        { id: 4, from: "15/08", to: "22/08", supplement: 1500, capacity: 16, closed: true },
        { id: 5, from: "05/09", to: "12/09", supplement: -500, capacity: 20 },
      ],
      // Conditions d'annulation propres à ce package (sinon : celles de la fiche agence).
      cancellationPolicy: [
        { daysBefore: 45, feePercent: 10 }, { daysBefore: 21, feePercent: 40 }, { daysBefore: 0, feePercent: 100 },
      ],
    },
  },
  {
    id: "seed-pkg-thailande",
    top: { title: "Grand Tour de Thaïlande", category: "luxury", status: "published", country: "Thaïlande", continent: "Asie", destinations: "seed-dest-thailande", tours: "seed-tour-thai", adventures: "seed-adv-temples", basePrice: 14900, featured: true },
    blob: {
      durationLabel: "Circuit · 10 Jours / 09 Nuits", destination: "THAÏ", destinationAccent: "LANDE",
      subtitleItalic: "Land of Smiles", tagline: "De Bangkok aux plages d'Andaman", periodLabel: "OCT – DÉC 2026",
      basePrice: "14900", heroBg: img("hero/thailand3.avif"), gallery: gallery("hero/thailand3.avif", "hero/thailand.avif"),
      sections: sections("Qatar Airways", ["Croisière sur le Chao Phraya", "Excursion Phi Phi Islands"], "Pack Excursions : 1 200 DH / pers.", ["Ferme des éléphants", "Marché flottant"]),
      itineraryTitle: "Bangkok & Phuket",
      days: [
        day(1, "Casablanca → Bangkok", "Arrivée", ["Vol via Doha", "Transfert hôtel"]),
        day(2, "Bangkok", "Temples & Palais", ["Grand Palais", "Wat Pho", "Wat Arun"], "hero/thailand.avif", "Incluse"),
        day(3, "Marché flottant", "Traditions", ["?Damnoen Saduak", "Croisière Chao Phraya"], null, "Optionnelle"),
        day(4, "Bangkok → Phuket", "Vol intérieur", ["Vol Bangkok – Phuket", "Installation"]),
        day(5, "Phi Phi Islands", "Mer d'Andaman", ["Excursion en bateau", "Maya Bay"], "hero/thailand3.avif", "Incluse"),
        day(6, "Phuket", "Plage", ["Journée libre"]),
        day(7, "Phang Nga", "Baie", ["?James Bond Island"], null, "Optionnelle"),
        day(8, "Phuket", "Détente", ["Journée libre"]),
        day(9, "Phuket", "Shopping", ["Old Town Phuket"]),
        day(10, "Phuket → Casablanca", "Fin du séjour", ["Vol retour"]),
      ],
      hotelCategories: [
        { id: uid(), label: "5 Étoiles", tableHeaders: HEADERS, note: "Tarifs par personne en dirhams",
          hotels: [hotelRow("seed-hotel-bangkok", 3), { ...hotelRow("seed-hotel-phuket", 6), cols: ["0", "0", "0", "0"], allotment: [] }] },
      ],
      departureDates: [
        { id: 1, from: "10/10", to: "19/10", supplement: 0, capacity: 12 },
        { id: 2, from: "07/11", to: "16/11", supplement: 0, capacity: 12, guaranteed: true },
        { id: 3, from: "19/12", to: "28/12", supplement: 2500, capacity: 10 },
      ],
    },
  },
  {
    id: "seed-pkg-singapour",
    top: { title: "Singapour & Kuala Lumpur", category: "summer", status: "active", country: "Singapour", continent: "Asie", destinations: "seed-dest-singapour", tours: "seed-tour-sing", adventures: "", basePrice: 12200 },
    blob: {
      durationLabel: "Combiné · 07 Jours / 06 Nuits", destination: "SINGA", destinationAccent: "POUR",
      subtitleItalic: "City of Gardens", tagline: "Deux métropoles, une seule aventure", periodLabel: "TOUTE L'ANNÉE",
      basePrice: "12200", heroBg: img("hero/singapore.avif"), gallery: gallery("hero/singapore.avif", "hero/singapore2.avif"),
      sections: sections("Turkish Airlines", ["Gardens by the Bay", "Tours Petronas"], "Pack Excursions : 700 DH / pers.", ["Universal Studios", "Sentosa"]),
      itineraryTitle: "Singapour & KL",
      days: [
        day(1, "Casablanca → Singapour", "Arrivée", ["Vol via Istanbul", "Transfert hôtel"]),
        day(2, "Singapour", "City tour", ["Marina Bay", "Gardens by the Bay"], "hero/singapore2.avif"),
        day(3, "Sentosa", "Loisirs", ["?Universal Studios"], null, "Optionnelle"),
        day(4, "Singapour → Kuala Lumpur", "Route", ["Transfert en bus"]),
        day(5, "Kuala Lumpur", "City tour", ["Tours Petronas", "Batu Caves"]),
        day(6, "Kuala Lumpur", "Shopping", ["Bukit Bintang"]),
        day(7, "Kuala Lumpur → Casablanca", "Fin du séjour", ["Vol retour"]),
      ],
      hotelCategories: [
        { id: uid(), label: "4 Étoiles", tableHeaders: HEADERS, note: "Tarifs par personne en dirhams",
          hotels: [hotelRow("seed-hotel-marina", 6)] },
      ],
      departureDates: [
        { id: 1, from: "12/11", to: "18/11", supplement: 0, capacity: 15 },
        { id: 2, from: "17/12", to: "23/12", supplement: 1200, capacity: 7 },
        { id: 3, from: "11/02", to: "17/02", supplement: -300 },
      ],
    },
  },
  {
    // Mode « par personne » : aucune chambre tarifée, prix = basePrice × voyageurs.
    id: "seed-pkg-java",
    top: { title: "Java Volcans", category: "mythique", status: "published", country: "Indonésie", continent: "Asie", destinations: "seed-dest-indonesie", tours: "seed-tour-java", adventures: "seed-adv-bromo", basePrice: 15800 },
    blob: {
      durationLabel: "Aventure · 09 Jours / 08 Nuits", destination: "JA", destinationAccent: "VA",
      subtitleItalic: "Fire & Mountains", tagline: "Volcans, temples et lever de soleil sur le Bromo", periodLabel: "AVRIL – OCT 2026",
      basePrice: "15800", heroBg: img("hero/indonesia.jpg"), gallery: gallery("hero/indonesia.jpg", "hero/indonesia2.avif"),
      sections: sections("Emirates", ["Lever de soleil sur le Bromo", "Temple de Borobudur"], "", []),
      itineraryTitle: "Yogyakarta & Bromo",
      days: [
        day(1, "Casablanca → Yogyakarta", "Arrivée", ["Vol via Dubaï et Jakarta"]),
        day(2, "Borobudur", "Temples", ["Lever de soleil à Borobudur", "Prambanan"], "hero/indonesia2.avif", "Incluse"),
        day(3, "Yogyakarta", "Culture", ["Palais du Sultan", "Batik"]),
        day(4, "Train vers l'Est", "Route", ["Train panoramique"]),
        day(5, "Bromo", "Volcan", ["Lever de soleil au Penanjakan", "Cratère du Bromo"], "hero/indonesia.jpg", "Incluse"),
        day(6, "Ijen", "Feu bleu", ["?Randonnée nocturne au Kawah Ijen"], null, "Optionnelle"),
        day(7, "Repos", "Détente", ["Journée libre"]),
        day(8, "Surabaya", "Ville", ["City tour"]),
        day(9, "Surabaya → Casablanca", "Fin du séjour", ["Vol retour"]),
      ],
      hotelCategories: [],
      departureDates: dates(["02/05", "10/05"], ["06/06", "14/06"], ["05/09", "13/09"]),
    },
  },
  {
    // Brouillon : ne doit apparaître ni sur le site ni dans la recherche.
    id: "seed-pkg-kerala",
    top: { title: "Kerala Ayurveda (brouillon)", category: "luxury", status: "draft", country: "Inde", continent: "Asie", destinations: "seed-dest-kerala", tours: "", adventures: "", basePrice: 17900 },
    blob: {
      durationLabel: "Bien-être · 08 Jours / 07 Nuits", destination: "KER", destinationAccent: "ALA",
      subtitleItalic: "God's Own Country", tagline: "Backwaters et cures ayurvédiques", periodLabel: "2027",
      basePrice: "17900", heroBg: img("hero/kerala.avif"), gallery: gallery("hero/kerala.avif"),
      sections: sections("Air India", ["Nuit en house-boat"], "", []),
      itineraryTitle: "Cochin & Munnar", days: [day(1, "Casablanca → Cochin", "Arrivée", ["Vol"])],
      hotelCategories: [], departureDates: dates(["15/01", "22/01"]),
    },
  },
];
for (const p of PACKAGES) {
  await upsert("products", p.id, { ...p.top, tags: [], data: JSON.stringify({ id: 1, ...commonBlob, ...p.blob }) });
}
log(`${PACKAGES.length} packages (dont 1 brouillon, 1 en mode par personne)`);

// ── Singletons du site (dans products, comme le dashboard) ───────────
const HERO_IMAGES = {
  Indonesia: ["hero/indonesia.jpg", "hero/indonesia2.avif"], Thailand: ["hero/thailand3.avif", "hero/thailand.avif"],
  Bali: ["hero/bali3.avif", "hero/bali2.avif"], Kerala: ["hero/kerala.avif", "hero/kerala.avif"],
  Singapore: ["hero/singapore.avif", "hero/singapore2.avif"],
};
for (const [i, s] of DEFAULT_HERO_SLIDES.entries()) {
  const [bg, card] = HERO_IMAGES[s.name];
  await upsert("products", `seed-hero-${i + 1}`, heroSlideDocumentAttrs({ ...s, bgUrl: img(bg), cardUrl: img(card), bgFileId: images[bg].fileId, cardFileId: images[card].fileId }));
}
await upsert("products", "seed-omra", omraDocumentAttrs(exampleOmra()));
await upsert("products", "seed-site-contact", contactDocumentAttrs({ images: [img("office/office-1.jpg"), img("office/office-2.jpg"), img("office/office-3.jpg")] }));
log("singletons : 5 hero slides, omra, contact");

// ── Fiche agence ─────────────────────────────────────────────────────
// Les identifiants légaux sont à remplacer par les vrais (Paramètres → Agence).
await upsert("products", "seed-agency", agencyDocumentAttrs({
  ...DEFAULT_AGENCY,
  // Coordonnées reprises de la fiche de réservation et du cachet de l'agence ;
  // identifiants légaux et RIB laissés vides (non imprimés) tant qu'ils ne
  // sont pas saisis dans Paramètres → Agence.
  legalName: "ASFARI VOYAGE",
  address: "Offices Center B, Résidences Les Champs Mohammed V, N° 402 Bd Mohammed V, 4ᵉ étage",
  city: "Casablanca",
  phones: ["06 64 58 64 25", "06 08 80 08 54", "07 15 17 14 05", "05 20 65 55 75"],
  whatsapp: "+212664586425",
  licenceNumber: "",
  ice: "",
  rc: "",
  taxId: "",
  patente: "",
  bankName: "",
  rib: "",
  invoiceMention: "",
}));
log("fiche agence (Asfari Voyage — identifiants légaux à saisir dans Paramètres → Agence)");

// ── Templates d'email + réglages des notifications ───────────────────
const BRAND = "#0f766e";
const layout = (title, body, cta) => `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:${BRAND};padding:24px 32px;color:#ffffff">
    <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.8">Follow Me Travel</div>
    <h1 style="margin:8px 0 0;font-size:22px">${title}</h1>
  </div>
  <div style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.6">
    ${body}
    ${cta ? `<p style="margin:28px 0 8px"><a href="{{client_space_url}}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">${cta}</a></p>` : ""}
  </div>
  <div style="background:#f8fafc;padding:16px 32px;color:#94a3b8;font-size:12px">
    Follow Me Travel · 0664 586 425 · 0608 800 854 · www.followmetravel.ma
  </div>
</div>`;
const recap = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0;color:#64748b">Référence</td><td style="padding:6px 0;text-align:right"><b>{{reservation_ref}}</b></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Voyage</td><td style="padding:6px 0;text-align:right">{{package_title}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Dates</td><td style="padding:6px 0;text-align:right">du {{reservation_date_from}} au {{reservation_date_to}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Voyageurs</td><td style="padding:6px 0;text-align:right">{{reservation_pax}}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Total estimé</td><td style="padding:6px 0;text-align:right">{{reservation_total}} DH</td></tr>
    </table>`;
const VARS = (keys) => keys.map((key) => ({ key, default: "" }));
const TEMPLATES = [
  {
    trigger: "reservation_created_client", name: "Réservation reçue (client)", category: "Réservation",
    subject: "Nous avons bien reçu votre demande {{reservation_ref}}",
    preheader: "Un conseiller vous appelle sous 24 h pour confirmer votre voyage.",
    html: layout("Merci pour votre réservation !", `<p>Bonjour {{client_name}},</p>
    <p>Votre demande de réservation pour <b>{{package_title}}</b> a bien été enregistrée. Un conseiller Follow Me Travel vous contactera sous 24 h pour confirmer les disponibilités et le règlement.</p>
    ${recap}
    <p>Vous trouverez en pièces jointes votre <b>fiche de réservation</b> (détail complet), votre <b>facture</b> avec l'état de paiement et nos <b>conditions de vente et d'annulation</b>. Merci de les vérifier puis de <b>valider votre réservation</b> — ou de l'annuler — depuis votre espace client.</p>
    <p>Aucun paiement n'a été débité à ce stade.</p>`, "Valider ou annuler ma réservation"),
  },
  {
    trigger: "reservation_created_admin", name: "Nouvelle réservation (agence)", category: "Interne",
    subject: "🔔 Nouvelle réservation {{reservation_ref}} — {{package_title}}",
    preheader: "{{client_name}} · {{reservation_pax}} voyageur(s) · {{reservation_total}} DH",
    html: layout("Nouvelle réservation à traiter", `<p>Une nouvelle réservation vient d'être créée sur le site.</p>
    ${recap}
    <p><b>Client :</b> {{client_name}} — {{client_email}}<br><b>Participant principal :</b> {{participant_name}} — {{participant_phone}}</p>
    <p>À confirmer depuis le dashboard (Réservations).</p>`, ""),
  },
  {
    trigger: "reservation_confirmed", name: "Réservation confirmée", category: "Réservation",
    subject: "Votre voyage {{package_title}} est confirmé ✈️",
    preheader: "Référence {{reservation_ref}} — on s'occupe du reste.",
    html: layout("Votre réservation est confirmée", `<p>Bonjour {{client_name}},</p>
    <p>Bonne nouvelle : votre réservation <b>{{reservation_ref}}</b> est confirmée.</p>
    ${recap}
    <p>Reste à régler : <b>{{reservation_remaining}} DH</b>. Votre conseiller vous communiquera les modalités de paiement.</p>`, "Voir ma réservation"),
  },
  {
    trigger: "reservation_paid", name: "Paiement reçu", category: "Paiement",
    subject: "Paiement reçu pour {{reservation_ref}}",
    preheader: "Montant réglé : {{reservation_paid}} DH",
    html: layout("Merci, votre paiement est enregistré", `<p>Bonjour {{client_name}},</p>
    <p>Nous avons bien reçu votre règlement de <b>{{reservation_paid}} DH</b> pour <b>{{package_title}}</b>.</p>
    <p>Reste à régler : <b>{{reservation_remaining}} DH</b>.</p>`, "Voir ma réservation"),
  },
  {
    trigger: "reservation_cancelled", name: "Réservation annulée", category: "Réservation",
    subject: "Annulation de votre réservation {{reservation_ref}}",
    preheader: "Votre réservation pour {{package_title}} a été annulée.",
    html: layout("Réservation annulée", `<p>Bonjour {{client_name}},</p>
    <p>Votre réservation <b>{{reservation_ref}}</b> pour <b>{{package_title}}</b> a été annulée.</p>
    <p>Si vous n'êtes pas à l'origine de cette annulation ou souhaitez choisir d'autres dates, répondez simplement à cet email ou appelez-nous au 0664 586 425.</p>`, "Découvrir d'autres voyages"),
  },
  {
    trigger: "reservation_completed", name: "Voyage terminé — avis", category: "Fidélisation",
    subject: "Bon retour {{client_name}} ! Comment s'est passé votre voyage ?",
    preheader: "Votre avis aide les prochains voyageurs.",
    html: layout("Bon retour parmi nous !", `<p>Bonjour {{client_name}},</p>
    <p>Nous espérons que <b>{{package_title}}</b> a été à la hauteur de vos attentes. Prenez une minute pour nous laisser votre avis : il compte beaucoup pour nous et pour les prochains voyageurs.</p>`, "Laisser un avis"),
  },
  {
    trigger: "payment_reminder", name: "Rappel de paiement", category: "Paiement",
    subject: "Rappel : {{installment_label}} de {{installment_amount}} DH — {{reservation_ref}}",
    preheader: "Échéance du {{installment_due_date}} pour votre voyage {{package_title}}.",
    html: layout("Rappel de paiement", `<p>Bonjour {{client_name}},</p>
    <p>Pour votre voyage <b>{{package_title}}</b> (départ le {{reservation_travel_start}}), l'échéance <b>{{installment_label}}</b> de <b>{{installment_amount}} DH</b> est attendue pour le <b>{{installment_due_date}}</b>.</p>
    <p>Règlement possible en agence, par virement ({{agency_rib}}) en indiquant la référence <b>{{reservation_ref}}</b>, ou en appelant votre conseiller au {{agency_phone}}.</p>
    <p>L'échéancier complet est joint à cet email. Si vous avez déjà réglé, merci de ne pas tenir compte de ce message.</p>`, "Voir mon dossier"),
  },
  {
    trigger: "booking_abandoned", name: "Réservation non finalisée", category: "Relance",
    subject: "Votre voyage {{package_title}} vous attend",
    preheader: "Une question sur les dates ou le prix ? Nous sommes là.",
    html: layout("Vous y étiez presque !", `<p>Bonjour {{client_name}},</p>
    <p>Vous avez commencé à réserver <b>{{package_title}}</b> sans aller jusqu'au bout. Une question sur les dates, les hôtels ou le paiement en plusieurs fois ? Un conseiller vous répond tout de suite au {{agency_phone}} ou sur WhatsApp ({{agency_whatsapp}}).</p>
    <p><a href="{{package_url}}">Reprendre ma réservation</a></p>`, ""),
  },
];
const templateIds = {};
for (const t of TEMPLATES) {
  const id = `seed-tpl-${t.trigger.replace(/_/g, "-")}`;
  const keys = [...new Set([...`${t.subject} ${t.preheader} ${t.html}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
  await upsert("email_templates", id, {
    name: t.name, category: t.category, subject: t.subject, preheader: t.preheader,
    fromName: "Follow Me Travel", fromEmail: "noreply@followmetravel.ma", replyTo: "contact@followmetravel.ma",
    ccEmails: "", bccEmails: "", html: t.html,
    variables: JSON.stringify(VARS(keys)), tags: JSON.stringify([t.category.toLowerCase()]),
    createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
  });
  templateIds[t.trigger] = id;
}
await upsert("products", "seed-email-settings", emailSettingsDocumentAttrs({
  adminEmails: "contact@followmetravel.ma",
  triggers: Object.fromEntries(EMAIL_TRIGGERS.map((t) => [t.key, { enabled: true, templateId: templateIds[t.key] }])),
}));
log(`${TEMPLATES.length} templates d'email, réglages : ${EMAIL_TRIGGERS.length} déclencheurs actifs, alerte agence → contact@followmetravel.ma`);


// ── Clients (prospects, sans réservation) ────────────────────────────
const CLIENTS = [
  { name: "Omar Chraibi", email: "omar.chraibi@example.com", phone: "0661 12 34 56", notes: "Intéressé par la Thaïlande en décembre, budget 2 pers." },
  { name: "Leila Fassi", email: "leila.fassi@example.com", phone: "0662 98 76 54", notes: "Voyage de noces — rappeler après le 15." },
  { name: "Rachid Ouazzani", email: "r.ouazzani@example.com", phone: "0670 11 22 33", notes: "Groupe de 8 pour l'Omra Ramadan." },
  { name: "Hind Benjelloun", email: "hind.b@example.com", phone: "0655 44 55 66", notes: "" },
  { name: "Youssef Kettani", email: "y.kettani@example.com", phone: "0600 77 88 99", notes: "A demandé un devis Bali 5★." },
];
for (const [i, c] of CLIENTS.entries()) await upsert("clients", `seed-client-${i + 1}`, c);

// ── Réservations (tous les statuts) ──────────────────────────────────
// Sara = le compte client de test s'il est fourni : ses réservations
// apparaissent alors dans son profil (userId rattaché par le SQL final).
const PEOPLE = [
  ["Sara Amrani", "0661 00 11 22", CLIENT_EMAIL || "sara.amrani@example.com"],
  ["Hamza Lahlou", "0662 33 44 55", "hamza.lahlou@example.com"],
  ["Meryem Squalli", "0663 66 77 88", "meryem.s@example.com"],
  ["Anas Bouzidi", "0664 99 00 11", "anas.b@example.com"],
  ["Kenza Raji", "0665 22 33 44", "kenza.raji@example.com"],
  ["Driss Mansouri", "0666 55 66 77", "driss.m@example.com"],
];
const pkgById = Object.fromEntries(PACKAGES.map((p) => [p.id, p]));
const RESERVATIONS = [
  // [package, person, status, daysAgo, category, hotels rows, pax, payments]
  // Bali 4 Étoiles = circuit Ubud → Seminyak : mêmes chambres à chaque étape.
  ["seed-pkg-bali", 0, "pending", 1, "4 Étoiles", [["seed-hotel-ubud", "Double", 1], ["seed-hotel-seminyak", "Double", 1]], 2, []],
  ["seed-pkg-thailande", 1, "pending", 2, "5 Étoiles", [["seed-hotel-bangkok", "Double", 1], ["seed-hotel-phuket", "Double", 1]], 2, []],
  ["seed-pkg-bali", 2, "confirmed", 6, "5 Étoiles", [["seed-hotel-seminyak", "Triple", 1]], 3, [[5000, "transfer", 5]]],
  ["seed-pkg-singapour", 3, "paid", 12, "4 Étoiles", [["seed-hotel-marina", "Double", 2]], 4, [[20000, "transfer", 11], ["rest", "card", 9]]],
  ["seed-pkg-java", 4, "confirmed", 9, null, [], 2, [[10000, "cash", 8]]],
  ["seed-pkg-thailande", 5, "cancelled", 15, "5 Étoiles", [["seed-hotel-bangkok", "Single", 1]], 1, []],
  ["seed-pkg-bali", 0, "completed", 27, "4 Étoiles", [["seed-hotel-ubud", "Double", 1], ["seed-hotel-seminyak", "Double", 1]], 2, [["rest", "transfer", 25]]],
  ["seed-pkg-singapour", 2, "pending", 0, "4 Étoiles", [["seed-hotel-marina", "Triple", 1]], 3, []],
  // Confirmée il y a 12 jours, aucun paiement : acompte en retard (relances, créances).
  ["seed-pkg-thailande", 3, "confirmed", 12, "5 Étoiles", [["seed-hotel-bangkok", "Double", 1], ["seed-hotel-phuket", "Double", 1]], 2, []],
];
const COL = { Triple: 0, Double: 1, Single: 2, "2–5 ans": 3 };
const PAX = { Triple: 3, Double: 2, Single: 1, "2–5 ans": 1 };
const backdate = [];
for (const [i, [pkgId, who, status, daysAgo, category, rows, pax, payments]] of RESERVATIONS.entries()) {
  const pkg = pkgById[pkgId];
  const [fullName, phone, email] = PEOPLE[who];
  // Circuit multi-hôtels : le prix de la formule est porté par le premier hôtel du séjour.
  const hotels = rows.map(([hid, type, qty], k) => {
    const h = hotel(hid);
    const total = k === 0 ? h.prices[COL[type]] * qty * PAX[type] : 0;
    return { name: h.name, hotelId: hid, rooms: [{ type, qty }], subtotal: total, pax: qty * PAX[type] };
  });
  // Départ choisi (jamais un départ fermé) ; son supplément s'ajoute par voyageur.
  const open = pkg.blob.departureDates.filter((d) => !d.closed);
  const dep = open[i % open.length];
  // Pack excursions (800 DH/pers., liste par défaut) sur un dossier sur trois —
  // pas forcément pour tout le groupe : un voyageur de moins à partir de 3.
  const excursionPax = i % 3 === 0 ? (pax >= 3 ? pax - 1 : pax) : 0;
  const total = (hotels.length ? hotels.reduce((s, h) => s + h.subtotal, 0) : pkg.top.basePrice * pax) + (Number(dep.supplement) || 0) * pax + 800 * excursionPax;
  const id = `seed-res-${i + 1}`;
  await upsert("reservations", id, {
    packageId: pkgId, packageTitle: pkg.top.title, category, hotels: JSON.stringify(hotels),
    dateFrom: dep.from, dateTo: dep.to, totalPax: pax,
    participants: JSON.stringify([
      // Passeports : complets sauf dossier 2 (à compléter) ; dossier 3 : un passeport qui expire trop tôt.
      { civility: "Mme", fullName, phone, email, birthDate: "1990-04-12", nationality: "Marocaine",
        ...(i === 1 ? {} : { passportNumber: `AB${String(482100 + i * 37)}`, passportExpiry: i === 2 ? "2027-01-20" : "2031-06-30" }) },
      ...Array.from({ length: pax - 1 }, (_, k) => ({
        civility: k % 2 ? "Mme" : "M.", fullName: `Accompagnant ${k + 1}`, phone: "", email: "", birthDate: k === 1 ? "2022-03-02" : "1988-09-21",
        nationality: "Marocaine", ...(i === 1 ? {} : { passportNumber: `CD${String(731000 + i * 11 + k)}`, passportExpiry: "2030-11-15" }),
      })),
    ]),
    assignedTo: "",
    costs: JSON.stringify(status === "pending" ? [] : [
      { id: `c-${i}-1`, category: "flight", supplier: "Emirates", label: `Billets ${pax} pax`, amount: Math.round(total * 0.38), paid: status !== "confirmed" },
      { id: `c-${i}-2`, category: "hotel", supplier: hotels[0]?.name || "Réceptif local", label: "Hébergement", amount: Math.round(total * 0.27), paid: status === "paid" || status === "completed" },
      { id: `c-${i}-3`, category: "transfer", supplier: "Réceptif local", label: "Transferts & excursions", amount: Math.round(total * 0.08), paid: false },
    ]),
    supplements: excursionPax ? [{ key: "excursions", label: "Pack excursions", qty: excursionPax, pricePerPax: 800, price: 800 * excursionPax }] : [],
    totalEstimate: total, clientEstimate: total, priceVerified: true,
    // Le compte client de test (s'il est fourni) possède les réservations de Sara :
    // userId rempli plus bas par SQL (l'id du compte n'est connu que de la base).
    userId: "", userEmail: email, userName: fullName,
    status, ref: `FMT-SEED-${String(i + 1).padStart(3, "0")}`,
    departureSupplement: Number(dep.supplement) || 0,
    // "rest" : le paiement qui solde le dossier.
    payments: JSON.stringify(payments.map(([amount, method, ago], k) => ({
      id: `pay-${i + 1}-${k + 1}`, date: new Date(Date.now() - ago * 864e5).toISOString().slice(0, 10),
      amount: amount === "rest" ? total - payments.slice(0, k).reduce((s, p) => s + p[0], 0) : amount,
      method, reference: method === "transfer" ? `VIR-${1000 + i * 10 + k}` : "", note: "",
    }))),
    ...(status === "cancelled" ? { cancelledAt: new Date(Date.now() - (daysAgo - 1) * 864e5).toISOString() } : {}),
  });
  backdate.push([id, daysAgo]);
}
log(`${RESERVATIONS.length} réservations (pending, confirmed, paid, cancelled, completed)`);

// ── SQL complémentaire (stdout) ──────────────────────────────────────
const sql = [];
sql.push("BEGIN;");
for (const [id, days] of backdate) {
  sql.push(`UPDATE documents SET created_at = now() - interval '${days} days' - interval '${(days * 37) % 600} minutes' WHERE collection = 'reservations' AND id = '${id}';`);
}
if (CLIENT_EMAIL) {
  const safe = CLIENT_EMAIL.replace(/'/g, "''");
  sql.push(`UPDATE documents SET data = data || jsonb_build_object('userId', u.id, 'userName', CASE WHEN u.name = '' THEN data->>'userName' ELSE u.name END)
  FROM users u WHERE lower(u.email) = lower('${safe}') AND documents.collection = 'reservations' AND documents.data->>'userEmail' = '${safe}';`);
}
// Analytics : ~180 sessions réalistes sur 60 jours (30 jours + la période
// précédente pour les comparaisons), chacune avec sa provenance, son fuseau,
// sa langue et un parcours cohérent (arrivée → recherche → voyage → contact
// → réservation pas à pas).
// Pseudo-aléatoire déterministe : le seed produit toujours les mêmes données.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const SOURCES = [
  [30, { source: "facebook", medium: "paid_social", campaign: "ete-asie" }],
  [18, { source: "google", medium: "organic", campaign: "" }],
  [14, { source: "instagram", medium: "social", campaign: "" }],
  [20, { source: "direct", medium: "", campaign: "" }],
  [10, { source: "whatsapp", medium: "social", campaign: "" }],
  [5, { source: "newsletter", medium: "email", campaign: "octobre" }],
  [3, { source: "google", medium: "cpc", campaign: "omra-2027" }],
];
const ZONES = [[74, "Africa/Casablanca"], [12, "Europe/Paris"], [5, "Europe/Brussels"], [4, "Europe/Madrid"], [2, "America/Montreal"], [3, "Asia/Dubai"]];
const weighted = (list) => {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rnd() * total;
  for (const [w, v] of list) if ((r -= w) <= 0) return v;
  return list[0][1];
};
const SEARCH_TERMS = [["Bali", 3], ["Thaïlande", 2], ["Omra", 1], ["Singapour", 1], ["Maldives", 0], ["Turquie", 0], ["Java", 1]];
const events = [];
const live = PACKAGES.filter((p) => p.top.status !== "draft");
for (let s = 0; s < 180; s++) {
  const start = Date.now() - rnd() * 60 * 864e5;
  const acq = weighted(SOURCES);
  const tz = weighted(ZONES);
  const lang = tz === "Africa/Casablanca" ? pick(["fr", "fr", "fr", "ar"]) : pick(["fr", "fr", "en"]);
  const device = tz === "Africa/Casablanca" ? pick(["mobile", "mobile", "mobile", "desktop"]) : pick(["mobile", "desktop", "desktop"]);
  const session = `seed-session-${s}`;
  let t = start;
  const push = (ev) => {
    t += (20 + rnd() * 90) * 1000;
    const at = new Date(Math.min(t, Date.now() - 60_000));
    events.push({
      id: `seed-ev-${String(events.length + 1).padStart(4, "0")}`,
      at: at.toISOString(),
      data: {
        userId: null, sessionId: session, device, tz, lang, country: tz === "Africa/Casablanca" ? "MA" : null,
        ...acq, referrer: "", landing: "/", createdAt: at.toISOString(), targetId: null, data: "{}", page: "/", category: null, action: null, label: null,
        ...ev,
      },
    });
  };
  const pkg = pick(live);
  const pkgPage = `/packages/view?pkgId=${pkg.id}`;
  push({ event: "page_view", page: pick(["/", "/", "/search", "/omra"]) });
  if (rnd() < 0.35) {
    const [term, results] = pick(SEARCH_TERMS);
    push({ event: "search", category: "search", action: pick(["destination", "filters"]), label: term, page: "/search", data: JSON.stringify({ results }) });
  }
  if (rnd() < 0.72) {
    push({ event: "view", category: "package", action: "view", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
    if (rnd() < 0.12) push({ event: "favorite", category: "package", action: "add", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
    if (rnd() < 0.16) push({ event: "contact", category: "contact", action: "whatsapp", label: `Bouton flottant — ${pkg.top.title}`, targetId: pkg.id, page: pkgPage });
    else if (rnd() < 0.05) push({ event: "contact", category: "contact", action: "phone", label: "+212 664 586 425", page: pkgPage });
    // Le voyage « Java Volcans » est consulté mais peu réservé : la vue business doit le signaler.
    const reserveRate = pkg.id === "seed-pkg-java" ? 0.04 : 0.3;
    if (rnd() < reserveRate) {
      push({ event: "click", category: "package", action: "reserve", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
      if (rnd() < 0.62) {
        push({ event: "booking_step", category: "funnel", action: "travelers", label: pkg.top.title, targetId: pkg.id, page: pkgPage, data: JSON.stringify({ totalPax: 2 }) });
        if (rnd() < 0.72) {
          push({ event: "booking_step", category: "funnel", action: "submit", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
          if (rnd() < 0.88) {
            push({ event: "booking_step", category: "funnel", action: "success", label: pkg.top.title, targetId: pkg.id, page: pkgPage, data: JSON.stringify({ totalEstimate: pkg.top.basePrice * 2, totalPax: 2 }) });
            push({ event: "payment", category: "funnel", action: "complete", label: pkg.top.title, targetId: pkg.id, page: pkgPage, data: JSON.stringify({ totalEstimate: pkg.top.basePrice * 2, totalPax: 2 }) });
          } else {
            push({ event: "booking_step", category: "funnel", action: "error", label: pkg.top.title, targetId: pkg.id, page: pkgPage, data: JSON.stringify({ message: "Plus que 1 place(s) sur ce départ." }) });
          }
        } else push({ event: "abandon", category: "funnel", action: "checkout", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
      } else push({ event: "abandon", category: "funnel", action: "checkout", label: pkg.top.title, targetId: pkg.id, page: pkgPage });
    }
  }
  if (rnd() < 0.05) push({ event: "lead", category: "lead", action: "contact", label: "Voyage sur mesure", page: "/contact" });
  if (rnd() < 0.06) push({ event: "lead", category: "lead", action: "newsletter", label: "footer" });
  if (rnd() < 0.04) push({ event: "contact", category: "contact", action: "email", label: "contact@followmetravel.ma", page: "/contact" });
}
sql.push(`DELETE FROM documents WHERE collection = 'events' AND id LIKE 'seed-ev-%';`);
sql.push(`INSERT INTO documents (collection, id, data, created_at, updated_at)
SELECT 'events', e->>'id', e->'data', (e->>'at')::timestamptz, (e->>'at')::timestamptz
FROM jsonb_array_elements($seed$${JSON.stringify(events)}$seed$::jsonb) AS e;`);
sql.push("COMMIT;");
process.stdout.write(sql.join("\n") + "\n");
log(`SQL complémentaire : dates des réservations${CLIENT_EMAIL ? ", rattachement au compte client" : ""}, ${events.length} événements analytics (180 sessions sur 60 jours)`);
