import { badRequest } from "../common/errors";

/**
 * Traduit les Query Appwrite (chaînes JSON {"method","attribute","values"},
 * le format que produit Query.equal(...) côté front) en SQL paramétré sur
 * la table `documents`.
 *
 * Jamais de valeur interpolée dans le SQL : seuls les noms d'attributs le
 * sont, après validation stricte (ATTRIBUTE_PATTERN).
 */

export interface ParsedQuery {
  method: string;
  attribute?: string;
  values?: unknown[];
}

export interface ListPlan {
  /** Conditions WHERE (sans le filtre de collection). */
  where: string[];
  params: unknown[];
  orderBy: { expr: string; dir: "ASC" | "DESC" }[];
  limit: number;
  offset: number;
  cursorAfter: string | null;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 5000;

const ATTRIBUTE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

const SYSTEM_COLUMNS: Record<string, { column: string; cast: "text" | "timestamptz" }> = {
  $id: { column: "id", cast: "text" },
  $createdAt: { column: "created_at", cast: "timestamptz" },
  $updatedAt: { column: "updated_at", cast: "timestamptz" },
};

export function parseQueries(raw: unknown): ParsedQuery[] {
  const items = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return items.map((item) => {
    if (typeof item !== "string") throw badRequest("Query invalide.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(item);
    } catch {
      throw badRequest(`Query invalide : ${item.slice(0, 80)}`);
    }
    if (!parsed || typeof parsed !== "object" || typeof (parsed as ParsedQuery).method !== "string") {
      throw badRequest(`Query invalide : ${item.slice(0, 80)}`);
    }
    return parsed as ParsedQuery;
  });
}

class Builder {
  params: unknown[] = [];

  constructor(initialParams: unknown[]) {
    this.params = [...initialParams];
  }

