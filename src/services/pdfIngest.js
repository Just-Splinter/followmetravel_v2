// PDF → package ingestion for the admin create flow.
// 1. extractPdfText(): text-only client-side extraction via pdfjs-dist
//    (images ignored; Arabic and varied layouts supported — items are kept
//    in content-stream order, which is pdf.js's best guess at reading order).
// 2. analyzePdfText(): ONE LLM call (OpenRouter, cheap qwen/deepseek chain,
//    same house pattern as translate.js) mapping the raw text to the exact
//    two-step package schema: step-1 doc attrs + step-2 editor data blob.
// 3. diffTaxonomy() / buildPackageData(): compare LLM values against the
//    predefined taxonomy (case/accent-insensitive) and assemble the final
//    editor blob with ids and editor defaults.

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

const API_KEY = env.OPENROUTER_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Cheap-first model chains; unavailable ids (unknown model, no credits,
// upstream rate-limit) fall through to the next one. Free-tier fallbacks
// keep the feature working on a zero-balance OpenRouter account.
const TEXT_MODELS = [
  env.VITE_PDF_INGEST_MODEL,
  "qwen/qwen-2.5-72b-instruct",
  "deepseek/deepseek-chat-v3-0324",
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
].filter(Boolean);

// Used when the PDF has no text layer (pure scan): pages are rasterized
// client-side and sent as images to a vision-capable model — still ONE call.
const VISION_MODELS = [
  env.VITE_PDF_INGEST_VISION_MODEL,
  "qwen/qwen2.5-vl-72b-instruct",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "dots-studio/dots-3-note-preview:free",
].filter(Boolean);

/** True when a key is configured — the import UI can hide itself otherwise. */
export const pdfIngestConfigured = () => !!API_KEY;

/* ── 1. Text extraction (pdfjs) ─────────────────────────────────────────── */

let _pdfjsPromise = null;
async function loadPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return _pdfjsPromise;
}

/**
 * Extract plain text from PDF bytes with an already-loaded pdfjs module —
 * shared by the browser flow and the headless test script (which passes the
 * legacy node build). Lines are rebuilt from content order + hasEOL/y jumps.
 */
export async function extractTextWithLib(pdfjsLib, bytes) {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const pages = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = "";
      let lastY = null;
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (text && lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          text += "\n";
        } else if (text && !text.endsWith("\n") && !text.endsWith(" ")) {
          text += " ";
        }
        text += item.str;
        if (item.hasEOL) text += "\n";
        if (y !== null) lastY = y;
      }
      pages.push(`--- Page ${p} ---\n${text.trim()}`);
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join("\n\n");
}

/** True when a PDF's text layer is too thin to describe a package. */
export const textTooThin = (text) =>
  text.replace(/--- Page \d+ ---/g, "").trim().length < 200;

/**
 * Rasterize PDF pages to JPEG data-URLs — the fallback for scanned
 * brochures with no text layer. Canvas creation/encoding is injected so the
 * browser (HTMLCanvasElement) and the node test script (@napi-rs/canvas)
 * share the same rendering path.
 */
export async function renderPdfPagesWithLib(
  pdfjsLib,
  bytes,
  { createCanvas, encode, maxPages = 10, maxDim = 1600 }
) {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const images = [];
  try {
    const n = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, maxDim / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      images.push(await encode(canvas));
    }
  } finally {
    await loadingTask.destroy();
  }
  return images;
}

/**
 * Browser entry point: extract the PDF's content from a File/Blob.
 * @returns {{ text: string, images: string[] }} — `images` (JPEG data-URLs)
 * only when the text layer is missing/too thin (scanned brochure).
 */
