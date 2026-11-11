import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuditService } from "../audit/audit.service";
import { toCaller } from "../auth/users";
import { DocumentsService } from "../collections/documents.service";
import { STAFF, hasRole, type Caller } from "../collections/policies";
import { badRequest, forbidden, notFound, unauthorized } from "../common/errors";
import { FinanceService } from "../finance/finance.service";
import { EmailsService } from "../mail/emails.service";
import { DOCUMENT_TYPES, DocumentType, PdfService } from "../pdf/pdf.service";
import { ReservationsService } from "./reservations.service";

// Ce qu'un client peut télécharger sur son propre dossier, et à partir de quand.
const CLIENT_DOCUMENTS: Record<DocumentType, (r: Record<string, unknown>) => boolean> = {
  reservation: () => true,
  cgv: () => true,
  // Proforma tant que la facture définitive n'est pas émise.
  facture: () => true,
  devis: () => true,
  programme: () => true,
  echeancier: (r) => r.status !== "cancelled",
  contrat: (r) => ["confirmed", "paid", "completed"].includes(String(r.status)),
  voucher: (r) => ["paid", "completed"].includes(String(r.status)),
  recu: () => true,
};

@Controller("v1/reservations")
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly docs: DocumentsService,
    private readonly finance: FinanceService,
    private readonly pdf: PdfService,
    private readonly audit: AuditService,
    private readonly emails: EmailsService,
  ) {}

  /** Équipe : tout dossier ; client : seulement le sien (sinon 404, sans révéler l'existence). */
  private async access(id: string, req: Request): Promise<{ caller: Caller; staff: boolean; data: Record<string, unknown> }> {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    const row = await this.docs.findRow("reservations", id);
    const staff = hasRole(caller, STAFF);
    if (!staff && row.data.userId !== caller.id) throw notFound("document_not_found", "Réservation introuvable.");
    return { caller, staff, data: row.data };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    if (!req.user) throw unauthorized();
    return this.reservations.create(body, req.user);
  }

  /** Échéancier, paiements, reste dû (et coûts pour l'équipe). */
  @Get(":id/finance")
  async financeOf(@Param("id") id: string, @Req() req: Request) {
    const { staff } = await this.access(id, req);
    const finance = await this.finance.reservationFinance(id);
    if (!staff) {
      const { costs: _costs, ...rest } = finance;
      return rest;
    }
    return { ...finance, margin: finance.total - finance.costs };
  }

  /**
   * Validation par le client, depuis son espace : il a lu la fiche de
   * réservation et accepte les conditions de vente et d'annulation. Le statut
   * ne change pas (la confirmation reste celle de l'agence).
   */
  @Post(":id/validate")
  async validate(@Param("id") id: string, @Req() req: Request) {
    const { caller, data } = await this.access(id, req);
    if (data.userId !== caller.id) throw forbidden("Seul le client titulaire du dossier peut le valider.");
    if (data.clientValidatedAt) return { clientValidatedAt: data.clientValidatedAt };
    if (!["pending", "confirmed"].includes(String(data.status))) throw badRequest("Ce dossier ne peut plus être validé.");
    const clientValidatedAt = new Date().toISOString();
    await this.docs.patch("reservations", id, { clientValidatedAt });
    await this.audit.record({ caller, collection: "reservations", documentId: id, action: "update", message: "Fiche de réservation et conditions de vente validées par le client" });
    this.emails.notifyClientValidation(id).catch(() => {});
    return { clientValidatedAt };
  }

  /** Équipe : envoie au client la fiche de réservation, la facture et les conditions de vente. */
  @Post(":id/send-documents")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async sendDocuments(@Param("id") id: string, @Req() req: Request) {
    const { caller, staff } = await this.access(id, req);
    if (!staff) throw forbidden();
    return this.emails.sendReservationDocuments(id, caller);
  }

  /**
   * Équipe : message libre au client sur ce dossier — dans sa boîte de
   * réception (espace client) et par email quand l'envoi est configuré.
   */
  @Post(":id/message")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async message(@Param("id") id: string, @Req() req: Request, @Body() body: Record<string, unknown>) {
    const { caller, staff } = await this.access(id, req);
    if (!staff) throw forbidden();
    const subject = String(body.subject ?? "").trim().slice(0, 200);
    const text = String(body.message ?? "").trim().slice(0, 5000);
    if (!subject || !text) throw badRequest("Objet et message obligatoires.");
    return this.emails.sendClientMessage(id, caller, subject, text);
  }

  /** Émission de la facture (numéro définitif) — admin et comptable. */
  @Post(":id/invoice")
  async invoice(@Param("id") id: string, @Req() req: Request) {
    const caller = toCaller(req.user);
    if (!caller) throw unauthorized();
    if (!hasRole(caller, ["admin", "accounting"])) throw forbidden("Émission des factures : admin ou comptable.");
    const result = await this.reservations.issueInvoice(id);
    if (result.created) {
      await this.audit.record({ caller, collection: "reservations", documentId: id, action: "document", message: `Facture ${result.invoiceNumber} émise` });
    }
    return result;
  }

  @Get(":id/documents/:type")
  async document(
    @Param("id") id: string,
    @Param("type") type: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query("paymentId") paymentId?: string,
    @Query("hotel") hotel?: string,
    @Query("download") download?: string,
  ) {
    const kind = type.replace(/\.pdf$/, "") as DocumentType;
    if (!DOCUMENT_TYPES.includes(kind)) throw badRequest(`Document inconnu : ${type}`);
    const { staff, data } = await this.access(id, req);
    if (!staff && !CLIENT_DOCUMENTS[kind](data)) throw forbidden("Ce document n'est pas encore disponible.");
    const hotelIndex = hotel !== undefined && hotel !== "" ? Number(hotel) : undefined;
    if (hotelIndex !== undefined && (!Number.isInteger(hotelIndex) || hotelIndex < 0)) throw badRequest("Paramètre hotel invalide.");
    const doc = await this.pdf.render(kind, id, { paymentId, hotel: hotelIndex });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.filename}"`,
      "Cache-Control": "private, no-store",
    });
    res.send(doc.buffer);
  }
}
