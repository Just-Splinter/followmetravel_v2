import { Controller, Get, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AgencyService } from "./agency/agency";
import { AnalyticsController } from "./analytics/analytics.controller";
import { AnalyticsService } from "./analytics/analytics.service";
import { AuditController } from "./audit/audit.controller";
import { AuditService } from "./audit/audit.service";
import { AuthController } from "./auth/auth.controller";
import { UsersController } from "./auth/users.controller";
import { FinanceService } from "./finance/finance.service";
import { OperationsController } from "./finance/operations.controller";
import { PlanningExportService } from "./finance/planning-export";
import { PdfService } from "./pdf/pdf.service";
import { AuthService } from "./auth/auth.service";
import { SessionMiddleware } from "./auth/session.middleware";
import { DocumentsController } from "./collections/documents.controller";
import { LeadsController } from "./collections/leads.controller";
import { DocumentsService } from "./collections/documents.service";
import { CONFIG, loadConfig } from "./config";
import { DbService } from "./db/db.service";
import { EmailsController } from "./mail/emails.controller";
import { EmailsService } from "./mail/emails.service";
import { InboxController } from "./mail/inbox.controller";
import { InboxService } from "./mail/inbox.service";
import { MailerService } from "./mail/mailer.service";
import { ReservationsController } from "./reservations/reservations.controller";
import { ReservationsService } from "./reservations/reservations.service";
import { StorageController } from "./storage/storage.controller";
import { StorageService } from "./storage/storage.service";

@Controller("health")
class HealthController {
  constructor(private readonly db: DbService) {}

  // Sonde readiness/liveness Kubernetes : l'API sans base ne sert à rien.
  @Get()
  async health() {
    await this.db.query("SELECT 1");
    return { status: "ok" };
  }
}

@Module({
  imports: [
    // Limite globale par IP ; les routes sensibles (login, réservation,
    // récupération) ont leur propre @Throttle plus strict.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
  ],
  controllers: [
    HealthController,
    AuthController,
    DocumentsController,
    StorageController,
    ReservationsController,
    EmailsController,
    UsersController,
    AuditController,
    OperationsController,
    LeadsController,
    AnalyticsController,
    InboxController,
  ],
  providers: [
    { provide: CONFIG, useFactory: loadConfig },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    DbService,
    MailerService,
    AuthService,
    DocumentsService,
    StorageService,
    EmailsService,
    InboxService,
    ReservationsService,
    AuditService,
    AgencyService,
    PdfService,
    FinanceService,
    PlanningExportService,
    AnalyticsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes("*path");
  }
}