export async function extractPdfContent(file) {
  const pdfjsLib = await loadPdfjs();
  // getDocument transfers the buffer to the pdf.js worker (detaching it),
  // so each pass gets its own copy of the original bytes.
  const buf = await file.arrayBuffer();
  const text = await extractTextWithLib(pdfjsLib, new Uint8Array(buf.slice(0)));
  if (!textTooThin(text)) return { text, images: [] };

  const images = await renderPdfPagesWithLib(pdfjsLib, new Uint8Array(buf.slice(0)), {
    createCanvas: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    },
    encode: (canvas) => canvas.toDataURL("image/jpeg", 0.8),
  });
  if (!images.length) {
    throw new Error("PDF illisible : aucun texte ni page exploitable détecté.");
  }
  return { text, images };
}

/* ── 2. The single LLM call ─────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You convert the content of a travel-package PDF (brochure) into ONE JSON object for a travel agency back-office. The content is either raw extracted text (with page markers "--- Page N ---") or page images of a scanned brochure — read ALL visible text in the images. The source may be in French, Arabic or English. Map EVERY detail present in the text to its exact field. NEVER invent data: anything absent from the text is null (strings/numbers) or [] (arrays). Output French copy when the source is French; translate Arabic/English marketing copy to French (keep proper nouns — hotels, cities, airlines — unchanged).

Reply with ONLY this JSON object (no markdown, no commentary):

{
  "basic": {
    "title": string,            // short package title in French, e.g. "Séjour à Istanbul 8J/7N"
    "country": string|null,     // destination country, FRENCH name (e.g. "Turquie", "Émirats Arabes Unis", "Maroc")
    "continent": string|null,   // exactly one of: "Europe","Asie","Afrique","Amériques","Océanie"
    "destinations": string[],   // visited cities/destinations, French spelling (e.g. ["Istanbul","Bursa"])
    "tours": string[],          // named multi-city tour circuits ONLY if the PDF presents one; usually []
    "adventures": string[],     // adventure activity themes (e.g. "Quad","Montgolfière") ONLY if central to the offer; usually []
    "basePrice": number|null    // lowest per-person price in the document (digits only)
  },
  "data": {
    "destination": string,          // main destination display name, UPPERCASE (e.g. "ISTANBUL")
    "destinationAccent": string,    // optional last syllable(s) highlighted in another color, else ""
    "subtitleItalic": string|null,  // short subtitle if any (e.g. "Summer Holiday")
    "tagline": string|null,         // one-line marketing tagline / description
    "durationLabel": string|null,   // duration badge, e.g. "08 Jours / 07 Nuits" (keep the PDF's wording)
    "periodLabel": string|null,     // travel period label, e.g. "MAI – JUIN 2026"
    "basePrice": number|null,       // same as basic.basePrice
    "currency": string,             // "DH" unless the PDF clearly uses another currency
    "sections": [                   // every bullet-list block: what's included, options, not included, formalities…
      { "title": string, "icon": string /*one emoji*/, "badge": string /*e.g. "Pack : 800 DH / pers." or ""*/,
        "items": [ { "icon": string /*one emoji*/, "text": string } ] }
    ],
    "itineraryTitle": string|null,  // heading of the day-by-day program if any
    "days": [                       // day-by-day itinerary; [] when the PDF has none
      { "num": string /*"01","02"…*/, "title": string /*e.g. "Casablanca → Istanbul"*/,
        "badge": string /*"Incluse","Optionnelle" or ""*/, "theme": string /*short theme, else ""*/,
        "activities": [ { "label": string, "optional": boolean } ] }
    ],
    "hotelCategories": [            // one entry per hotel formula / price table (e.g. "4 Étoiles", "5 Étoiles"); [] if none
      { "label": string, "basePrice": string /*digits, "" if unknown*/,
        "tableHeaders": ["Hôtel","Ville","Nuits","★", ...roomTypeColumns /*e.g. "Triple","Double","Single","Enfant"*/],
        "hotels": [ { "name": string, "city": string, "stars": number /*1-5*/, "nights": number,
                      "cols": string[] /*per-person price per room column, digits as strings, aligned with roomTypeColumns; "0" if missing*/ } ],
        "note": string /*footnote under the table, else ""*/ }
    ],
    "departureDates": [ { "from": "DD/MM", "to": "DD/MM" } ],  // every departure window; year-less day/month
    "suppliments": [                // paid per-person options/supplements with a price (excursion packs, single supplement…)
      { "key": string /*short-slug*/, "label": string, "icon": string /*one emoji*/, "pricePerPax": number }
    ],
    "phone1": string|null, "phone2": string|null,   // contact phone numbers found in the PDF
    "website": string|null                          // website found in the PDF
  }
}

