import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { AuditService, diff } from "../audit/audit.service";
import { toCaller } from "../auth/users";
import { DocumentsService } from "../collections/documents.service";
import { EDITORS, STAFF, hasRole } from "../collections/policies";
import { CONFIG, Config } from "../config";
import { badRequest, forbidden, unauthorized } from "../common/errors";
import { PackageData, parseJSON, parsePrice } from "../reservations/pricing";
import { addDays, todayIso } from "../reservations/travel-dates";
import { FinanceService } from "./finance.service";
import { PlanningExportService } from "./planning-export";

function requireRoles(req: Request, roles: readonly ("admin" | "agent" | "accounting")[]) {
  const caller = toCaller(req.user);
  if (!caller) throw unauthorized();
  if (!hasRole(caller, roles)) throw forbidden();
  return caller;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

@Controller("v1")
export class OperationsController {
  constructor(
    private readonly finance: FinanceService,
    private readonly docs: DocumentsService,
    private readonly audit: AuditService,
    private readonly planningExport: PlanningExportService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Places restantes et suppléments par départ — public, sans aucune donnée client. */
  @Get("packages/:id/availability")
  availability(@Param("id") id: string) {
    return this.finance.availability(id);
  }

  /** Prochains départs du catalogue — public (home du site), sans donnée client. */
  @Get("departures/upcoming")
  upcoming(@Query("days") days?: string, @Query("limit") limit?: string) {
    const d = Math.min(Math.max(Number(days) || 90, 7), 365);
    const l = Math.min(Math.max(Number(limit) || 12, 1), 50);
    return this.finance.upcomingDepartures(d, l);
  }

  /** Planning des départs (équipe). Par défaut : 30 jours en arrière → 12 mois devant. */
  @Get("planning")
  planning(@Req() req: Request, @Query("from") from?: string, @Query("to") to?: string) {
    requireRoles(req, STAFF);
    const start = from && ISO.test(from) ? from : addDays(todayIso(), -30);
    const end = to && ISO.test(to) ? to : addDays(todayIso(), 365);
    if (end < start) throw badRequest("Période invalide.");
    return this.finance.planning(start, end);
  }

  /**
   * Planning de voyage « Asfari Voyage » (Excel) : tous les dossiers des
   * départs de la période, ou d'un seul départ (`packageId` + `start`).
   */
  @Get("planning/export")
  async exportPlanning(
    @Req() req: Request,
    @Res() res: Response,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("packageId") packageId?: string,
    @Query("start") start?: string,
  ) {
    requireRoles(req, STAFF);
    const single = start && ISO.test(start) ? start : undefined;
    const fromIso = single ?? (from && ISO.test(from) ? from : addDays(todayIso(), -30));
    const toIso = single ?? (to && ISO.test(to) ? to : addDays(todayIso(), 365));
    if (toIso < fromIso) throw badRequest("Période invalide.");
    const { buffer, filename } = await this.planningExport.build({ from: fromIso, to: toIso, packageId: packageId || undefined, start: single });
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    });
    res.send(buffer);
  }

  /** Créances : dossiers avec un reste à payer (équipe). */
  @Get("finance/receivables")
  receivables(@Req() req: Request) {
    requireRoles(req, STAFF);
    return this.finance.receivables();
  }

  /**
   * Relances de paiement. Appelé chaque matin par le CronJob (en-tête
   * X-Cron-Token), ou à la main par l'admin depuis le dashboard
   * (`dryRun=true` pour voir ce qui partirait).
   */
  @Post("jobs/payment-reminders")
  @HttpCode(200)
  async reminders(@Req() req: Request, @Headers("x-cron-token") token?: string, @Query("dryRun") dryRun?: string) {
    const expected = this.config.cronToken;
    const byCron =
      !!expected && !!token && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!byCron) requireRoles(req, ["admin", "accounting"]);
    return this.finance.sendPaymentReminders(dryRun === "true");
  }

  /**
   * Mise à jour de prix en masse : +/- % et/ou +/- DH sur les packages choisis
   * (prix « à partir de », tarifs des chambres, suppléments de départ),
   * arrondi au multiple voulu. Réservations existantes inchangées.
   */
  @Post("packages/bulk-price")
  async bulkPrice(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const caller = requireRoles(req, EDITORS);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    const percent = Number(body.percent) || 0;
    const amount = Number(body.amount) || 0;
    const roundTo = Math.max(1, Number(body.roundTo) || 10);
    const apply = (body.apply ?? {}) as Record<string, boolean>;
    if (!ids.length) throw badRequest("Aucun package sélectionné.");
    if (!percent && !amount) throw badRequest("Indiquez un pourcentage ou un montant.");
    if (percent <= -100) throw badRequest("Pourcentage invalide.");
    if (!apply.base && !apply.rooms && !apply.departures) throw badRequest("Choisissez au moins un prix à modifier.");

    const adjust = (v: number) => Math.max(0, Math.round((v * (1 + percent / 100) + amount) / roundTo) * roundTo);
    const results: { id: string; title: string; before: number; after: number }[] = [];

    for (const id of ids) {
      const row = await this.docs.findRow("products", id);
      const blob = parseJSON<PackageData & Record<string, any>>(row.data.data, {});
      const top: Record<string, unknown> = {};
      const before = Number(row.data.basePrice) || parsePrice(blob.basePrice);
      let after = before;
      if (apply.base && before > 0) {
        after = adjust(before);
        top.basePrice = after;
        blob.basePrice = String(after);
      }
      if (apply.rooms) {
        for (const cat of blob.hotelCategories || []) {
          for (const h of cat.hotels || []) {
            h.cols = (h.cols || []).map((c) => (parsePrice(c) > 0 ? String(adjust(parsePrice(c))) : c));
          }
        }
      }
      if (apply.departures) {
        for (const d of blob.departureDates || []) {
          const s = Number(d.supplement) || 0;
          // Seules les dates avec un supplément bougent ; une remise (négatif) suit le même %.
          if (s) d.supplement = s > 0 ? adjust(s) : -adjust(-s);
        }
      }
      const patch = { ...top, data: JSON.stringify(blob) };
      await this.docs.patch("products", id, patch);
      await this.audit.record({
        caller, collection: "products", documentId: id, action: "update",
        changes: { ...diff(row.data, top), prix: [`${percent ? `${percent > 0 ? "+" : ""}${percent} %` : ""}${amount ? ` ${amount > 0 ? "+" : ""}${amount} DH` : ""}`.trim(), Object.keys(apply).filter((k) => apply[k]).join(", ")] },
        message: "Mise à jour de prix en masse",
      });
      results.push({ id, title: String(row.data.title ?? ""), before, after });
    }
    return { updated: results.length, results };
  }
}
