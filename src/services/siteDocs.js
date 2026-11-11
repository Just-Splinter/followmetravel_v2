// La collection `products` mélange les packages et des documents de
// réglages du site (hero slides, omra, contact, notifications email, fiche
// agence) reconnaissables à leur `data.kind`. Ces deux règles décident de ce
// que le site public montre.
import { PUBLIC_PACKAGE_STATUSES } from "./database";

function kindOf(doc) {
  try {
    const data = typeof doc?.data === "string" ? JSON.parse(doc.data) : doc?.data;
    return data?.kind || null;
  } catch {
    return null;
  }
}

/** Document de réglages du site (pas un package à lister). L'omra est un produit affiché par sa propre page. */
export const isSiteDoc = (doc) => !!kindOf(doc);

/**
 * Package visible sur le site maintenant : statut publié/actif, et dans sa
 * fenêtre de publication programmée (publishAt / unpublishAt, AAAA-MM-JJ).
 */
export function isPubliclyVisible(doc, now = new Date()) {
  if (!PUBLIC_PACKAGE_STATUSES.includes(doc?.status)) return false;
  const today = now.toISOString().slice(0, 10);
  if (doc.publishAt && String(doc.publishAt).slice(0, 10) > today) return false;
  if (doc.unpublishAt && String(doc.unpublishAt).slice(0, 10) <= today) return false;
  return true;
}
