import { Injectable, Logger } from "@nestjs/common";
import { notFound } from "../common/errors";
import { uniqueId } from "../common/ids";
import { DbService } from "../db/db.service";
import { DocumentsService } from "../collections/documents.service";

/** Message enregistré dans la boîte de réception du client. */
export interface InboxMessage {
  /** Destinataire (minuscules) — rattache aussi les messages d'avant la création du compte. */
  email: string;
  userId?: string | null;
  subject: string;
  html: string;
  /** Déclencheur (reservation_confirmed, documents, booking_abandoned…). */
  kind: string;
  reservationId?: string | null;
  /** Documents PDF joints à l'email (types de PdfService), re-téléchargeables depuis l'espace client. */
  attachments?: string[];
}

const MAX_HTML = 200_000;

/**
 * Boîte de réception de l'espace client : une copie de chaque email envoyé au
 * client (collection `messages`, lisible par l'équipe seulement via l'API
 * générique ; le client lit les siens par /v1/inbox, filtrés par son compte).
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly db: DbService,
    private readonly docs: DocumentsService,
  ) {}

  /** Au mieux : un échec d'enregistrement n'empêche jamais l'email de partir. */
  async record(m: InboxMessage) {
    const email = String(m.email ?? "").trim().toLowerCase();
    if (!email && !m.userId) return;
    try {
      await this.docs.insert("messages", uniqueId(), {
        email,
        userId: m.userId || null,
        subject: String(m.subject ?? "").slice(0, 300),
        html: String(m.html ?? "").slice(0, MAX_HTML),
        kind: m.kind,
        reservationId: m.reservationId || null,
        attachments: m.attachments ?? [],
        readAt: null,
      });
    } catch (err) {
      this.logger.warn(`message non enregistré (${m.kind} → ${email}) : ${(err as Error).message}`);
    }
  }

  /** Messages du compte : par identifiant, ou par email (messages antérieurs au compte). */
  async list(user: { id: string; email: string }) {
    const { rows } = await this.db.query<{ id: string; data: Record<string, unknown>; created_at: Date }>(
      `SELECT id, data, created_at FROM documents
        WHERE collection = 'messages' AND (data->>'userId' = $1 OR lower(data->>'email') = $2)
        ORDER BY created_at DESC LIMIT 200`,
      [user.id, String(user.email ?? "").toLowerCase()],
    );
    return {
      messages: rows.map((r) => ({
        $id: r.id,
        $createdAt: r.created_at.toISOString(),
        subject: r.data.subject ?? "",
        html: r.data.html ?? "",
        kind: r.data.kind ?? "",
        reservationId: r.data.reservationId ?? null,
        attachments: Array.isArray(r.data.attachments) ? r.data.attachments : [],
        readAt: r.data.readAt ?? null,
      })),
    };
  }

  async markRead(user: { id: string; email: string }, id: string) {
    const { rows } = await this.db.query<{ id: string }>(
      `UPDATE documents SET data = data || jsonb_build_object('readAt', to_jsonb(now()::text)), updated_at = now()
        WHERE collection = 'messages' AND id = $1
          AND (data->>'userId' = $2 OR lower(data->>'email') = $3)
          AND data->>'readAt' IS NULL
        RETURNING id`,
      [id, user.id, String(user.email ?? "").toLowerCase()],
    );
    if (!rows.length) {
      // Déjà lu, ou pas à ce compte : on ne distingue pas (pas de fuite d'existence).
      const owned = await this.db.query(
        `SELECT 1 FROM documents WHERE collection = 'messages' AND id = $1 AND (data->>'userId' = $2 OR lower(data->>'email') = $3)`,
        [id, user.id, String(user.email ?? "").toLowerCase()],
      );
      if (!owned.rows.length) throw notFound("document_not_found", "Message introuvable.");
    }
    return { read: true };
  }
}
