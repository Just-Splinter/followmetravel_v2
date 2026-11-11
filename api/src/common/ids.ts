import { randomBytes } from "node:crypto";

// Même gabarit que les ids Appwrite (20 caractères hex, préfixe horodaté) :
// les ids migrés et les nouveaux se ressemblent et restent triables.
export function uniqueId(): string {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  return (time + randomBytes(8).toString("hex")).slice(0, 20);
}

// Règle Appwrite pour un id fourni par le client.
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

/** L'id demandé par le client, ou un nouvel id pour "unique()" / absent. */
export function resolveId(requested: unknown): string | null {
  if (requested === undefined || requested === null || requested === "" || requested === "unique()") {
    return uniqueId();
  }
  return typeof requested === "string" && ID_PATTERN.test(requested) ? requested : null;
}
