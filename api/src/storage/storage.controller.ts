import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { toCaller } from "../auth/users";
import { EDITORS, hasRole } from "../collections/policies";
import { badRequest, forbidden, unauthorized } from "../common/errors";
import { resolveId } from "../common/ids";
import { StorageService } from "./storage.service";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
// Images du catalogue (packages, hôtels, hero slides) et PDF. Pas de SVG :
// il peut embarquer du script, servi tel quel par MinIO.
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf)$/;

// Uploads depuis le dashboard (éditeur de packages, hôtels, hero slides) :
// admin et conseillers, comme l'édition du catalogue.
function requireEditor(req: Request) {
  const caller = toCaller(req.user);
  if (!caller) throw unauthorized();
  if (!hasRole(caller, EDITORS)) throw forbidden();
}

/** Mêmes chemins que l'API Appwrite `storage`, sans l'id de bucket. */
@Controller("v1/storage/files")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: Record<string, unknown>, @Req() req: Request) {
    requireEditor(req);
    if (!file) throw badRequest("Fichier manquant (champ `file`).", "storage_file_empty");
    if (!ALLOWED_MIME.test(file.mimetype)) {
      throw badRequest(`Type de fichier non autorisé : ${file.mimetype}`, "storage_file_type_unsupported");
    }
    const id = resolveId(body.fileId);
    if (!id) throw badRequest("fileId invalide.");

    await this.storage.put(id, file);
    const now = new Date().toISOString();
    return {
      $id: id,
      bucketId: "default",
      $createdAt: now,
      $updatedAt: now,
      $permissions: [],
      name: file.originalname,
      mimeType: file.mimetype,
      sizeOriginal: file.size,
      chunksTotal: 1,
      chunksUploaded: 1,
      url: this.storage.publicUrl(id),
    };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const stat = await this.storage.stat(id);
    const meta = stat.metaData ?? {};
    return {
      $id: id,
      bucketId: "default",
      $createdAt: stat.lastModified.toISOString(),
      $updatedAt: stat.lastModified.toISOString(),
      name: decodeURIComponent(meta["original-name"] ?? id),
      mimeType: meta["content-type"] ?? "application/octet-stream",
      sizeOriginal: stat.size,
      url: this.storage.publicUrl(id),
    };
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @Req() req: Request) {
    requireEditor(req);
    await this.storage.remove(id);
  }
}
