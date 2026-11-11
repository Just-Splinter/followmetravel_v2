// Lien catalogue d'hôtels ↔ packages : quels packages (et formules)
// utilisent un hôtel, et report d'un changement de nom / ville / étoiles sur
// les lignes de ces packages (les tarifs restent propres à chaque package).
import db, { Collections } from "./database";

const blobOf = (doc) => {
  try {
    return typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data || {};
  } catch {
    return {};
  }
};

/** hotelId → [{ packageId, title, status, formules: [label] }] */
export function hotelUsage(products) {
  const usage = {};
  for (const p of products) {
    const blob = blobOf(p);
    if (blob.kind) continue; // réglages du site
    for (const cat of blob.hotelCategories || []) {
      for (const h of cat.hotels || []) {
        if (!h.hotelId) continue;
        const list = (usage[h.hotelId] ??= []);
        let entry = list.find((e) => e.packageId === p.$id);
        if (!entry) {
          entry = { packageId: p.$id, title: p.title || blob.destination || p.$id, status: p.status, formules: [] };
          list.push(entry);
        }
        if (cat.label && !entry.formules.includes(cat.label)) entry.formules.push(cat.label);
      }
    }
  }
  return usage;
}

export async function loadHotelUsage() {
  const res = await db.listAll(Collections.PRODUCTS);
  return { products: res.documents, usage: hotelUsage(res.documents) };
}

/**
 * Reporte nom / ville / étoiles d'un hôtel du catalogue sur toutes les lignes
 * de package qui y sont reliées. Renvoie le nombre de packages modifiés.
 */
export async function propagateHotel(products, hotel) {
  let updated = 0;
  for (const p of products) {
    const blob = blobOf(p);
    if (blob.kind) continue;
    let changed = false;
    for (const cat of blob.hotelCategories || []) {
      cat.hotels = (cat.hotels || []).map((h) => {
        if (h.hotelId !== hotel.$id) return h;
        if (h.name === hotel.name && h.city === hotel.city && Number(h.stars) === Number(hotel.stars)) return h;
        changed = true;
        return { ...h, name: hotel.name, city: hotel.city, stars: hotel.stars };
      });
    }
    if (changed) {
      await db.update(Collections.PRODUCTS, p.$id, { data: JSON.stringify(blob) });
      updated += 1;
    }
  }
  return updated;
}
