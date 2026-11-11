// services/database.js
//
// Documents des collections, servis par l'API (api/ — NestJS + PostgreSQL)
// avec le même contrat que le SDK Appwrite : documents { $id, $createdAt,
// $updatedAt, ...attributs }, listes { documents, total }, et Query.* qui
// produisent le même JSON qu'Appwrite. Les droits d'accès sont appliqués par
// l'API (api/src/collections/policies.ts), plus par des permissions par document.

import { request } from "./api";

export const Collections = {
  PRODUCTS: "products",
  DESTINATIONS: "destinations",
  TOURS: "tours",
  ADVENTURES: "adventures",
  TEAM: "team",
  TESTIMONIALS: "testimonials",
  NEWS: "news",
  RESERVATIONS : "reservations",
  EVENTS : "events",
  EMAIL_TEMPLATES : "email_templates",
  HOTELS : "hotels",
  CLIENTS : "clients",
  // Boîte de réception des clients (copies des emails) — lue par l'équipe.
  MESSAGES : "messages"
};

// A product's `status` values that make it visible on the public site.
// "draft" and "archived" (and anything unset/unrecognized) stay hidden —
// shared between TravelDataContext (listings) and PackageViewerContext
// (direct /packages/view?pkgId= access) so the two can't drift apart.
export const PUBLIC_PACKAGE_STATUSES = ["active", "published"];

const toValues = (value) => (Array.isArray(value) ? value : [value]);
const q = (method, attribute, values) =>
  JSON.stringify({ method, ...(attribute !== undefined ? { attribute } : {}), ...(values !== undefined ? { values } : {}) });

/** Mêmes signatures et même sérialisation que `Query` du SDK Appwrite. */
export const Query = {
  equal: (attribute, value) => q("equal", attribute, toValues(value)),
  notEqual: (attribute, value) => q("notEqual", attribute, toValues(value)),
  lessThan: (attribute, value) => q("lessThan", attribute, toValues(value)),
  lessThanEqual: (attribute, value) => q("lessThanEqual", attribute, toValues(value)),
  greaterThan: (attribute, value) => q("greaterThan", attribute, toValues(value)),
  greaterThanEqual: (attribute, value) => q("greaterThanEqual", attribute, toValues(value)),
  between: (attribute, start, end) => q("between", attribute, [start, end]),
  isNull: (attribute) => q("isNull", attribute),
  isNotNull: (attribute) => q("isNotNull", attribute),
  search: (attribute, value) => q("search", attribute, toValues(value)),
  contains: (attribute, value) => q("contains", attribute, toValues(value)),
  startsWith: (attribute, value) => q("startsWith", attribute, toValues(value)),
  endsWith: (attribute, value) => q("endsWith", attribute, toValues(value)),
  orderAsc: (attribute) => q("orderAsc", attribute),
  orderDesc: (attribute) => q("orderDesc", attribute),
  limit: (limit) => q("limit", undefined, [limit]),
  offset: (offset) => q("offset", undefined, [offset]),
  cursorAfter: (documentId) => q("cursorAfter", undefined, [documentId]),
};

export const ID = {
  /** Id au même gabarit qu'Appwrite (20 hex, préfixe horodaté) — généré localement. */
  unique: () => {
    const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
    const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
    return (time + random).slice(0, 20);
  },
};

const PAGE_SIZE = 500;
const MAX_PAGES = 50;

const path = (collectionId, documentId) =>
  `/v1/collections/${encodeURIComponent(collectionId)}/documents${documentId ? `/${encodeURIComponent(documentId)}` : ""}`;

class DatabaseService {
  async create(collectionId, data, documentId = ID.unique()) {
    return request("POST", path(collectionId), { body: { documentId, data } });
  }

  async get(collectionId, documentId) {
    return request("GET", path(collectionId, documentId));
  }

  /** Une page (25 documents par défaut, comme Appwrite — voir listAll). */
  async list(collectionId, queries = []) {
    return request("GET", path(collectionId), { query: { queries } });
  }

  /**
   * Every document of a collection, cursor-paginated.
   *
   * `list()` inherits the API's default page size of 25 (same as Appwrite).
   * That silently truncated the public site, because the hero slides, the
   * omra config and the contact settings are singletons stored *inside*
   * `products` — past 25 products they fell off the first page and the
   * sections went blank. Use this for any read that must see the whole
   * collection.
   */
  async listAll(collectionId, queries = [], pageSize = PAGE_SIZE) {
    const documents = [];
    let cursor = null;

    // Hard stop so a pathological collection can never spin forever.
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.list(collectionId, [
        ...queries,
        Query.limit(pageSize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ]);

      const batch = res.documents ?? [];
      documents.push(...batch);
      if (batch.length < pageSize) return { documents, total: documents.length };
      cursor = batch[batch.length - 1].$id;
    }

    console.warn(
      `[database] listAll(${collectionId}) hit the ${MAX_PAGES}-page ceiling ` +
        `(${documents.length} docs) — narrow the query or raise MAX_PAGES.`
    );
    return { documents, total: documents.length };
  }

  /** Server-side count matching `queries`, without downloading the documents. */
  async count(collectionId, queries = []) {
    const res = await this.list(collectionId, [...queries, Query.limit(1)]);
    return res.total ?? 0;
  }

  /** Mise à jour partielle : seuls les attributs fournis changent. */
  async update(collectionId, documentId, data) {
    return request("PATCH", path(collectionId, documentId), { body: { data } });
  }

  async delete(collectionId, documentId) {
    return request("DELETE", path(collectionId, documentId));
  }
}

export default new DatabaseService();
