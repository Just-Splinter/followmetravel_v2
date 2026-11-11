import { describe, expect, it } from "vitest";
import { buildListPlan, cursorCondition, parseQueries, MAX_LIMIT } from "../src/collections/query";

// Format exact produit par Query.* du SDK Appwrite (et du shim front).
const q = (method: string, attribute?: string, values?: unknown[]) =>
  JSON.stringify({ method, ...(attribute ? { attribute } : {}), ...(values ? { values } : {}) });

describe("parseQueries", () => {
  it("accepte une chaîne seule ou un tableau", () => {
    expect(parseQueries(q("limit", undefined, [5]))).toHaveLength(1);
    expect(parseQueries([q("limit", undefined, [5]), q("offset", undefined, [10])])).toHaveLength(2);
    expect(parseQueries(undefined)).toEqual([]);
  });

  it("rejette ce qui n'est pas une Query JSON", () => {
    expect(() => parseQueries("pas du json")).toThrow(/Query invalide/);
    expect(() => parseQueries(JSON.stringify({ attribute: "x" }))).toThrow(/Query invalide/);
  });
});

describe("buildListPlan", () => {
  it("equal sur un attribut : comparaison jsonb paramétrée, valeurs typées", () => {
    const plan = buildListPlan(parseQueries([q("equal", "status", ["pending", "paid"])]), ["reservations"]);
    expect(plan.where).toEqual([`data->'status' = ANY($2::jsonb[])`]);
    expect(plan.params).toEqual(["reservations", ['"pending"', '"paid"']]);
  });

  it("colonnes système : $createdAt → created_at en timestamptz", () => {
    const plan = buildListPlan(parseQueries([q("greaterThanEqual", "$createdAt", ["2026-01-01T00:00:00Z"])]), ["events"]);
    expect(plan.where).toEqual(["created_at >= $2::timestamptz"]);
  });

  it("ordre, limit, offset ; id départage toujours", () => {
    const plan = buildListPlan(
      parseQueries([q("orderDesc", "$createdAt"), q("limit", undefined, [100]), q("offset", undefined, [200])]),
      ["clients"],
    );
    expect(plan.orderBy).toEqual([
      { expr: "created_at", dir: "DESC" },
      { expr: "id", dir: "ASC" },
    ]);
    expect(plan.limit).toBe(100);
    expect(plan.offset).toBe(200);
  });

  it("limite par défaut 25 (comme Appwrite) et plafond à MAX_LIMIT", () => {
    expect(buildListPlan([], ["x"]).limit).toBe(25);
    expect(buildListPlan(parseQueries([q("limit", undefined, [99999])]), ["x"]).limit).toBe(MAX_LIMIT);
  });

  it("search : ILIKE avec jokers échappés", () => {
    const plan = buildListPlan(parseQueries([q("search", "label", ["50%_off"])]), ["events"]);
    expect(plan.where).toEqual([`(data->>'label' ILIKE $2::text)`]);
    expect(plan.params[1]).toBe("%50\\%\\_off%");
  });

  it("refuse les noms d'attributs qui pourraient injecter du SQL", () => {
    expect(() => buildListPlan(parseQueries([q("equal", "x' OR '1'='1", ["a"])]), ["x"])).toThrow(/Attribut/);
    expect(() => buildListPlan(parseQueries([q("orderAsc", "a;drop table users")]), ["x"])).toThrow(/Attribut/);
  });

  it("refuse les méthodes inconnues", () => {
    expect(() => buildListPlan(parseQueries([q("regex", "a", ["."])]), ["x"])).toThrow(/non supportée/);
  });
});

describe("cursorCondition", () => {
  it("développe l'ordre en comparaisons lexicographiques sur la ligne curseur", () => {
    const sql = cursorCondition(
      [
        { expr: "created_at", dir: "DESC" },
        { expr: "id", dir: "ASC" },
      ],
      "$5::text",
    );
    expect(sql).toContain("created_at < (SELECT c.created_at FROM documents c WHERE c.collection = $1 AND c.id = $5::text)");
    expect(sql).toContain("created_at = (SELECT c.created_at");
    expect(sql).toContain("id > (SELECT c.id");
  });
});
