// Crée (ou met à jour) un compte depuis la ligne de commande — pour le
// premier administrateur, sans page d'inscription publique.
//
//   node dist/cli/create-user.js --email admin@followmetravel.ma --password '...' --name 'Admin' --admin
//
// En production :
//   kubectl -n followmetravel exec deploy/api -- node dist/cli/create-user.js --email ... --password ... --admin
import * as argon2 from "argon2";
import { Pool } from "pg";
import { uniqueId } from "../common/ids";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name") ?? "";
  const admin = process.argv.includes("--admin");
  if (!email || !password || password.length < 8) {
    console.error("usage: create-user --email <email> --password <8 caractères min> [--name <nom>] [--admin]");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const hash = await argon2.hash(password);
    const labels = admin ? ["admin"] : [];
    const { rows } = await pool.query<{ id: string; created: boolean }>(
      `INSERT INTO users (id, email, name, password_hash, labels, password_updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (lower(email)) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         password_updated_at = now(),
         labels = CASE WHEN $6 THEN array(SELECT DISTINCT unnest(users.labels || EXCLUDED.labels)) ELSE users.labels END,
         name = CASE WHEN EXCLUDED.name = '' THEN users.name ELSE EXCLUDED.name END,
         updated_at = now()
       RETURNING id, (xmax = 0) AS created`,
      [uniqueId(), email.trim(), name, hash, labels, admin],
    );
    console.log(`${rows[0].created ? "créé" : "mis à jour"} : ${email} (id ${rows[0].id})${admin ? " [admin]" : ""}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
