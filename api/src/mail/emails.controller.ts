import { Body, Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { toCaller } from "../auth/users";
import { badRequest, forbidden, unauthorized } from "../common/errors";
import { EmailsService } from "./emails.service";

@Controller("v1/emails")
export class EmailsController {
  constructor(private readonly emails: EmailsService) {}

  @Post("trigger")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  trigger(@Body() body: Record<string, unknown>, @Req() req: Request) {
    if (typeof body.triggerKey !== "string" || typeof body.reservationId !== "string") {
      throw badRequest("triggerKey et reservationId sont requis.");
    }
    return this.emails.trigger(body.triggerKey, body.reservationId, toCaller(req.user));
  }

  /** Relance manuelle d'un client qui a abandonné une réservation (équipe). */
  @Post("abandon-followup")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  abandon(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!caller.isStaff) throw forbidden();
    if (typeof body.userId !== "string" || typeof body.packageId !== "string") throw badRequest("userId et packageId sont requis.");
    return this.emails.abandonFollowup(body.userId, body.packageId, caller);
  }

  @Post("test")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  test(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!caller.isAdmin) throw forbidden();
    if (typeof body.templateId !== "string" || typeof body.to !== "string") {
      throw badRequest("templateId et to sont requis.");
    }
    return this.emails.test(body.templateId, body.to.trim());
  }
}
