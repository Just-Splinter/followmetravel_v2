import { Injectable } from "@nestjs/common";
import { AuditService, diff } from "../audit/audit.service";
import { ApiError, badRequest, forbidden, notFound, unauthorized } from "../common/errors";
import { resolveId } from "../common/ids";
import { DbService } from "../db/db.service";
import { travelPeriod } from "../reservations/travel-dates";
import { Caller, POLICIES, Policy, STAFF, allows, hasFullAccess, hasRole, todayUtc } from "./policies";
import { ParsedQuery, buildListPlan, cursorCondition } from "./query";
import { AgencyService } from "../agency/agency";
import { assertPassports } from "../reservations/passport";

export interface Row {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type Doc = Record<string, unknown> & { $id: string; $createdAt: string; $updatedAt: string };

/** Ligne SQL → document au format Appwrite. */
export function toDocument(row: Row): Doc {
  return {
    ...row.data,
    $id: row.id,
    $collectionId: row.collection,
    $databaseId: "default",
    $createdAt: row.created_at.toISOString(),
    $updatedAt: row.updated_at.toISOString(),
    $permissions: [],
  };
}

/** Retire les attributs système ($id, $createdAt…) qu'un client renverrait avec le document. */
export function stripSystemFields(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw badRequest("Le document doit être un objet JSON.", "document_invalid_structure");
  }
  return Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("$")));
}

/**
 * Réservations : fige l'année du voyage (travelStart / travelEnd) dès que
 * les dates JJ/MM sont fournies ou modifiées. `reference` = date de création.
 */
export function normalizeReservation(
  patch: Record<string, unknown>,
  current: Record<string, unknown>,
  reference: Date,
): Record<string, unknown> {
  if (patch.dateFrom === undefined && patch.dateTo === undefined) return patch;
  const period = travelPeriod(patch.dateFrom ?? current.dateFrom, patch.dateTo ?? current.dateTo, reference);
  return period ? { ...patch, ...period } : patch;
}

