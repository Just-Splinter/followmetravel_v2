// Rôles de l'équipe (labels du compte) — les droits réels sont vérifiés par
// l'API (api/src/collections/policies.ts) ; ici on n'adapte que l'affichage.
export const STAFF_ROLES = ["admin", "agent", "accounting"];

export const rolesOf = (user) => (user?.labels || []).filter((l) => STAFF_ROLES.includes(l));
export const hasRole = (user, ...roles) => rolesOf(user).some((r) => roles.includes(r));
export const isStaff = (user) => rolesOf(user).length > 0;
export const isAdmin = (user) => hasRole(user, "admin");
/** Catalogue (packages, hôtels, CMS) : admin et conseiller. */
export const canEditCatalog = (user) => hasRole(user, "admin", "agent");
/** Factures : admin et comptable. */
export const canIssueInvoice = (user) => hasRole(user, "admin", "accounting");
