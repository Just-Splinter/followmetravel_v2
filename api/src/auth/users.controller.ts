import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { badRequest, forbidden, notFound, unauthorized } from "../common/errors";
import { DbService } from "../db/db.service";
import { ROLES, type Caller } from "../collections/policies";
import { AuthService, MIN_PASSWORD_LENGTH } from "./auth.service";
import { USER_COLUMNS, UserRow, rolesOf, toCaller } from "./users";

function requireCaller(req: Request): Caller {
  const caller = toCaller(req.user);
  if (!caller) throw unauthorized();
  return caller;
}

/** Vue d'un compte pour le dashboard (jamais le hash du mot de passe). */
function toMember(u: UserRow) {
  return {
    $id: u.id,
    email: u.email,
    name: u.name,
    roles: rolesOf(u.labels),
    status: u.status,
    google: !!u.google_sub,
    hasPassword: !!u.password_hash,
    accessedAt: u.accessed_at?.toISOString() ?? null,
    $createdAt: u.created_at.toISOString(),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanRoles(value: unknown): string[] {
  if (!Array.isArray(value)) throw badRequest("roles doit être une liste.");
  const roles = [...new Set(value.map(String))];
  const unknown = roles.filter((r) => !ROLES.includes(r as never));
  if (unknown.length) throw badRequest(`Rôle inconnu : ${unknown.join(", ")}`);
  return roles;
}

@Controller("v1/users")
export class UsersController {
  constructor(
    private readonly db: DbService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Équipe : tout compte staff voit la liste de l'équipe (attribution des
   * dossiers). `scope=all` (admin) : tous les comptes, clients compris.
   */
  @Get()
  async list(@Req() req: Request, @Query("scope") scope?: string, @Query("q") q?: string) {
    const caller = requireCaller(req);
    if (!caller.isStaff) throw forbidden();
    const all = scope === "all";
    if (all && !caller.isAdmin) throw forbidden();
    const params: unknown[] = [];
    const where: string[] = [];
    if (!all) where.push("labels && ARRAY['admin','agent','accounting']::text[]");
    if (q?.trim()) {
      params.push(`%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      where.push(`(email ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 500`,
      params,
    );
    return { total: rows.length, users: rows.map(toMember) };
  }

  /** Noms et emails de comptes précis (ex. relance des paniers abandonnés). */
  @Get("lookup")
  async lookup(@Req() req: Request, @Query("ids") ids = "") {
    const caller = requireCaller(req);
    if (!caller.isStaff) throw forbidden();
    const list = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (!list.length) return { users: [] };
    const { rows } = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ANY($1::text[])`, [list]);
    return { users: rows.map((u) => ({ $id: u.id, name: u.name, email: u.email })) };
  }

  /** Création d'un compte de l'équipe (ou d'un client) par l'admin. */
  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const caller = requireCaller(req);
    if (!caller.isAdmin) throw forbidden();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!EMAIL.test(email)) throw badRequest("Email invalide.");
    if (password.length < MIN_PASSWORD_LENGTH) throw badRequest(`Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum.`);
    if (await this.auth.findByEmail(email)) throw badRequest("Un compte existe déjà avec cet email.", "user_already_exists");
    const user = await this.auth.createUser({
      email,
      password,
      name: String(body.name ?? "").trim(),
      labels: cleanRoles(body.roles ?? []),
    });
    await this.audit.record({ caller, collection: "users", documentId: user.id, action: "create", changes: { email, roles: user.labels } });
    return toMember(user);
  }

  /** Nom, rôles, activation, nouveau mot de passe. */
  @Patch(":id")
  async update(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const caller = requireCaller(req);
    if (!caller.isAdmin) throw forbidden();
    const { rows } = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    const user = rows[0];
    if (!user) throw notFound("user_not_found", "Compte introuvable.");

    const sets: string[] = [];
    const params: unknown[] = [id];
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) {
      params.push(String(body.name).trim());
      sets.push(`name = $${params.length}`);
      changes.name = body.name;
    }
    if (body.roles !== undefined) {
      const roles = cleanRoles(body.roles);
      // Garde-fou : l'admin ne peut pas se retirer lui-même le rôle admin.
      if (id === caller.id && !roles.includes("admin")) throw badRequest("Vous ne pouvez pas retirer votre propre rôle admin.");
      // Les labels hors rôles (s'il y en a) sont conservés.
      const labels = [...user.labels.filter((l) => !ROLES.includes(l as never)), ...roles];
      params.push(labels);
      sets.push(`labels = $${params.length}`);
      changes.roles = roles;
    }
    if (body.status !== undefined) {
      if (id === caller.id && body.status === false) throw badRequest("Vous ne pouvez pas désactiver votre propre compte.");
      params.push(!!body.status);
      sets.push(`status = $${params.length}`);
      changes.status = !!body.status;
    }
    if (sets.length) {
      await this.db.query(`UPDATE users SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params);
      // Compte désactivé : ses sessions tombent immédiatement.
      if (body.status === false) await this.db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }
    if (body.password !== undefined) {
      await this.auth.setPassword(id, String(body.password));
      changes.password = "(modifié)";
    }
    if (Object.keys(changes).length) {
      await this.audit.record({ caller, collection: "users", documentId: id, action: "update", changes });
    }
    const fresh = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    return toMember(fresh.rows[0]);
  }
  /**
   * Suppression définitive d'un compte (admin). Ses sessions et jetons
   * partent avec lui (ON DELETE CASCADE) ; les dossiers qui lui étaient
   * assignés redeviennent non assignés. L'historique (journal) est conservé.
   */
  @Delete(":id")
  @HttpCode(200)
  async remove(@Req() req: Request, @Param("id") id: string) {
    const caller = requireCaller(req);
    if (!caller.isAdmin) throw forbidden();
    if (id === caller.id) throw badRequest("Vous ne pouvez pas supprimer votre propre compte.");
    const { rows } = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
    const user = rows[0];
    if (!user) throw notFound("user_not_found", "Compte introuvable.");
    if (user.labels.includes("admin")) {
      const admins = await this.db.query<{ n: string }>("SELECT count(*) AS n FROM users WHERE 'admin' = ANY(labels) AND status");
      if (Number(admins.rows[0].n) <= 1 && user.status) throw badRequest("Impossible de supprimer le dernier administrateur actif.");
    }
    const unassigned = await this.db.query(
      "UPDATE documents SET data = jsonb_set(data, '{assignedTo}', '\"\"'), updated_at = now() WHERE collection = 'reservations' AND data->>'assignedTo' = $1",
      [id],
    );
    await this.db.query("DELETE FROM users WHERE id = $1", [id]);
    await this.audit.record({
      caller, collection: "users", documentId: id, action: "delete",
      changes: { email: user.email, roles: rolesOf(user.labels), dossiersDésassignés: unassigned.rowCount ?? 0 },
    });
    return { deleted: true, unassigned: unassigned.rowCount ?? 0 };
  }
}
