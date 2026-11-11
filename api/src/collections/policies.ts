/**
 * Règles d'accès par collection — remplacent les permissions par document
 * d'Appwrite.
 *
 * Rôles (labels du compte) :
 *   admin       tout, y compris utilisateurs, réglages, suppressions
 *   agent       conseiller : catalogue, réservations, clients
 *   accounting  comptable : réservations (paiements, échéancier, factures), clients
 *
 * Niveaux d'accès :
 *   "any"    tout le monde, même non connecté
 *   "users"  n'importe quel compte connecté (limité par restrictedUpdate)
 *   "owner"  le compte dont l'id est dans `ownerField` (limité par restrictedUpdate)
 *   Role[]   un compte ayant au moins un de ces rôles
 *
 * `privileged` : rôles qui, sur un accès "users"/"owner", ont un accès
 * complet (tous les documents, tous les attributs).
 */
export type Role = "admin" | "agent" | "accounting";
export const ROLES: Role[] = ["admin", "agent", "accounting"];

export type Access = "any" | "users" | "owner" | readonly Role[];

export const ADMIN: readonly Role[] = ["admin"];
export const EDITORS: readonly Role[] = ["admin", "agent"];
export const STAFF: readonly Role[] = ROLES;

export interface Policy {
  read: Access;
  create: Access;
  update: Access;
  delete: Access;
  ownerField?: string;
  privileged?: readonly Role[];
  /** Mise à jour non privilégiée limitée à ces attributs, avec contrôle optionnel. */
  restrictedUpdate?: {
    fields: string[];
    check?: (patch: Record<string, unknown>, current: Record<string, unknown>) => boolean;
  };
  /** Attributs internes, retirés des lectures non privilégiées et non modifiables par elles. */
  privateFields?: string[];
  /** Pas d'entrée d'audit (volume : analytics). */
  noAudit?: boolean;
  /**
   * Ce que voit quelqu'un hors équipe (visiteur, client connecté) : condition
   * SQL ajoutée aux listes, et le même test pour la lecture d'un document.
   */
  publicView?: PublicView;
}

export interface PublicView {
  /** `param(v)` ajoute un paramètre et renvoie son placeholder ($n). */
  sql: (param: (value: unknown) => string) => string;
  visible: (data: Record<string, unknown>, today: string) => boolean;
}

/** Date du jour (AAAA-MM-JJ) — la même que le front pour les fenêtres de publication. */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const PUBLIC_PACKAGE_STATUSES = ["active", "published"];
// Réglages lus par le site public (data.kind). Les réglages email, eux, restent internes.
const PUBLIC_KINDS = /"kind":"(hero-slide|omra|site-contact|agency)"/;

/** Packages publiés dans leur fenêtre de publication + réglages publics du site. */
export const PUBLIC_PRODUCTS: PublicView = {
  sql: (param) => {
    const today = param(todayUtc());
    return `((data->>'status' = ANY(${param(PUBLIC_PACKAGE_STATUSES)}::text[])
      AND coalesce(left(data->>'publishAt', 10), '') <= ${today}::text
      AND (coalesce(data->>'unpublishAt', '') = '' OR left(data->>'unpublishAt', 10) > ${today}::text))
      OR coalesce(data->>'data', '') ~ ${param(PUBLIC_KINDS.source)}::text)`;
  },
  visible: (data, today) => {
    if (PUBLIC_KINDS.test(String(data.data ?? ""))) return true;
    if (!PUBLIC_PACKAGE_STATUSES.includes(String(data.status))) return false;
    const from = String(data.publishAt ?? "").slice(0, 10);
    const until = String(data.unpublishAt ?? "").slice(0, 10);
    return from <= today && (!until || until > today);
  },
};

/** Contenu éditorial : tout sauf les brouillons. */
export const NOT_DRAFT: PublicView = {
  sql: () => "coalesce(data->>'status', '') <> 'draft'",
  visible: (data) => data.status !== "draft",
};

