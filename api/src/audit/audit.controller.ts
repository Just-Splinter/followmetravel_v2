import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { toCaller } from "../auth/users";
import { badRequest, forbidden, unauthorized } from "../common/errors";
import { DocumentsService } from "../collections/documents.service";
import { STAFF } from "../collections/policies";
import { AuditService } from "./audit.service";

// Historique consultable par l'équipe pour ces collections ; le journal
// complet (toutes collections, utilisateurs, connexions) est réservé à l'admin.
const STAFF_HISTORY = ["reservations", "clients"];

@Controller("v1/audit")
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly docs: DocumentsService,
  ) {}

  @Get()
  list(
    @Req() req: Request,
    @Query("collection") collection?: string,
    @Query("documentId") documentId?: string,
    @Query("userId") userId?: string,
    @Query("limit") limit = "50",
    @Query("offset") offset = "0",
  ) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!caller.isStaff) throw forbidden();
    const scopedToDocument = !!collection && STAFF_HISTORY.includes(collection) && !!documentId;
    if (!caller.isAdmin && !scopedToDocument) throw forbidden("Journal complet réservé à l'administrateur.");
    return this.audit.list({
      collection,
      documentId,
      userId,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
      offset: Math.max(Number(offset) || 0, 0),
    });
  }

  /** Note interne sur un dossier (« appelé le client, devis renvoyé »). */
  @Post("notes")
  async note(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!caller.roles.some((r) => STAFF.includes(r))) throw forbidden();
    const { collection, documentId, message } = body;
    if (typeof collection !== "string" || !STAFF_HISTORY.includes(collection)) throw badRequest("collection invalide.");
    if (typeof documentId !== "string" || typeof message !== "string" || !message.trim()) {
      throw badRequest("documentId et message sont requis.");
    }
    await this.docs.findRow(collection, documentId);
    await this.audit.record({ caller, collection, documentId, action: "note", message: message.trim().slice(0, 4000) });
    return { success: true };
  }
}
