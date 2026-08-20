import { describe, it, expect, vi } from "vitest";

vi.mock("../services/appwrite", () => ({
  getPrefs: vi.fn(),
  updatePrefs: vi.fn(),
  account: {},
  client: {},
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("./EventsContext", () => ({ useEvents: () => ({ trackFavorite: vi.fn() }) }));

const { toggleId } = await import("./FavoritesContext");

describe("toggleId", () => {
  it("adds an id that isn't in the list", () => {
    expect(toggleId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("removes an id that is already in the list", () => {
    expect(toggleId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a"];
    toggleId(input, "b");
    expect(input).toEqual(["a"]);
  });

  it("is idempotent under two toggles of the same id", () => {
    const ids = ["a", "b"];
    expect(toggleId(toggleId(ids, "x"), "x")).toEqual(ids);
  });
});
