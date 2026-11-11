import { ROLES, type Caller, type Role } from "../collections/policies";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
  labels: string[];
  prefs: Record<string, unknown>;
  email_verification: boolean;
  status: boolean;
  password_updated_at: Date | null;
  accessed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const USER_COLUMNS =
  "id, email, name, password_hash, google_sub, labels, prefs, email_verification, status, password_updated_at, accessed_at, created_at, updated_at";

/** Utilisateur au format Appwrite `account.get()` — ce que lit AuthContext. */
export function toAccount(u: UserRow) {
  return {
    $id: u.id,
    $createdAt: u.created_at.toISOString(),
    $updatedAt: u.updated_at.toISOString(),
    name: u.name,
    email: u.email,
    phone: "",
    labels: u.labels,
    prefs: u.prefs,
    status: u.status,
    emailVerification: u.email_verification,
    phoneVerification: false,
    registration: u.created_at.toISOString(),
    passwordUpdate: u.password_updated_at?.toISOString() ?? "",
    accessedAt: u.accessed_at?.toISOString() ?? "",
    mfa: false,
  };
}

export function rolesOf(labels: string[]): Role[] {
  return ROLES.filter((r) => labels.includes(r));
}

export function toCaller(u: UserRow | null | undefined): Caller | null {
  if (!u) return null;
  const roles = rolesOf(u.labels);
  return { id: u.id, name: u.name || u.email, roles, isAdmin: roles.includes("admin"), isStaff: roles.length > 0 };
}

declare module "express-serve-static-core" {
  interface Request {
    /** Renseigné par SessionMiddleware à partir du cookie de session. */
    user?: UserRow | null;
  }
}
