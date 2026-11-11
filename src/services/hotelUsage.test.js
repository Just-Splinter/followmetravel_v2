import { describe, it, expect, vi } from "vitest";

const update = vi.fn().mockResolvedValue({});
vi.mock("./database", () => ({ default: { update, listAll: vi.fn() }, Collections: { PRODUCTS: "products" } }));

const { hotelUsage, propagateHotel } = await import("./hotelUsage");

const products = [
  {
    $id: "p1", title: "Bali Évasion", status: "published",
    data: JSON.stringify({ hotelCategories: [
      { label: "4 Étoiles", hotels: [{ hotelId: "h1", name: "Ubud", city: "Ubud", stars: 4, cols: ["100", "200"] }] },
      { label: "5 Étoiles", hotels: [{ hotelId: "h1", name: "Ubud", city: "Ubud", stars: 4, cols: ["300"] }, { name: "Texte libre" }] },
    ] }),
  },
  { $id: "p2", title: "Autre", data: JSON.stringify({ hotelCategories: [{ label: "Std", hotels: [{ hotelId: "h2", name: "X" }] }] }) },
  { $id: "agency", data: JSON.stringify({ kind: "agency" }) },
];

describe("hotelUsage", () => {
  it("liste les packages et formules qui utilisent chaque hôtel du catalogue", () => {
    const usage = hotelUsage(products);
    expect(usage.h1).toEqual([{ packageId: "p1", title: "Bali Évasion", status: "published", formules: ["4 Étoiles", "5 Étoiles"] }]);
    expect(usage.h2.map((u) => u.packageId)).toEqual(["p2"]);
    expect(Object.keys(usage)).toEqual(["h1", "h2"]); // lignes en texte libre ignorées
  });

  it("reporte nom / ville / étoiles sans toucher aux tarifs", async () => {
    const n = await propagateHotel(products, { $id: "h1", name: "Ubud Rice Villas", city: "Ubud", stars: 5 });
    expect(n).toBe(1);
    const [, id, patch] = update.mock.calls[0];
    expect(id).toBe("p1");
    const cats = JSON.parse(patch.data).hotelCategories;
    expect(cats[0].hotels[0]).toMatchObject({ name: "Ubud Rice Villas", stars: 5, cols: ["100", "200"] });
    expect(cats[1].hotels[1]).toEqual({ name: "Texte libre" });
  });
});
