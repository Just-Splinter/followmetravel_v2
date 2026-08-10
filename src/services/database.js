// services/database.js

import { Databases, ID, Query } from "appwrite";
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
  EMAIL_TEMPLATES : "email_templates"
};
const databases = new Databases(client);

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

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