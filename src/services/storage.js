// Fichiers (images des packages, hôtels, hero slides) — stockés dans MinIO
// via l'API. Upload réservé aux comptes admin (vérifié par l'API) ; lecture
// publique directe depuis MinIO : `${VITE_MEDIA_URL}/${fileId}`.
import { request } from "./api";
import { ID } from "./database";

const MEDIA_URL = (import.meta.env.VITE_MEDIA_URL || "").replace(/\/$/, "");

class StorageService {

  /** @returns {Promise<{ $id: string, name: string, mimeType: string, sizeOriginal: number, url: string }>} */
  async upload(file) {
    try {
      const form = new FormData();
      form.append("fileId", ID.unique());
      form.append("file", file);
      return await request("POST", "/v1/storage/files", { body: form });
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async get(id) {
    return request("GET", `/v1/storage/files/${encodeURIComponent(id)}`);
  }

  // Pas de redimensionnement côté serveur : l'aperçu est l'image d'origine.
  getPreview(id) {
    return this.getView(id);
  }

  getView(id) {
    return `${MEDIA_URL}/${encodeURIComponent(id)}`;
  }

  async delete(id) {
    return request("DELETE", `/v1/storage/files/${encodeURIComponent(id)}`);
  }
}

export default new StorageService;
