import { Storage, ID, Permission, Role } from "appwrite";
import { client } from "./appwrite";

const storage = new Storage(client);

const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;

class StorageService {

  async upload(file) {
    try {
      const response = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        file,
        [
          // Public read: these are hero photos and package images served to
          // anonymous visitors. Update/delete restricted to the admin label —
          // every upload call site is an admin-only /dashboard page (package
          // editor, hotels, hero slides), no customer ever needs write here.
          // Role.users() would let any logged-in customer overwrite or delete
          // every asset in the bucket, not just their own — this was widened
          // once already (from Role.any()) but not far enough.
          Permission.read(Role.any()),
          Permission.update(Role.label("admin")),
          Permission.delete(Role.label("admin")),
        ]
      );

      return response;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async get(id) {
    return await storage.getFile(BUCKET_ID, id);
  }

  getPreview(id) {
    return storage.getFilePreview(BUCKET_ID, id);
  }

  getView(id) {
    return storage.getFileView(BUCKET_ID, id);
  }

  async delete(id) {
    return await storage.deleteFile(BUCKET_ID, id);
  }
}

export default new StorageService;