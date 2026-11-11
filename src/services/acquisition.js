// Provenance d'une visite (premier contact de la session) : paramètres utm_*,
// identifiants de clic publicitaire, sinon site référent, sinon « direct ».
// Ajoutée à chaque événement analytics pour mesurer ce que rapporte chaque
// canal (Meta Ads, Google, Instagram, WhatsApp, newsletter…).

const SOCIAL = {
  "facebook.com": "facebook", "m.facebook.com": "facebook", "l.facebook.com": "facebook", "lm.facebook.com": "facebook",
  "instagram.com": "instagram", "l.instagram.com": "instagram",
  "tiktok.com": "tiktok", "youtube.com": "youtube", "linkedin.com": "linkedin", "x.com": "x", "t.co": "x",
  "wa.me": "whatsapp", "web.whatsapp.com": "whatsapp",
};
// Moteurs de recherche : nom fixe (google.co.ma, google.fr… → « google »).
const SEARCH = [["google.", "google"], ["bing.com", "bing"], ["yahoo.", "yahoo"], ["duckduckgo.com", "duckduckgo"], ["ecosia.org", "ecosia"]];

/**
 * @param {string} search  window.location.search
 * @param {string} referrer document.referrer
 * @param {string} host     window.location.host (référent interne ignoré)
 */
export function detectAcquisition(search, referrer, host) {
  const params = new URLSearchParams(search || "");
  const utm = (k) => (params.get(`utm_${k}`) || "").trim().toLowerCase().slice(0, 80);
  if (utm("source")) {
    return { source: utm("source"), medium: utm("medium"), campaign: utm("campaign") };
  }
  if (params.get("fbclid")) return { source: "facebook", medium: "paid_social", campaign: "" };
  if (params.get("gclid")) return { source: "google", medium: "cpc", campaign: "" };
  if (params.get("ttclid")) return { source: "tiktok", medium: "paid_social", campaign: "" };

  let refHost = "";
  try {
    refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    refHost = "";
  }
  if (!refHost || refHost === String(host || "").replace(/^www\./, "")) {
    return { source: "direct", medium: "", campaign: "" };
  }
  if (SOCIAL[refHost]) return { source: SOCIAL[refHost], medium: "social", campaign: "" };
  const engine = SEARCH.find(([needle]) => refHost.includes(needle));
  if (engine) return { source: engine[1], medium: "organic", campaign: "" };
  return { source: refHost, medium: "referral", campaign: "" };
}

/** Le contact d'un lien cliqué (téléphone, email, WhatsApp), ou null. */
export function contactKind(href) {
  const h = String(href || "");
  if (h.startsWith("tel:")) return "phone";
  if (h.startsWith("mailto:")) return "email";
  if (/(^https?:\/\/)?(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//.test(h)) return "whatsapp";
  return null;
}
