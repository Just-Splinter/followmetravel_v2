// Configuration lue une seule fois depuis l'environnement (Secret/ConfigMap
// Kubernetes en production, api/.env en local). Les variables obligatoires
// font échouer le démarrage plutôt qu'une requête plus tard.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function list(name: string, fallback = ""): string[] {
  return optional(name, fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Config {
  port: number;
  databaseUrl: string;
  /** Origines du front autorisées (CORS + redirections OAuth / récupération). */
  frontOrigins: string[];
  /** URL publique de l'API, pour le redirect_uri Google. */
  apiPublicUrl: string;
  cookie: {
    secret: string;
    secure: boolean;
    sameSite: "lax" | "none";
    sessionDays: number;
  };
  s3: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    /** Base publique des fichiers : `${publicUrl}/${fileId}`. */
    publicUrl: string;
  };
  google: { clientId: string; clientSecret: string };
  /** redirectTo : phase de test — tous les emails partent vers cette adresse. */
  smtp: { url: string; from: string; redirectTo: string };
  recaptcha: { secret: string; disabled: boolean; minScore: number };
  /** Jeton du CronJob de relances (en-tête X-Cron-Token). Vide : déclenchement manuel seulement. */
  cronToken: string;
}

export function loadConfig(): Config {
  const s3Url = new URL(optional("S3_ENDPOINT", "http://localhost:9000"));
  return {
    port: Number(optional("PORT", "3000")),
    databaseUrl: required("DATABASE_URL"),
    frontOrigins: list("FRONT_ORIGINS", "http://localhost:5173"),
    apiPublicUrl: optional("API_PUBLIC_URL", "http://localhost:3000").replace(/\/$/, ""),
    cookie: {
      secret: required("SESSION_SECRET"),
      secure: optional("COOKIE_SECURE", "true") === "true",
      // "none" seulement si le front et l'API sont sur des sites différents
      // (ex. api-followmetravel.oneiro-lego.com avant le DNS api.followmetravel.ma).
      sameSite: optional("COOKIE_SAMESITE", "lax") === "none" ? "none" : "lax",
      sessionDays: Number(optional("SESSION_DAYS", "30")),
    },
    s3: {
      endPoint: s3Url.hostname,
      port: Number(s3Url.port || (s3Url.protocol === "https:" ? 443 : 80)),
      useSSL: s3Url.protocol === "https:",
      accessKey: optional("S3_ACCESS_KEY"),
      secretKey: optional("S3_SECRET_KEY"),
      bucket: optional("S3_BUCKET", "followmetravel"),
      publicUrl: optional("MEDIA_PUBLIC_URL", "http://localhost:9000/followmetravel").replace(/\/$/, ""),
    },
    google: {
      clientId: optional("GOOGLE_CLIENT_ID"),
      clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    },
    smtp: {
      // ex. smtps://noreply%40followmetravel.ma:motdepasse@mail.followmetravel.ma:465
      url: optional("SMTP_URL"),
      from: optional("MAIL_FROM", "Follow Me Travel <noreply@followmetravel.ma>"),
      redirectTo: optional("MAIL_REDIRECT_TO"),
    },
    recaptcha: {
      secret: optional("RECAPTCHA_SECRET"),
      disabled: optional("RECAPTCHA_DISABLED") === "true",
      minScore: Number(optional("RECAPTCHA_MIN_SCORE", "0.5")),
    },
    cronToken: optional("CRON_TOKEN"),
  };
}

export const CONFIG = Symbol("CONFIG");