  param(value: unknown, cast: string): string {
    this.params.push(value);
    return `$${this.params.length}::${cast}`;
  }
}

function attributeOf(q: ParsedQuery): string {
  const attr = q.attribute;
  if (typeof attr !== "string" || !(attr in SYSTEM_COLUMNS || ATTRIBUTE_PATTERN.test(attr))) {
    throw badRequest(`Attribut de requête invalide : ${String(attr)}`);
  }
  return attr;
}

/** Expression SQL d'un attribut : colonne système, ou valeur jsonb dans `data`. */
function expr(attr: string): string {
  const sys = SYSTEM_COLUMNS[attr];
  return sys ? sys.column : `data->'${attr}'`;
}

/** Expression texte d'un attribut (pour ILIKE / startsWith). */
function textExpr(attr: string): string {
  const sys = SYSTEM_COLUMNS[attr];
  return sys ? `${sys.column}::text` : `data->>'${attr}'`;
}

function valuesOf(q: ParsedQuery, min = 1): unknown[] {
  const values = Array.isArray(q.values) ? q.values : [];
  if (values.length < min) throw badRequest(`Query ${q.method} : valeur manquante.`);
  return values;
}

/** Comparaison typée : colonnes système en text/timestamptz, attributs en jsonb. */
function compare(b: Builder, attr: string, op: string, value: unknown): string {
  const sys = SYSTEM_COLUMNS[attr];
  if (sys) return `${sys.column} ${op} ${b.param(String(value), sys.cast)}`;
  return `${expr(attr)} ${op} ${b.param(JSON.stringify(value), "jsonb")}`;
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function condition(b: Builder, q: ParsedQuery): string {
  const attr = attributeOf(q);
  switch (q.method) {
    case "equal": {
      const values = valuesOf(q);
      const sys = SYSTEM_COLUMNS[attr];
      if (sys) return `${sys.column} = ANY(${b.param(values.map(String), `${sys.cast}[]`)})`;
      return `${expr(attr)} = ANY(${b.param(values.map((v) => JSON.stringify(v)), "jsonb[]")})`;
    }
    case "notEqual": {
      const [value] = valuesOf(q);
      const cond = compare(b, attr, "<>", value);
      return SYSTEM_COLUMNS[attr] ? cond : `(${expr(attr)} IS NULL OR ${cond})`;
    }
    case "lessThan":
      return compare(b, attr, "<", valuesOf(q)[0]);
    case "lessThanEqual":
      return compare(b, attr, "<=", valuesOf(q)[0]);
    case "greaterThan":
      return compare(b, attr, ">", valuesOf(q)[0]);
    case "greaterThanEqual":
      return compare(b, attr, ">=", valuesOf(q)[0]);
    case "between": {
      const [lo, hi] = valuesOf(q, 2);
      return `(${compare(b, attr, ">=", lo)} AND ${compare(b, attr, "<=", hi)})`;
    }
    case "isNull":
      return SYSTEM_COLUMNS[attr] ? "false" : `(${expr(attr)} IS NULL OR ${expr(attr)} = 'null'::jsonb)`;
    case "isNotNull":
      return SYSTEM_COLUMNS[attr] ? "true" : `(${expr(attr)} IS NOT NULL AND ${expr(attr)} <> 'null'::jsonb)`;
    case "search":
    case "contains": {
      // Appwrite `search` est un full-text ; un ILIKE sur le texte suffit au
      // seul usage du front (recherche par libellé dans Analytics).
      const parts = valuesOf(q).map((v) => `${textExpr(attr)} ILIKE ${b.param(`%${escapeLike(String(v))}%`, "text")}`);
      return `(${parts.join(" OR ")})`;
    }
    case "startsWith":
      return `${textExpr(attr)} LIKE ${b.param(`${escapeLike(String(valuesOf(q)[0]))}%`, "text")}`;
    case "endsWith":
      return `${textExpr(attr)} LIKE ${b.param(`%${escapeLike(String(valuesOf(q)[0]))}`, "text")}`;
    default:
      throw badRequest(`Méthode de requête non supportée : ${q.method}`);
  }
}

/**
 * @param initialParams paramètres déjà réservés par l'appelant ($1 = collection…),
 *                      les placeholders générés ici continuent la numérotation.
 */
export function buildListPlan(queries: ParsedQuery[], initialParams: unknown[]): ListPlan {
  const b = new Builder(initialParams);
  const where: string[] = [];
  const orderBy: ListPlan["orderBy"] = [];
  let limit = DEFAULT_LIMIT;
  let offset = 0;
  let cursorAfter: string | null = null;

  for (const q of queries) {
    switch (q.method) {
      case "limit": {
        const n = Number(valuesOf(q)[0]);
        if (!Number.isInteger(n) || n < 0) throw badRequest("Query limit invalide.");
        limit = Math.min(n, MAX_LIMIT);
        break;
      }
      case "offset": {
        const n = Number(valuesOf(q)[0]);
        if (!Number.isInteger(n) || n < 0) throw badRequest("Query offset invalide.");
        offset = n;
        break;
      }
      case "cursorAfter": {
        const id = valuesOf(q)[0];
        if (typeof id !== "string") throw badRequest("Query cursorAfter invalide.");
        cursorAfter = id;
        break;
      }
      case "orderAsc":
      case "orderDesc":
        orderBy.push({ expr: expr(attributeOf(q)), dir: q.method === "orderAsc" ? "ASC" : "DESC" });
        break;
      case "select":
        // Projection ignorée : on renvoie toujours le document complet.
        break;
      default:
        where.push(condition(b, q));
    }
  }

  // Ordre par défaut d'Appwrite : ordre d'insertion. `id` départage toujours
  // pour que la pagination soit stable.
  if (!orderBy.length) orderBy.push({ expr: "created_at", dir: "ASC" });
  orderBy.push({ expr: "id", dir: "ASC" });

  return { where, params: b.params, orderBy, limit, offset, cursorAfter };
}

/**
 * Condition « strictement après le document curseur » dans l'ordre demandé,
 * développée en (a > ca) OR (a = ca AND b > cb) … pour gérer des sens mixtes.
 *
 * @param cursorParam placeholder ($n) de l'id du document curseur ; $1 est la collection.
 */
export function cursorCondition(orderBy: ListPlan["orderBy"], cursorParam: string): string {
  // Même expression, lue sur la ligne curseur `c` au lieu de la ligne courante.
  const atCursor = (e: string) =>
    `(SELECT c.${e} FROM documents c WHERE c.collection = $1 AND c.id = ${cursorParam})`;
  const clauses = orderBy.map((o, i) => {
    const op = o.dir === "ASC" ? ">" : "<";
    const equalities = orderBy.slice(0, i).map((p) => `${p.expr} = ${atCursor(p.expr)}`);
    return [...equalities, `${o.expr} ${op} ${atCursor(o.expr)}`].join(" AND ");
  });
  return `(${clauses.map((c) => `(${c})`).join(" OR ")})`;
}