const COLUMNS = "collection, id, data, created_at, updated_at";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly agency: AgencyService,
  ) {}

  policy(collection: string): Policy {
    const policy = POLICIES[collection];
    if (!policy) throw notFound("collection_not_found", `Collection inconnue : ${collection}`);
    return policy;
  }

  private deny(caller: Caller | null): never {
    throw caller ? forbidden() : unauthorized();
  }

  private isOwner(policy: Policy, doc: Record<string, unknown>, caller: Caller | null) {
    return !!caller && !!policy.ownerField && doc[policy.ownerField] === caller.id;
  }

  /** Document tel que l'appelant a le droit de le voir (attributs internes retirés). */
  private present(policy: Policy, row: Row, caller: Caller | null): Doc {
    const doc = toDocument(row);
    if (policy.privateFields && !hasFullAccess(policy.read, caller, policy.privileged)) {
      for (const f of policy.privateFields) delete doc[f];
    }
    return doc;
  }

  private audited(policy: Policy) {
    return !policy.noAudit;
  }

  async list(collection: string, queries: ParsedQuery[], caller: Caller | null) {
    const policy = this.policy(collection);
    if (!allows(policy.read, caller)) this.deny(caller);

    const plan = buildListPlan(queries, [collection]);
    const where = ["collection = $1", ...plan.where];
    const params = [...plan.params];

    // Lecture "owner" non privilégiée : restreinte à ses propres documents,
    // quels que soient les filtres envoyés.
    if (!hasFullAccess(policy.read, caller, policy.privileged) && policy.ownerField) {
      params.push(caller!.id);
      where.push(`data->>'${policy.ownerField}' = $${params.length}::text`);
    }

    // Hors équipe : ni brouillons ni réglages internes, quels que soient les filtres.
    if (policy.publicView && !hasRole(caller, STAFF)) {
      where.push(policy.publicView.sql((value) => {
        params.push(value);
        return `$${params.length}`;
      }));
    }

    const countParams = [...params];
    const whereSql = where.join(" AND ");

    const pageWhere = [whereSql];
    if (plan.cursorAfter) {
      const exists = await this.db.query(
        "SELECT 1 FROM documents WHERE collection = $1 AND id = $2",
        [collection, plan.cursorAfter],
      );
      if (!exists.rowCount) throw badRequest(`Document curseur introuvable : ${plan.cursorAfter}`, "document_not_found");
      params.push(plan.cursorAfter);
      pageWhere.push(cursorCondition(plan.orderBy, `$${params.length}::text`));
    }

    const orderSql = plan.orderBy.map((o) => `${o.expr} ${o.dir}`).join(", ");
    params.push(plan.limit, plan.offset);
    const [page, count] = await Promise.all([
      this.db.query<Row>(
        `SELECT ${COLUMNS} FROM documents WHERE ${pageWhere.join(" AND ")} ORDER BY ${orderSql} LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      this.db.query<{ total: string }>(`SELECT count(*) AS total FROM documents WHERE ${whereSql}`, countParams),
    ]);

    return { total: Number(count.rows[0].total), documents: page.rows.map((r) => this.present(policy, r, caller)) };
  }

  async get(collection: string, id: string, caller: Caller | null) {
    const policy = this.policy(collection);
    if (!allows(policy.read, caller)) this.deny(caller);
    const row = await this.findRow(collection, id);
    const hidden = !!policy.publicView && !hasRole(caller, STAFF) && !policy.publicView.visible(row.data, todayUtc());
    if (hidden || (!hasFullAccess(policy.read, caller, policy.privileged) && policy.ownerField && !this.isOwner(policy, row.data, caller))) {
      // Même réponse qu'un document absent : ne pas révéler son existence.
      throw notFound("document_not_found", "Document introuvable.");
    }
    return this.present(policy, row, caller);
  }

  async create(collection: string, documentId: unknown, data: unknown, caller: Caller | null) {
    const policy = this.policy(collection);
    if (!allows(policy.create, caller)) this.deny(caller);
    const id = resolveId(documentId);
    if (!id) throw badRequest("documentId invalide.", "document_invalid_structure");
    let payload = stripSystemFields(data);
    if (collection === "reservations") payload = normalizeReservation(payload, {}, new Date());
    const doc = await this.insert(collection, id, payload);
    if (this.audited(policy)) await this.audit.record({ caller, collection, documentId: id, action: "create" });
    return this.present(policy, await this.findRow(collection, id), caller);
  }

  /** Insertion sans contrôle d'accès — pour les services serveur (réservations…). */
  async insert(collection: string, id: string, data: Record<string, unknown>) {
    try {
      const { rows } = await this.db.query<Row>(
        `INSERT INTO documents (collection, id, data) VALUES ($1, $2, $3::jsonb) RETURNING ${COLUMNS}`,
        [collection, id, JSON.stringify(data)],
      );
      return toDocument(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new ApiError(409, "document_already_exists", "Un document avec cet id existe déjà.");
      }
      throw err;
    }
  }

  async update(collection: string, id: string, data: unknown, caller: Caller | null) {
    const policy = this.policy(collection);
    if (!allows(policy.update, caller)) this.deny(caller);
    let patch = stripSystemFields(data);
    const row = await this.findRow(collection, id);

    if (!hasFullAccess(policy.update, caller, policy.privileged)) {
      if (policy.update === "owner" && !this.isOwner(policy, row.data, caller)) {
        throw notFound("document_not_found", "Document introuvable.");
      }
      const restricted = policy.restrictedUpdate;
      if (restricted) {
        const extra = Object.keys(patch).filter((k) => !restricted.fields.includes(k));
        if (extra.length || (restricted.check && !restricted.check(patch, row.data))) this.deny(caller);
      }
      if (policy.privateFields?.some((f) => f in patch)) this.deny(caller);
    }

    if (collection === "reservations") {
      patch = normalizeReservation(patch, row.data, row.created_at);
      if (patch.participants !== undefined) {
        const agency = await this.agency.get();
        assertPassports(patch.participants, row.data.participants, patch.travelEnd ?? row.data.travelEnd, agency.passportValidityMonths);
      }
    }
    const updated = await this.patch(collection, id, patch);
    if (this.audited(policy)) {
      const changes = diff(row.data, patch);
      if (Object.keys(changes).length) await this.audit.record({ caller, collection, documentId: id, action: "update", changes });
    }
    return this.present(policy, { ...row, data: { ...row.data, ...patch }, updated_at: new Date(updated.$updatedAt) }, caller);
  }

  /** Mise à jour partielle sans contrôle d'accès — pour les services serveur. */
  async patch(collection: string, id: string, patch: Record<string, unknown>) {
    const { rows } = await this.db.query<Row>(
      `UPDATE documents SET data = data || $3::jsonb, updated_at = now()
       WHERE collection = $1 AND id = $2 RETURNING ${COLUMNS}`,
      [collection, id, JSON.stringify(patch)],
    );
    if (!rows.length) throw notFound("document_not_found", "Document introuvable.");
    return toDocument(rows[0]);
  }

  async delete(collection: string, id: string, caller: Caller | null) {
    const policy = this.policy(collection);
    if (!allows(policy.delete, caller)) this.deny(caller);
    const { rows } = await this.db.query<{ data: Record<string, unknown> }>(
      "DELETE FROM documents WHERE collection = $1 AND id = $2 RETURNING data",
      [collection, id],
    );
    if (!rows.length) throw notFound("document_not_found", "Document introuvable.");
    if (this.audited(policy)) {
      const d = rows[0].data;
      await this.audit.record({
        caller, collection, documentId: id, action: "delete",
        message: String(d.ref ?? d.title ?? d.name ?? d.userName ?? ""),
      });
    }
  }

  /** Lecture sans contrôle d'accès — pour les services serveur. */
  async findRow(collection: string, id: string): Promise<Row> {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM documents WHERE collection = $1 AND id = $2`,
      [collection, id],
    );
    if (!rows.length) throw notFound("document_not_found", "Document introuvable.");
    return rows[0];
  }

  /** Toutes les lignes d'une collection (filtre SQL optionnel) — pour les services serveur. */
  async allRows(collection: string, where = "", params: unknown[] = []): Promise<Row[]> {
    const { rows } = await this.db.query<Row>(
      `SELECT ${COLUMNS} FROM documents WHERE collection = $1 ${where ? `AND ${where}` : ""} ORDER BY created_at`,
      [collection, ...params],
    );
    return rows;
  }
}
