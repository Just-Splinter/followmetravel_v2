import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { requireClientHeader } from "./auth/session.middleware";
import { loadConfig } from "./config";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Derrière ingress-nginx : req.ip = IP réelle du client (rate limiting, sessions).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Les documents packages (JSON des hôtels, jours, tarifs) peuvent être gros.
  app.useBodyParser("json", { limit: "10mb" });

  app.enableCors({
    origin: config.frontOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Fmt-Client"],
    // Nom des fichiers téléchargés (planning Excel) lisible par le site.
    exposedHeaders: ["Content-Disposition"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    maxAge: 600,
  });
  app.use(cookieParser(config.cookie.secret));
  app.use(requireClientHeader);
  app.enableShutdownHooks();

  await app.listen(config.port, "0.0.0.0");
  Logger.log(`API prête sur :${config.port} — origines autorisées : ${config.frontOrigins.join(", ")}`, "Bootstrap");
}

bootstrap();
