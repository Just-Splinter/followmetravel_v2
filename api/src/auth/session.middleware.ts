import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthService, SESSION_COOKIE } from "./auth.service";

/** Résout le cookie de session en utilisateur (req.user), pour toutes les routes. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      req.user = await this.auth.userForToken(req.cookies?.[SESSION_COOKIE]);
      next();
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Anti-CSRF : toute requête qui modifie quelque chose doit porter l'en-tête
 * X-Fmt-Client. Un formulaire d'un autre site ne peut pas l'ajouter, et un
 * fetch() cross-origin qui l'ajoute déclenche un preflight CORS, refusé hors
 * des origines autorisées.
 */
export function requireClientHeader(req: Request, res: Response, next: NextFunction) {
  const safe = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  if (safe || req.get("x-fmt-client")) return next();
  res.status(403).json({ message: "En-tête X-Fmt-Client manquant.", code: 403, type: "general_access_forbidden" });
}
