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
          Permission.read(Role.any()),
          Permission.write(Role.any())
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