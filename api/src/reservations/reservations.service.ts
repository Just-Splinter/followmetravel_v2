import { Inject, Injectable, Logger } from "@nestjs/common";
import { AgencyService } from "../agency/agency";
import { AuditService } from "../audit/audit.service";
import { CONFIG, Config } from "../config";
import { ApiError, badRequest, notFound } from "../common/errors";
import { uniqueId } from "../common/ids";
import { DocumentsService, toDocument, type Row } from "../collections/documents.service";
import { DbService } from "../db/db.service";
import { ACTIVE_STATUSES } from "../finance/finance.service";
import { reservationTravel } from "../finance/schedule";
import { EmailsService } from "../mail/emails.service";
import type { UserRow } from "../auth/users";
import { assertPassports } from "./passport";
import { computeServerPrice, findDeparture, normalizeSupplements, parseJSON, type PackageData } from "./pricing";
import { travelPeriod } from "./travel-dates";

const REQUIRED_FIELDS = ["packageId", "dateFrom", "dateTo", "totalPax"];

function generateRef() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FMT-${y}${m}${d}-${random}`;
}

/**
 * Création publique d'une réservation (BookingFlow, OmraBooking) — remplace
 * l'Appwrite Function create-reservation. L'identité du client vient de la
 * session, plus du corps de la requête.
 */
@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly db: DbService,
    private readonly docs: DocumentsService,
    private readonly emails: EmailsService,
    private readonly audit: AuditService,
    private readonly agency: AgencyService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  private async verifyCaptcha(token: unknown) {
    if (this.config.recaptcha.disabled) return;
    if (typeof token !== "string" || !token) throw badRequest("Token manquant");
    if (!this.config.recaptcha.secret) {
      this.logger.error("RECAPTCHA_SECRET n'est pas configuré");
      throw new ApiError(500, "general_server_error", "Configuration serveur incomplète");
    }
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: this.config.recaptcha.secret, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    const captcha = (await res.json()) as { success?: boolean; score?: number };
    if (!captcha.success || (captcha.score ?? 0) < this.config.recaptcha.minScore) {
      throw new ApiError(403, "general_access_forbidden", "Captcha invalide");
    }
  }

  async create(body: Record<string, any>, user: UserRow) {
    const missing = REQUIRED_FIELDS.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
    if (missing.length) throw badRequest(`Champs manquants : ${missing.join(", ")}`);
    const pax = Number(body.totalPax);
    if (!Number.isFinite(pax) || pax <= 0) throw badRequest("totalPax invalide");

    await this.verifyCaptcha(body.recaptchaToken);

    const pkgRow = await this.docs.findRow("products", String(body.packageId)).catch(() => null);
    if (!pkgRow) throw notFound("document_not_found", "Package introuvable");
    const pkgData = parseJSON<PackageData>(pkgRow.data.data, {});

    const priceCheck = computeServerPrice(pkgData, body);
    if (!priceCheck.verified) this.logger.warn(`prix non vérifié : ${priceCheck.reason}`);
    const totalEstimate = priceCheck.verified ? priceCheck.total : Number(body.totalEstimate) || 0;
    // Voyageurs et suppléments recalculés par le serveur quand le prix est vérifié.
    const travelers = priceCheck.verified && priceCheck.pax ? priceCheck.pax : pax;
    const supplements = priceCheck.supplements ?? normalizeSupplements(pkgData, body.supplements, travelers, true);

    const period = travelPeriod(body.dateFrom, body.dateTo, new Date());
    const agency = await this.agency.get();
    assertPassports(body.participants, [], period?.travelEnd, agency.passportValidityMonths);
    const departure = findDeparture(pkgData, body.dateFrom, body.dateTo);
    if (departure?.closed) throw new ApiError(409, "departure_closed", "Ce départ n'est plus ouvert à la réservation.");
    const capacity = Number(departure?.capacity) > 0 ? Number(departure!.capacity) : null;

    const id = uniqueId();
    const data = {
      packageId: body.packageId,
      packageTitle: body.packageTitle,
      hotels: body.hotels,
      category: body.category,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      ...(period ?? {}),
      totalPax: travelers,
      participants: body.participants,
      supplements,
      departureSupplement: priceCheck.departureSupplement ?? 0,
      totalEstimate,
      clientEstimate: Number(body.totalEstimate) || 0,
      priceVerified: priceCheck.verified,
      userId: user.id,
      userEmail: user.email,
      userName: user.name || body.userName || "",
      status: "pending",
      ref: generateRef(),
    };

    // Places limitées : comptage + insertion sous verrou (par package et
    // date), deux clients ne peuvent pas prendre la dernière place ensemble.
    const reservation = await this.db.transaction(async (client) => {
      if (capacity !== null && period) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${body.packageId}|${period.travelStart}`]);
        const { rows } = await client.query<Row>(
          `SELECT collection, id, data, created_at, updated_at FROM documents
           WHERE collection = 'reservations' AND data->>'packageId' = $1 AND data->>'status' = ANY($2::text[])`,
          [String(body.packageId), ACTIVE_STATUSES],
        );
        const sold = rows
          .filter((r) => reservationTravel(r.data, r.created_at)?.travelStart === period.travelStart)
          .reduce((s, r) => s + (Number(r.data.totalPax) || 0), 0);
        if (sold + travelers > capacity) {
          const left = Math.max(0, capacity - sold);
          throw new ApiError(409, "departure_full", left ? `Plus que ${left} place(s) sur ce départ.` : "Ce départ est complet.");
        }
      }
      const { rows } = await client.query<Row>(
        `INSERT INTO documents (collection, id, data) VALUES ('reservations', $1, $2::jsonb)
         RETURNING collection, id, data, created_at, updated_at`,
        [id, JSON.stringify(data)],
      );
      return toDocument(rows[0]);
    });

    await this.audit.record({
      caller: { id: user.id, name: user.name || user.email, roles: [], isAdmin: false, isStaff: false },
      collection: "reservations",
      documentId: id,
      action: "create",
      message: "Réservation en ligne",
    });

    const event = await this.docs
      .insert("events", uniqueId(), {
        userId: user.id,
        sessionId: body.sessionId,
        event: "reservation_created",
        category: "reservation",
        action: "create",
        label: body.packageTitle,
        targetId: reservation.$id,
        page: "/reservation/confirm",
        data: JSON.stringify({ packageId: body.packageId, totalEstimate }),
        device: body.device,
        country: body.country || "MA",
        createdAt: new Date().toISOString(),
      })
      .catch((err: Error) => {
        this.logger.error(`journal d'événement échoué : ${err.message}`);
        return null;
      });

    // Emails : effet de bord, jamais attendu ni bloquant pour la réservation.
    for (const trigger of ["reservation_created_client", "reservation_created_admin"]) {
      this.emails
        .sendForReservation(trigger, reservation)
        .catch((err: Error) => this.logger.error(`email ${trigger} échoué : ${err.message}`));
    }

    return { success: true, reservation, events: event ? [event.$id] : [] };
  }

  /** Émet la facture : numéro continu par année, attribué une seule fois. */
  async issueInvoice(id: string) {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<{ data: Record<string, unknown> }>(
        "SELECT data FROM documents WHERE collection = 'reservations' AND id = $1 FOR UPDATE",
        [id],
      );
      if (!rows[0]) throw notFound("document_not_found", "Réservation introuvable.");
      if (rows[0].data.invoiceNumber) {
        return { invoiceNumber: rows[0].data.invoiceNumber as string, invoiceDate: rows[0].data.invoiceDate as string, created: false };
      }
      const year = new Date().getFullYear();
      const counter = await client.query<{ value: number }>(
        `INSERT INTO counters (name, year, value) VALUES ('invoice', $1, 1)
         ON CONFLICT (name, year) DO UPDATE SET value = counters.value + 1 RETURNING value`,
        [year],
      );
      const invoiceNumber = `F${year}-${String(counter.rows[0].value).padStart(4, "0")}`;
      const invoiceDate = new Date().toISOString().slice(0, 10);
      await client.query(
        `UPDATE documents SET data = data || $2::jsonb, updated_at = now() WHERE collection = 'reservations' AND id = $1`,
        [id, JSON.stringify({ invoiceNumber, invoiceDate })],
      );
      return { invoiceNumber, invoiceDate, created: true };
    });
  }
}
