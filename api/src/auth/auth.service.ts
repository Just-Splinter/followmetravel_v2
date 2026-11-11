import { Inject, Injectable, Logger } from "@nestjs/common";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { CONFIG, Config } from "../config";
import { ApiError, badRequest, unauthorized } from "../common/errors";
import { uniqueId } from "../common/ids";
import { DbService } from "../db/db.service";
import { MailerService } from "../mail/mailer.service";
import { USER_COLUMNS, UserRow } from "./users";

export const SESSION_COOKIE = "fmt_session";
const RECOVERY_TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DbService,
    private readonly mailer: MailerService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  // ── Sessions ─────────────────────────────────────────────────────

  async createSession(userId: string, provider: string, meta: { userAgent?: string; ip?: string }) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.cookie.sessionDays * 86_400_000);
    await this.db.query(
      `INSERT INTO sessions (token_hash, user_id, provider, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [sha256(token), userId, provider, meta.userAgent?.slice(0, 500) ?? null, meta.ip ?? null, expiresAt],
    );
    await this.db.query("UPDATE users SET accessed_at = now() WHERE id = $1", [userId]);
    return { token, expiresAt };
  }

  async userForToken(token: string | undefined): Promise<UserRow | null> {
    if (!token) return null;
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS.split(", ").map((c) => `u.${c}`).join(", ")}
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status`,
      [sha256(token)],
    );
    return rows[0] ?? null;
  }

  async deleteSession(token: string | undefined) {
    if (token) await this.db.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  }

  // ── Email / mot de passe ─────────────────────────────────────────

  async verifyPassword(email: string, password: string): Promise<UserRow> {
    const user = await this.findByEmail(email);
    // Hash factice si l'utilisateur n'existe pas : même temps de réponse,
    // pas d'énumération des comptes par chronométrage.
    const hash = user?.password_hash ?? (await this.dummyHash());
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!user || !user.password_hash || !ok || !user.status) {
      throw new ApiError(401, "user_invalid_credentials", "Email ou mot de passe incorrect.");
    }
    return user;
  }

  private dummy?: string;
  private async dummyHash() {
    this.dummy ??= await argon2.hash(randomBytes(16).toString("hex"));
    return this.dummy;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`, [
      email.trim(),
    ]);
    return rows[0] ?? null;
  }

  async createUser(input: { email: string; password?: string; name?: string; labels?: string[]; googleSub?: string }) {
    const passwordHash = input.password ? await argon2.hash(input.password) : null;
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (id, email, name, password_hash, google_sub, labels, email_verification, password_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $4::text IS NULL THEN NULL ELSE now() END)
       RETURNING ${USER_COLUMNS}`,
      [uniqueId(), input.email.trim(), input.name ?? "", passwordHash, input.googleSub ?? null, input.labels ?? [], !!input.googleSub],
    );
    return rows[0];
  }

  async setPassword(userId: string, password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`, "password_invalid");
    }
    await this.db.query(
      "UPDATE users SET password_hash = $2, password_updated_at = now(), updated_at = now() WHERE id = $1",
      [userId, await argon2.hash(password)],
    );
    // Un changement de mot de passe ferme toutes les sessions ouvertes.
    await this.db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }

  async updatePrefs(userId: string, prefs: Record<string, unknown>) {
    const { rows } = await this.db.query<UserRow>(
      `UPDATE users SET prefs = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [userId, JSON.stringify(prefs)],
    );
    return rows[0];
  }

  // ── Récupération de mot de passe ─────────────────────────────────

  /** Origine du front autorisée ? (redirections, liens dans les emails) */
  isAllowedRedirect(url: string): boolean {
    try {
      return this.config.frontOrigins.includes(new URL(url).origin);
    } catch {
      return false;
    }
  }

  async requestRecovery(email: string, redirectUrl: string) {
    if (!this.isAllowedRedirect(redirectUrl)) throw badRequest("URL de redirection non autorisée.", "general_argument_invalid");
    const user = await this.findByEmail(email);
    // Réponse identique que le compte existe ou non (pas d'énumération).
    if (!user || !user.status) return;

    const secret = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + RECOVERY_TTL_MS);
    await this.db.query(
      "INSERT INTO password_recoveries (secret_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [sha256(secret), user.id, expiresAt],
    );

    // Mêmes paramètres que le lien Appwrite : AuthRecovery.jsx lit userId/secret.
    const link = new URL(redirectUrl);
    link.searchParams.set("userId", user.id);
    link.searchParams.set("secret", secret);
    link.searchParams.set("expire", expiresAt.toISOString());

    // Un échec d'envoi est journalisé, pas renvoyé : une erreur seulement pour
    // les comptes existants révélerait quels emails sont inscrits.
    await this.mailer
      .send({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe — Follow Me Travel",
        html: `<p>Bonjour${user.name ? " " + escapeHtml(user.name) : ""},</p>
<p>Pour choisir un nouveau mot de passe, cliquez sur le lien ci-dessous (valable 1 heure) :</p>
<p><a href="${escapeHtml(link.toString())}">Réinitialiser mon mot de passe</a></p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      })
      .catch((err: Error) => this.logger.error(`email de récupération non envoyé à ${user.id} : ${err.message}`));
  }

  async confirmRecovery(userId: string, secret: string, password: string) {
    const ok = await this.db.transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE password_recoveries SET used_at = now()
         WHERE secret_hash = $1 AND user_id = $2 AND used_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [sha256(secret), userId],
      );
      return rows.length > 0;
    });
    if (!ok) throw unauthorized("Lien de réinitialisation invalide ou expiré.");
    await this.setPassword(userId, password);
  }

  // ── Google ───────────────────────────────────────────────────────

  /** Compte lié au `sub` Google, sinon rattaché par email vérifié, sinon créé. */
  async upsertGoogleUser(profile: { sub: string; email: string; name: string }): Promise<UserRow> {
    const bySub = await this.db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = $1`, [profile.sub]);
    if (bySub.rows[0]) return bySub.rows[0];

    const byEmail = await this.findByEmail(profile.email);
    if (byEmail) {
      const { rows } = await this.db.query<UserRow>(
        `UPDATE users SET google_sub = $2, email_verification = true,
           name = CASE WHEN name = '' THEN $3 ELSE name END, updated_at = now()
         WHERE id = $1 RETURNING ${USER_COLUMNS}`,
        [byEmail.id, profile.sub, profile.name],
      );
      return rows[0];
    }
    return this.createUser({ email: profile.email, name: profile.name, googleSub: profile.sub });
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
