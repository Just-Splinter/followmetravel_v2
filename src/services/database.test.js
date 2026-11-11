import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { default: db, Query, ID } = await import("./database");

const page = (documents, total = documents.length) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ documents, total }),
});

/** Les queries envoyées lors du n-ième appel fetch (désérialisées). */
const queriesOf = (call) =>
  new URL(fetchMock.mock.calls[call][0]).searchParams.getAll("queries").map((q) => JSON.parse(q));

describe("Query", () => {
  it("serializes exactly like the Appwrite SDK", () => {
    expect(JSON.parse(Query.equal("status", "pending"))).toEqual({ method: "equal", attribute: "status", values: ["pending"] });
    expect(JSON.parse(Query.equal("status", ["a", "b"]))).toEqual({ method: "equal", attribute: "status", values: ["a", "b"] });
    expect(JSON.parse(Query.orderDesc("$createdAt"))).toEqual({ method: "orderDesc", attribute: "$createdAt" });
    expect(JSON.parse(Query.limit(5))).toEqual({ method: "limit", values: [5] });
  });
});

describe("ID.unique", () => {
  it("returns distinct 20-char hex ids", () => {
    const a = ID.unique();
    expect(a).toMatch(/^[0-9a-f]{20}$/);
    expect(ID.unique()).not.toBe(a);
  });
});

describe("db.listAll", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("stops after a single page when the collection fits under the page size", async () => {
    fetchMock.mockResolvedValueOnce(page([{ $id: "a" }]));

    const result = await db.listAll("products");

    expect(result).toEqual({ documents: [{ $id: "a" }], total: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps paging past the 25-doc default until a short page ends it", async () => {
    // Regression guard for the bug listAll() was written to fix: db.list()
    // inherits the default page size (25), which silently truncated
    // collections bigger than that. listAll() must not do that.
    const page1 = Array.from({ length: 10 }, (_, i) => ({ $id: `doc-${i}` }));
    const page2 = Array.from({ length: 3 }, (_, i) => ({ $id: `doc-${10 + i}` }));
    fetchMock.mockResolvedValueOnce(page(page1)).mockResolvedValueOnce(page(page2));

    const result = await db.listAll("products", [], 10);

    expect(result.documents).toHaveLength(13);
    expect(result.total).toBe(13);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cursors from the last document id of the previous page", async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({ $id: `doc-${i}` }));
    fetchMock.mockResolvedValueOnce(page(page1)).mockResolvedValueOnce(page([]));

    await db.listAll("products", [Query.equal("status", "active")], 10);

    expect(queriesOf(1)).toContainEqual({ method: "cursorAfter", values: ["doc-9"] });
    // Les filtres de l'appelant sont conservés à chaque page.
    expect(queriesOf(1)).toContainEqual({ method: "equal", attribute: "status", values: ["active"] });
  });

  it("gives up after MAX_PAGES instead of looping forever on a pathological collection", async () => {
    fetchMock.mockImplementation(async () => page(Array.from({ length: 10 }, (_, i) => ({ $id: `doc-${i}` }))));

    const result = await db.listAll("products", [], 10);

    expect(fetchMock).toHaveBeenCalledTimes(50); // MAX_PAGES
    expect(result.documents).toHaveLength(500);
  });
});

describe("requests", () => {
  beforeEach(() => fetchMock.mockReset());

  it("sends the session cookie and the anti-CSRF header", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, text: async () => JSON.stringify({ $id: "x" }) });

    await db.create("clients", { name: "a" }, "x");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/collections\/clients\/documents$/);
    expect(init.credentials).toBe("include");
    expect(init.headers["X-Fmt-Client"]).toBe("web");
    expect(JSON.parse(init.body)).toEqual({ documentId: "x", data: { name: "a" } });
  });

  it("throws an Appwrite-shaped error (message + cause.type)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Authentification requise.", code: 401, type: "user_unauthorized" }),
    });

    const err = await db.get("clients", "x").catch((e) => e);
    expect(err.message).toBe("Authentification requise.");
    expect(err.cause).toEqual({ code: 401, type: "user_unauthorized" });
  });
});
