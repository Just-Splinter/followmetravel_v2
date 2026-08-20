// services/database.js

import { Databases, ID, Query, Permission, Role } from "appwrite";
import { client } from "./appwrite";

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
  CLIENTS : "clients"
};

// Explicit per-document permissions set at creation time, so the right
// access model holds regardless of how each collection's console defaults
// are configured. Every collection these apply to is only ever written to
// from an admin-only /dashboard page — no customer-facing code creates a
// product, destination, tour, adventure, team member, testimonial, news
// item or email template.
export const PUBLIC_CATALOG_PERMISSIONS = [
  Permission.read(Role.any()),
  Permission.update(Role.label("admin")),
  Permission.delete(Role.label("admin")),
];

// A product's `status` values that make it visible on the public site.
// "draft" and "archived" (and anything unset/unrecognized) stay hidden —
// shared between TravelDataContext (listings) and PackageViewerContext
// (direct /packages/view?pkgId= access) so the two can't drift apart.
export const PUBLIC_PACKAGE_STATUSES = ["active", "published"];

export const ADMIN_ONLY_PERMISSIONS = [
  Permission.read(Role.label("admin")),
  Permission.update(Role.label("admin")),
  Permission.delete(Role.label("admin")),
];
const databases = new Databases(client);

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

// Appwrite caps a single page at 100 documents.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

class DatabaseService {
  async create(collectionId, data, documentId = ID.unique(), permissions = []) {
    return databases.createDocument(
      DATABASE_ID,
      collectionId,
      documentId,
      data,
      permissions
    );
  }

  async get(collectionId, documentId) {
    return databases.getDocument(
      DATABASE_ID,
      collectionId,
      documentId
    );
  }

  async list(collectionId, queries = []) {
    return databases.listDocuments(
      DATABASE_ID,
      collectionId,
      queries
    );
  }

  /**
   * Every document of a collection, cursor-paginated.
   *
   * `list()` inherits Appwrite's default page size of 25. That silently
   * truncated the public site, because the hero slides, the omra config and
   * the contact settings are singletons stored *inside* `products` — past 25
   * products they fell off the first page and the sections went blank. Use
   * this for any read that must see the whole collection.
   */
  async listAll(collectionId, queries = [], pageSize = PAGE_SIZE) {
    const documents = [];
    let cursor = null;

    // Hard stop so a pathological collection can never spin forever.
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await databases.listDocuments(DATABASE_ID, collectionId, [
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
    const res = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries,
      Query.limit(1),
    ]);
    return res.total ?? 0;
  }

  async update(collectionId, documentId, data) {
    return databases.updateDocument(
      DATABASE_ID,
      collectionId,
      documentId,
      data
    );
  }

  async delete(collectionId, documentId) {
    return databases.deleteDocument(
      DATABASE_ID,
      collectionId,
      documentId
    );
  }
}

export default new DatabaseService();

export { Query, ID };