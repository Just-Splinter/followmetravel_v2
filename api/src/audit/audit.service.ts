import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../db/db.service";
import type { Caller } from "../collections/policies";

export interface AuditEntry {
  id: string;
  at: string;
  userId: string | null;
  userName: string | null;
  collection: string;
  documentId: string;
  action: string;
  changes: unknown;
  message: string | null;
}

const MAX_VALUE_LENGTH = 300;

/** Valeur lisible dans un diff : les gros blobs JSON sont résumés, pas recopiés. */
function summarize(value: unknown): unknown {
  if (value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text && text.length > MAX_VALUE_LENGTH) return `${text.slice(0, MAX_VALUE_LENGTH)}… (${text.length} caractères)`;
  return value;
}

/** { attribut: [avant, après] } pour les attributs réellement modifiés. */
export function diff(before: Record<string, unknown>, patch: Record<string, unknown>) {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const [key, after] of Object.entries(patch)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after)) changes[key] = [summarize(before[key]), summarize(after)];
  }
  return changes;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DbService) {}

  /** Jamais bloquant : un audit raté est journalisé, l'action elle-même a déjà réussi. */
  async record(entry: {
    caller: Caller | null;
    collection: string;
    documentId: string;
    action: string;
    changes?: unknown;
    message?: string;
  }) {
    try {
      await this.db.query(
        `INSERT INTO audit_log (user_id, user_name, collection, document_id, action, changes, message)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          entry.caller?.id ?? null,
          entry.caller?.name ?? null,
          entry.collection,
          entry.documentId,
          entry.action,
          entry.changes === undefined ? null : JSON.stringify(entry.changes),
          entry.message ?? null,
        ],
      );
    } catch (err) {
      this.logger.error(`audit non enregistré (${entry.collection}/${entry.documentId}) : ${(err as Error).message}`);
    }
  }

  async list(filter: { collection?: string; documentId?: string; userId?: string; limit: number; offset: number }) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.collection) {
      params.push(filter.collection);
      where.push(`collection = $${params.length}`);
    }
    if (filter.documentId) {
      params.push(filter.documentId);
      where.push(`document_id = $${params.length}`);
    }
    if (filter.userId) {
      params.push(filter.userId);
      where.push(`user_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countParams = [...params];
    params.push(filter.limit, filter.offset);
    const [rows, count] = await Promise.all([
      this.db.query<{
        id: string; at: Date; user_id: string | null; user_name: string | null; collection: string;
        document_id: string; action: string; changes: unknown; message: string | null;
      }>(
        `SELECT * FROM audit_log ${whereSql} ORDER BY at DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      this.db.query<{ total: string }>(`SELECT count(*) AS total FROM audit_log ${whereSql}`, countParams),
    ]);
    const entries: AuditEntry[] = rows.rows.map((r) => ({
      id: String(r.id),
      at: r.at.toISOString(),
      userId: r.user_id,
      userName: r.user_name,
      collection: r.collection,
      documentId: r.document_id,
      action: r.action,
      changes: r.changes,
      message: r.message,
    }));
    return { total: Number(count.rows[0].total), entries };
  }
}
