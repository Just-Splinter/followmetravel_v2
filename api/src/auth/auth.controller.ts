import { Body, Controller, Delete, Get, HttpCode, Inject, Logger, Patch, Post, Put, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { CONFIG, Config } from "../config";
import { badRequest, unauthorized } from "../common/errors";
import { AuthService, SESSION_COOKIE } from "./auth.service";
import { exchangeGoogleCode, googleAuthUrl } from "./google";
import { toAccount } from "./users";

const OAUTH_COOKIE = "fmt_oauth";

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) throw badRequest(`Champ requis : ${field}`);
  return value;
}

/** Routes de compte — mêmes chemins que l'API Appwrite `account`. */
@Controller("v1/account")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  private sessionCookie(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      path: "/",
      ...(expires ? { expires } : {}),
    };
  }

  private async openSession(req: Request, res: Response, userId: string, provider: string) {
    // Remplace la session précédente du navigateur au lieu de refuser comme
    // Appwrite (user_session_already_exists).
    await this.auth.deleteSession(req.cookies?.[SESSION_COOKIE]);
    const { token, expiresAt } = await this.auth.createSession(userId, provider, {
      userAgent: req.get("user-agent"),
      ip: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, this.sessionCookie(expiresAt));
    return { expiresAt };
  }

  @Get()
  get(@Req() req: Request) {
    if (!req.user) throw unauthorized();
    return toAccount(req.user);
  }

  @Post("sessions/email")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: Record<string, unknown>) {
    const user = await this.auth.verifyPassword(str(body.email, "email"), str(body.password, "password"));
    const { expiresAt } = await this.openSession(req, res, user.id, "email");
    return { userId: user.id, provider: "email", expire: expiresAt.toISOString(), current: true };
  }

  @Delete("sessions/current")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.deleteSession(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, this.sessionCookie());
  }

  @Get("prefs")
  prefs(@Req() req: Request) {
    if (!req.user) throw unauthorized();
    return req.user.prefs;
  }

  // Remplace l'objet prefs entier, comme Appwrite (FavoritesContext fusionne lui-même).
  @Patch("prefs")
  async updatePrefs(@Req() req: Request, @Body() body: Record<string, unknown>) {
    if (!req.user) throw unauthorized();
    const prefs = body.prefs;
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) throw badRequest("prefs doit être un objet.");
    if (JSON.stringify(prefs).length > 64_000) throw badRequest("prefs trop volumineux.");
    return toAccount(await this.auth.updatePrefs(req.user.id, prefs as Record<string, unknown>));
  }

  @Post("recovery")
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async recovery(@Body() body: Record<string, unknown>) {
    await this.auth.requestRecovery(str(body.email, "email"), str(body.url, "url"));
    return { success: true };
  }

  @Put("recovery")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmRecovery(@Body() body: Record<string, unknown>) {
    await this.auth.confirmRecovery(str(body.userId, "userId"), str(body.secret, "secret"), str(body.password, "password"));
    return { success: true };
  }

  // ── Google OAuth ─────────────────────────────────────────────────

  private get googleRedirectUri() {
    return `${this.config.apiPublicUrl}/v1/account/sessions/oauth2/callback/google`;
  }

  /** Navigation pleine page depuis AuthContext.loginWithGoogle(). */
  @Get("sessions/oauth2/google")
  startGoogle(@Query("success") success: string, @Query("failure") failure: string, @Res() res: Response) {
    if (!this.config.google.clientId) throw badRequest("Connexion Google non configurée.", "project_provider_disabled");
    if (!this.auth.isAllowedRedirect(success) || !this.auth.isAllowedRedirect(failure)) {
      throw badRequest("URL de redirection non autorisée.");
    }
    const state = randomBytes(24).toString("base64url");
    // Cookie signé : un sous-domaine ne peut pas forger state ni les URLs de retour.
    res.cookie(OAUTH_COOKIE, JSON.stringify({ state, success, failure }), {
      httpOnly: true,
      secure: this.config.cookie.secure,
      sameSite: "lax", // renvoyé par la redirection top-level de Google
      signed: true,
      maxAge: 10 * 60_000,
      path: "/v1/account/sessions/oauth2",
    });
    res.redirect(googleAuthUrl(this.config.google.clientId, this.googleRedirectUri, state));
  }

  @Get("sessions/oauth2/callback/google")
  async googleCallback(@Req() req: Request, @Res() res: Response, @Query("code") code?: string, @Query("state") state?: string) {
    let flow: { state: string; success: string; failure: string } | null = null;
    try {
      flow = JSON.parse(req.signedCookies?.[OAUTH_COOKIE] || "null");
    } catch {
      flow = null;
    }
    res.clearCookie(OAUTH_COOKIE, { path: "/v1/account/sessions/oauth2" });

    if (!flow || !this.auth.isAllowedRedirect(flow.success) || !this.auth.isAllowedRedirect(flow.failure)) {
      res.status(400).send("Session de connexion expirée, recommencez depuis le site.");
      return;
    }
    if (!code || !state || state !== flow.state) {
      res.redirect(flow.failure);
      return;
    }
    try {
      const profile = await exchangeGoogleCode(code, {
        clientId: this.config.google.clientId,
        clientSecret: this.config.google.clientSecret,
        redirectUri: this.googleRedirectUri,
      });
      const user = await this.auth.upsertGoogleUser(profile);
      if (!user.status) throw new Error("compte désactivé");
      await this.openSession(req, res, user.id, "google");
      res.redirect(flow.success);
    } catch (err) {
      this.logger.warn(`connexion Google refusée : ${(err as Error).message}`);
      res.redirect(flow.failure);
    }
  }
}