// Catalogue public : lu par le site, édité par les conseillers. Hors équipe,
// les brouillons ne sont jamais renvoyés (publicView). Les singletons du site
// (hero, omra, contact, agence) vivent dans `products` avec status "draft" :
// ils restent lisibles, pas les réglages email.
const PUBLIC_CATALOG: Policy = { read: "any", create: EDITORS, update: EDITORS, delete: ADMIN, publicView: NOT_DRAFT };

export const RESERVATION_PRIVATE_FIELDS = ["costs", "internalNotes", "assignedTo", "remindersSent"];
const OPEN_STATUSES = ["pending", "confirmed"];

export const POLICIES: Record<string, Policy> = {
  products: { ...PUBLIC_CATALOG, publicView: PUBLIC_PRODUCTS },
  destinations: PUBLIC_CATALOG,
  tours: PUBLIC_CATALOG,
  adventures: PUBLIC_CATALOG,
  team: PUBLIC_CATALOG,
  testimonials: PUBLIC_CATALOG,
  news: PUBLIC_CATALOG,

  // BookingFlow (client connecté) repousse `bookedSnapshot` sur l'hôtel
  // juste après une réservation — seul attribut qu'un client peut écrire.
  hotels: {
    read: "any",
    create: EDITORS,
    update: "users",
    delete: ADMIN,
    privileged: EDITORS,
    restrictedUpdate: { fields: ["bookedSnapshot"] },
  },

  // Un client ne voit que ses réservations : il peut les annuler et
  // compléter ses voyageurs (passeports) tant que le dossier est ouvert.
  // La création publique passe par POST /v1/reservations.
  reservations: {
    read: "owner",
    create: STAFF,
    update: "owner",
    delete: ADMIN,
    ownerField: "userId",
    privileged: STAFF,
    privateFields: RESERVATION_PRIVATE_FIELDS,
    restrictedUpdate: {
      fields: ["status", "cancelledAt", "participants"],
      check: (patch, current) => {
        if (!OPEN_STATUSES.includes(String(current.status ?? "pending"))) return false;
        if (patch.status !== undefined && patch.status !== "cancelled") return false;
        if (patch.participants !== undefined) {
          let list: unknown = patch.participants;
          try {
            list = typeof list === "string" ? JSON.parse(list) : list;
          } catch {
            return false;
          }
          // Même nombre de voyageurs que réservé : la liste se complète, le dossier ne grossit pas.
          const pax = Number(current.totalPax) || 0;
          if (!Array.isArray(list) || list.length === 0 || (pax > 0 && list.length > pax)) return false;
        }
        return true;
      },
    },
  },

  // Analytics : écriture anonyme (tracking), lecture équipe.
  events: { read: STAFF, create: "any", update: ADMIN, delete: ADMIN, noAudit: true },

  email_templates: { read: STAFF, create: ADMIN, update: ADMIN, delete: ADMIN },
  clients: { read: STAFF, create: STAFF, update: STAFF, delete: ADMIN },
  // Boîte de réception des clients : écrite par l'API (copie des emails envoyés),
  // lue par l'équipe ici ; chaque client lit les siens par /v1/inbox.
  messages: { read: STAFF, create: ADMIN, update: ADMIN, delete: ADMIN },
};

export interface Caller {
  id: string;
  name?: string;
  roles: Role[];
  isAdmin: boolean;
  isStaff: boolean;
}

export function hasRole(caller: Caller | null, roles: readonly Role[]): boolean {
  return !!caller && caller.roles.some((r) => roles.includes(r));
}

/** L'appelant passe-t-il le niveau d'accès (hors contrôle de propriété / d'attributs) ? */
export function allows(access: Access, caller: Caller | null): boolean {
  if (access === "any") return true;
  if (access === "users" || access === "owner") return caller !== null;
  return hasRole(caller, access);
}

/** Accès complet : tous les documents, tous les attributs, sans restriction. */
export function hasFullAccess(access: Access, caller: Caller | null, privileged: readonly Role[] = []): boolean {
  if (access === "any") return true;
  if (Array.isArray(access)) return hasRole(caller, access as readonly Role[]);
  return hasRole(caller, privileged);
}
