import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { toCaller } from "../auth/users";
import { badRequest, forbidden, unauthorized } from "../common/errors";
import { uniqueId } from "../common/ids";
import { DbService } from "../db/db.service";
import { AnalyticsService } from "./analytics.service";

const MAX_BATCH = 50;
const MAX_EVENT_BYTES = 4_000;
// Attributs acceptés d'un événement analytics (tout le reste est ignoré).
const FIELDS = [
  "event", "category", "action", "label", "targetId", "page", "data", "sessionId", "userId",
  "device", "country", "createdAt", "source", "medium", "campaign", "referrer", "landing", "lang", "tz",
];
const DAY = 86_400_000;

@Controller("v1")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly db: DbService,
  ) {}

  /**
   * Envoi groupé des événements du site (une requête au lieu d'une par
   * événement ; utilisable en `keepalive` à la fermeture de l'onglet).
   */
  @Post("events/batch")
  @HttpCode(202)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async batch(@Body() body: Record<string, unknown>) {
    const list = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : null;
    if (!list) throw badRequest("events doit être une liste.");
    const rows: { id: string; data: string }[] = [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object" || typeof (raw as Record<string, unknown>).event !== "string") continue;
      const clean = Object.fromEntries(
        FIELDS.filter((f) => (raw as Record<string, unknown>)[f] !== undefined).map((f) => {
          const v = (raw as Record<string, unknown>)[f];
          return [f, typeof v === "string" ? v.slice(0, 1000) : v];
        }),
      );
      const json = JSON.stringify(clean);
      if (json.length <= MAX_EVENT_BYTES) rows.push({ id: uniqueId(), data: json });
    }
    if (rows.length) {
      await this.db.query(
        `INSERT INTO documents (collection, id, data)
         SELECT 'events', r.id, r.data::jsonb FROM jsonb_to_recordset($1::jsonb) AS r(id text, data text)`,
        [JSON.stringify(rows)],
      );
    }
    return { accepted: rows.length };
  }

  /** Tableau de bord : période [from, to[ (AAAA-MM-JJ) comparée à la précédente. */
  @Get("analytics/summary")
  summary(@Req() req: Request, @Query("from") from?: string, @Query("to") to?: string) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!caller.isStaff) throw forbidden();
    const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T00:00:00Z`) : new Date(Math.ceil(Date.now() / DAY) * DAY);
    const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00Z`) : new Date(end.getTime() - 30 * DAY);
    if (!(start < end) || end.getTime() - start.getTime() > 400 * DAY) throw badRequest("Période invalide (400 jours au plus).");
    const length = end.getTime() - start.getTime();
    return this.analytics.summary({ from: start, to: end }, { from: new Date(start.getTime() - length), to: start });
  }
}