Rules:
- Prices: numbers without separators ("7 690 DH" → 7690). Hotel table cols stay strings ("7690").
- Dates like "30 Mai" or "٣٠ مايو" → "30/05". A date range "30/05 - 06/06" is one departureDates entry.
- If the same info could fit sections and suppliments (priced option), put it in BOTH the option section and suppliments.
- hotelCategories: if the PDF has one hotel table without formulas, output a single category labelled by hotel class (e.g. "Hôtels 4★") or "Formule unique". Row nights: total nights at that hotel (from the duration if per-hotel nights are absent).
- Do not output ids, images, galleries, colors or any field not listed above.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pull the JSON object out of a model reply (fences / stray prose tolerated). */
function parseModelJson(text) {
  const stripped = text
    .replace(/^\s*```(json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Réponse du modèle non-JSON");
    return JSON.parse(stripped.slice(start, end + 1));
  }
}

async function callModel(model, { text, images }, key) {
  const vision = images?.length > 0;
  const userContent = vision
    ? [
        {
          type: "text",
          text:
            "Voici les pages du PDF sous forme d'images (brochure scannée)." +
            (text?.trim() ? `\n\nTexte partiel extrait :\n${text}` : ""),
        },
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : text;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 12000, // large hotel tables produce long outputs — avoid truncation
      // several free vision providers reject response_format — rely on the
      // tolerant JSON parse for those instead
      ...(vision ? {} : { response_format: { type: "json_object" } }),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  const inner = body?.error?.code; // OpenRouter tunnels provider status here (200 + error body)
  if (!res.ok || inner) {
    const status = res.status !== 200 ? res.status : Number(inner) || 500;
    const msg = body?.error?.message || `HTTP ${status}`;
    const err = new Error(msg);
    // Try the next model on: unknown model (400/404), no credits (402),
    // gated model (403), upstream rate-limit (429), provider outage (5xx).
    err.nextModel =
      [400, 402, 403, 404, 429, 502, 503].includes(status) ||
      /model|not found|invalid|rate.?limit/i.test(msg);
    err.retryAfter = status === 429 ? 5000 : 0;
    err.status = status;
    throw err;
  }
  const reply = body.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = parseModelJson(reply);
  } catch (e) {
    // Truncated/garbled output — worth one retry, then the next model.
    const err = new Error(`JSON invalide du modèle : ${e.message}`);
    err.nextModel = true;
    err.retryAfter = 1000;
    throw err;
  }
  if (!parsed.basic || !parsed.data) {
    const err = new Error("Réponse du modèle incomplète (basic/data manquant)");
    err.nextModel = true;
    err.retryAfter = 1000;
    throw err;
  }
  parsed._model = model;
  return parsed;
}

/**
 * ONE LLM call: PDF content → { basic, data } following the schema above.
 * `content` is { text, images? } from extractPdfContent(). Unavailable
 * models (unknown id, credits, rate-limit) fall through the chain, with one
 * short-delay retry for upstream 429s on free models.
 */
export async function analyzePdf(content, { apiKey, models } = {}) {
  const key = apiKey || API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY manquant dans .env (exposé au client via vite envPrefix)."
    );
  }
  const payload = typeof content === "string" ? { text: content } : content;
  const chain = models || (payload.images?.length ? VISION_MODELS : TEXT_MODELS);
  let lastErr = null;
  for (const model of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, payload, key);
      } catch (e) {
        lastErr = e;
        if (e.retryAfter && attempt === 0) {
          await sleep(e.retryAfter);
          continue;
        }
        break;
      }
    }
    if (!lastErr?.nextModel) break; // real failure — don't spam other models
  }
  throw lastErr;
}

/** Backwards-compatible alias (text-only path). */
export const analyzePdfText = (text, opts) => analyzePdf({ text }, opts);

/* ── 3. Taxonomy diff & payload assembly ────────────────────────────────── */

/** accent/case-insensitive normalization for name comparison */
export const normalizeName = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Compare LLM taxonomy values against what exists.
 * @returns {{ matches: {country, continent, destinationId, tourId, adventureId},
 *             missing: Array<{type, typeLabel, name}> }}
 * `type` ∈ country|continent|destinations|tours|adventures.
 */
export function diffTaxonomy(basic, { countryOptions, continents, destinations, tours, adventures }) {
  const missing = [];
  const matches = { country: null, continent: null, destinationId: "", tourId: "", adventureId: "" };

  const findOption = (list, value) =>
    list.find((o) => normalizeName(o) === normalizeName(value));
  const findDoc = (docs, value) =>
    (docs || []).find((d) => normalizeName(d.name) === normalizeName(value));

  if (basic.country) {
    const hit = findOption(countryOptions, basic.country);
    if (hit) matches.country = hit;
    else missing.push({ type: "country", typeLabel: "Pays", name: basic.country });
  }
  if (basic.continent) {
    const hit = findOption(continents, basic.continent);
    if (hit) matches.continent = hit;
    else missing.push({ type: "continent", typeLabel: "Continent", name: basic.continent });
  }

  const collections = [
    { type: "destinations", typeLabel: "Destination", values: basic.destinations, docs: destinations, idKey: "destinationId" },
    { type: "tours", typeLabel: "Tour", values: basic.tours, docs: tours, idKey: "tourId" },
    { type: "adventures", typeLabel: "Adventure", values: basic.adventures, docs: adventures, idKey: "adventureId" },
  ];
  for (const { type, typeLabel, values, docs, idKey } of collections) {
    const seen = new Set();
    for (const value of values || []) {
      if (!value || seen.has(normalizeName(value))) continue;
      seen.add(normalizeName(value));
      const doc = findDoc(docs, value);
      if (doc) {
        if (!matches[idKey]) matches[idKey] = doc.$id; // first match feeds the select
      } else {
        missing.push({ type, typeLabel, name: value });
      }
    }
  }
  return { matches, missing };
}

/** Sane defaults for taxonomy docs created from the checklist. */
export function taxonomyCreatePayload(type, name) {
  switch (type) {
    case "destinations":
      return { name, emoji: "", listing: "", rating: "", gradient: "", status: "published" };
    case "tours":
      return { name, emoji: "", loc: "", nights: "", price: "", offer: "", status: "published" };
    case "adventures":
      return { name, emoji: "", category: "", gradient: "", status: "published" };
    default:
      return { name, status: "published" };
  }
}

let _uid = 100;
const uid = () => ++_uid;
const str = (v, fallback = "") => (typeof v === "string" ? v : v == null ? fallback : String(v));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Assemble the full editor data blob from the LLM's `data` — same shape the
 * package editor (PackageeditorPage) reads/writes, with ids and defaults.
 */
export function buildPackageData(llm, { title } = {}) {
  const d = llm?.data || {};
  const basic = llm?.basic || {};

  const sections = (Array.isArray(d.sections) ? d.sections : []).map((s) => ({
    id: uid(),
    title: str(s?.title, "Section"),
    icon: str(s?.icon, "📌"),
    badge: str(s?.badge),
    items: (Array.isArray(s?.items) ? s.items : []).map((it) => ({
      id: uid(),
      icon: str(it?.icon, "⭐"),
      text: str(it?.text),
    })),
  }));

  const days = (Array.isArray(d.days) ? d.days : []).map((day, i) => ({
    id: uid(),
    num: str(day?.num, String(i + 1).padStart(2, "0")),
    title: str(day?.title, `Jour ${i + 1}`),
    badge: str(day?.badge),
    theme: str(day?.theme),
    image: null,
    activities: (Array.isArray(day?.activities) ? day.activities : []).map((a) => ({
      id: uid(),
      label: str(a?.label),
      optional: !!a?.optional,
    })),
  }));

  const FIXED_HEADERS = ["Hôtel", "Ville", "Nuits", "★"];
  const hotelCategories = (Array.isArray(d.hotelCategories) ? d.hotelCategories : []).map((c) => {
    const roomCols = (Array.isArray(c?.tableHeaders) ? c.tableHeaders : [])
      .map((h) => str(h))
      .filter((h) => h && !FIXED_HEADERS.some((f) => normalizeName(f) === normalizeName(h)));
    const headers = [...FIXED_HEADERS, ...(roomCols.length ? roomCols : ["Double"])];
    const nCols = headers.length - FIXED_HEADERS.length;
    return {
      id: uid(),
      label: str(c?.label, "Formule"),
      basePrice: str(c?.basePrice, ""),
      tableHeaders: headers,
      hotels: (Array.isArray(c?.hotels) ? c.hotels : []).map((h) => {
        const cols = (Array.isArray(h?.cols) ? h.cols : []).map((v) => str(v, "0"));
        while (cols.length < nCols) cols.push("0");
        return {
          id: uid(),
          name: str(h?.name, "Hôtel"),
          city: str(h?.city),
          stars: Math.min(5, Math.max(1, num(h?.stars, 4))),
          nights: num(h?.nights, 0),
          cols: cols.slice(0, nCols),
          allotment: [],
          blockWhenFull: false,
        };
      }),
      note: str(c?.note),
    };
  });

  const DDMM = /^\d{2}\/\d{2}$/;
  const departureDates = (Array.isArray(d.departureDates) ? d.departureDates : [])
    .filter((x) => DDMM.test(str(x?.from)) && DDMM.test(str(x?.to)))
    .map((x) => ({ id: uid(), from: x.from, to: x.to }));

  const suppliments = (Array.isArray(d.suppliments) ? d.suppliments : []).map((s, i) => ({
    id: uid(),
    key: str(s?.key, `sup-${i + 1}`),
    label: str(s?.label),
    icon: str(s?.icon, "⭐"),
    pricePerPax: num(s?.pricePerPax, 0),
  }));

  return {
    id: 1,
    agency1: "Asfari Voyage",
    agency1Sub: "Agence de voyage et tourisme",
    agency2: "Follow Me Travel",
    agency2Sub: "www.followmetravel.ma",
    durationLabel: str(d.durationLabel),
    destination: str(d.destination, str(title, "").toUpperCase()),
    destinationAccent: str(d.destinationAccent),
    subtitleItalic: str(d.subtitleItalic),
    tagline: str(d.tagline),
    periodLabel: str(d.periodLabel),
    basePrice: num(d.basePrice ?? basic.basePrice, 0),
    currency: str(d.currency, "DH"),
    priceFromLabel: "À partir de",
    heroBg: null,
    gallery: [],
    sections,
    tabs: [
      { id: "itinerary", label: "Itinéraire" },
      { id: "gallery", label: "Galerie" },
      { id: "hotels", label: "Hôtels & Tarifs" },
      { id: "dates", label: "Dates" },
    ],
    itineraryTitle: str(d.itineraryTitle),
    days,
    hotelCategories,
    departureDates,
    suppliments,
    ctaLabel: "Réserver maintenant",
    phone1: str(d.phone1, "0664 586 425"),
    phone2: str(d.phone2, "0608 800 854"),
    website: str(d.website, "www.followmetravel.ma"),
  };
}
