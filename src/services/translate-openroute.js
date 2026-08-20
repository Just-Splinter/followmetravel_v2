// Automatic content translation for dashboard-authored products.
// One OpenRouter call per product: the full translatable subset is sent as
// JSON and the model returns { en: {…}, ar: {…} } with the exact same shape.
// The result is stored inside the product's `data.i18n` and overlaid on the
// original content by `localizeData()` when the visitor's locale is en/ar.

const API_KEY =
  import.meta.env.OPENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;

// Cheap-first model chain; unknown ids fall through to the next one.
const MODELS = [
  import.meta.env.VITE_OPENROUTER_MODEL,
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4",
  "deepseek/deepseek-chat",
].filter(Boolean);

/** True when a key is configured — callers can skip silently otherwise. */
export const translationConfigured = () => !!API_KEY;

/* ── translatable subset (same shape in, same shape out) ────────────────── */
const TOP_FIELDS = [
  "destination",
  "destinationAccent",
  "tagline",
  "subtitleItalic",
  "durationLabel",
  "periodLabel",
  "itineraryTitle",
  "priceFromLabel",
  "country",
];

const clean = (obj) => {
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) delete obj[k];
  });
  return obj;
};

export function extractTranslatable(data) {
  const out = {};
  TOP_FIELDS.forEach((f) => {
    if (typeof data?.[f] === "string" && data[f].trim()) out[f] = data[f];
  });
  if (Array.isArray(data?.sections)) {
    out.sections = data.sections.map((s) =>
      clean({
        title: s.title,
        badge: s.badge,
        items: (s.items || []).map((it) => clean({ text: it.text })),
      })
    );
  }
  if (Array.isArray(data?.days)) {
    out.days = data.days.map((d) =>
      clean({
        title: d.title,
        theme: d.theme,
        badge: d.badge,
        activities: (d.activities || []).map((a) => clean({ label: a.label })),
      })
    );
  }
  if (Array.isArray(data?.hotelCategories)) {
    out.hotelCategories = data.hotelCategories.map((c) => clean({ label: c.label }));
  }
  if (Array.isArray(data?.suppliments)) {
    out.suppliments = data.suppliments.map((sp) => clean({ label: sp.label }));
  }
  return clean(out);
}

/* deep overlay of a translated subset onto the original data (arrays by index) */
function overlay(base, tr) {
  if (tr == null) return base;
  if (Array.isArray(base) && Array.isArray(tr)) {
    return base.map((item, i) => overlay(item, tr[i]));
  }
  if (typeof base === "object" && base !== null && typeof tr === "object") {
    const out = { ...base };
    Object.keys(tr).forEach((k) => {
      if (k in out) out[k] = overlay(out[k], tr[k]);
    });
    return out;
  }
  if (typeof tr === "string" && tr.trim()) return tr;
  return base;
}

/** Localized copy of a product data blob for the given UI locale. */
export function localizeData(data, locale) {
  if (!data || locale === "fr" || !data.i18n?.[locale]) return data;
  const localized = overlay(data, data.i18n[locale]);
  localized.i18n = data.i18n;
  return localized;
}

/* ── the single LLM call ────────────────────────────────────────────────── */
async function callModel(model, source) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://followmetravel.ma",
      "X-Title": "FollowMeTravel CMS",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You translate travel-agency content. The user sends one JSON object in its original language (usually French). " +
            'Reply with ONLY a JSON object of the form {"en": <object>, "ar": <object>} where each is the input object with every string value translated to English / Arabic respectively. ' +
            "Keep the structure, keys and array lengths EXACTLY identical. Keep proper nouns (hotels, cities, brands), numbers, prices and dates unchanged. Natural, concise tourism copy.",
        },
        { role: "user", content: JSON.stringify(source) },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`;
    const notFound = res.status === 404 || res.status === 400 || /model|not found|invalid/i.test(msg);
    const err = new Error(msg);
    err.modelNotFound = notFound;
    throw err;
  }
  const text = body.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  if (!parsed.en || !parsed.ar) throw new Error("Model response missing en/ar");
  return parsed;
}

/**
 * Translate a product data blob → { en, ar } subsets (one API call).
 * Throws with a readable message when the key is missing or all models fail.
 */
export async function translateProductData(data) {
  if (!API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY manquant dans .env (préfixe exposé au client via vite envPrefix)."
    );
  }
  const source = extractTranslatable(data);
  if (!Object.keys(source).length) return null;

  let lastErr = null;
  for (const model of MODELS) {
    try {
      return await callModel(model, source);
    } catch (e) {
      lastErr = e;
      if (!e.modelNotFound) break; // real failure — don't spam other models
    }
  }
  throw lastErr;
}

/** Convenience: returns a copy of `data` with refreshed data.i18n. */
export async function withTranslations(data) {
  const tr = await translateProductData(data);
  if (!tr) return data;
  return { ...data, i18n: { en: tr.en, ar: tr.ar, at: new Date().toISOString() } };
}
