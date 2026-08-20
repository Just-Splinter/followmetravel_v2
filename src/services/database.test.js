import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./appwrite", () => ({ client: {} }));

const listDocuments = vi.fn();
vi.mock("appwrite", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Databases: vi.fn().mockImplementation(function () {
      this.listDocuments = listDocuments;
    }),
  };
});

const { default: db } = await import("./database");
const { Query } = await import("appwrite");

describe("db.listAll", () => {
  beforeEach(() => {
    listDocuments.mockReset();
  });

  it("stops after a single page when the collection fits under the page size", async () => {
    listDocuments.mockResolvedValueOnce({ documents: [{ $id: "a" }], total: 1 });

    const result = await db.listAll("products");

    expect(result).toEqual({ documents: [{ $id: "a" }], total: 1 });
    expect(listDocuments).toHaveBeenCalledTimes(1);
  });

  it("keeps paging past Appwrite's 25-doc default until a short page ends it", async () => {
    // Regression guard for the bug listAll() was written to fix: db.list()
    // inherits Appwrite's page size (25 by default), which silently
    // truncated collections bigger than that. listAll() must not do that.
    const page1 = Array.from({ length: 100 }, (_, i) => ({ $id: `doc-${i}` }));
    const page2 = Array.from({ length: 12 }, (_, i) => ({ $id: `doc-${100 + i}` }));
    listDocuments
      .mockResolvedValueOnce({ documents: page1 })
      .mockResolvedValueOnce({ documents: page2 });

    const result = await db.listAll("products");

    expect(result.documents).toHaveLength(112);
    expect(result.total).toBe(112);
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });

  it("cursors from the last document id of the previous page", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ $id: `doc-${i}` }));
    listDocuments
      .mockResolvedValueOnce({ documents: page1 })
      .mockResolvedValueOnce({ documents: [] });

    await db.listAll("products");

    const secondCallQueries = listDocuments.mock.calls[1][2];
    expect(secondCallQueries).toContain(Query.cursorAfter("doc-99"));
  });

  it("gives up after MAX_PAGES instead of looping forever on a pathological collection", async () => {
    listDocuments.mockResolvedValue({
      documents: Array.from({ length: 100 }, (_, i) => ({ $id: `doc-${i}` })),
    });

    const result = await db.listAll("products");

    expect(listDocuments).toHaveBeenCalledTimes(50); // MAX_PAGES
    expect(result.documents).toHaveLength(5000);
  });
});
