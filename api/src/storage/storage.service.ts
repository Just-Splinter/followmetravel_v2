import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import { CONFIG, Config } from "../config";
import { notFound } from "../common/errors";

/**
 * Fichiers dans MinIO (remplace le bucket Appwrite Storage). La clé de
 * l'objet est l'id du fichier, comme l'id Appwrite : les URLs publiques sont
 * `${MEDIA_PUBLIC_URL}/${id}`, et les fichiers migrés gardent leur id.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    const { endPoint, port, useSSL, accessKey, secretKey } = config.s3;
    this.client = new Client({ endPoint, port, useSSL, accessKey, secretKey });
  }

  async onModuleInit() {
    // Le bucket et sa politique de lecture publique sont créés par le Job
    // minio-bucket-init (infra/k8s) ; ici on vérifie seulement l'accès.
    const exists = await this.client.bucketExists(this.config.s3.bucket).catch((err: Error) => {
      this.logger.error(`MinIO injoignable : ${err.message}`);
      return false;
    });
    if (!exists) this.logger.warn(`bucket "${this.config.s3.bucket}" absent ou inaccessible`);
  }

  publicUrl(id: string) {
    return `${this.config.s3.publicUrl}/${encodeURIComponent(id)}`;
  }

  async put(id: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }) {
    await this.client.putObject(this.config.s3.bucket, id, file.buffer, file.size, {
      "Content-Type": file.mimetype,
      // Images servies directement par MinIO : cache long, l'id ne change jamais de contenu.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Nom d'origine encodé : les en-têtes de métadonnées S3 doivent rester ASCII.
      "X-Amz-Meta-Original-Name": encodeURIComponent(file.originalname),
    });
  }

  async stat(id: string) {
    try {
      return await this.client.statObject(this.config.s3.bucket, id);
    } catch {
      throw notFound("storage_file_not_found", "Fichier introuvable.");
    }
  }

  async remove(id: string) {
    await this.stat(id);
    await this.client.removeObject(this.config.s3.bucket, id);
  }
}
