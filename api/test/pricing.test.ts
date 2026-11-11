import { describe, expect, it } from "vitest";
import { formuleMode, formuleNights } from "../src/reservations/formules";
import { assertPassports, passportExpiryIssue } from "../src/reservations/passport";
import { ROOM_TYPES as API_ROOM_TYPES, computeServerPrice, lineItems, normalizeSupplements } from "../src/reservations/pricing";

describe("ROOM_TYPES", () => {
  it("identique à src/services/roomTypes.js du front", async () => {
    // @ts-expect-error — module JS du front, sans types
    const front = await import("../../src/services/roomTypes.js");
    const pick = (rts: { label: string; colIdx: number; paxPerRoom: number }[]) =>
      rts.map(({ label, colIdx, paxPerRoom }) => ({ label, colIdx, paxPerRoom }));
    expect(pick(API_ROOM_TYPES)).toEqual(pick(front.ROOM_TYPES));
  });
});

describe("suppléments par défaut", () => {
  const sansSupp = { basePrice: 1000 };

  it("ne sont plus facturés sur une nouvelle réservation", () => {
    const res = computeServerPrice(sansSupp, { totalPax: 2, supplements: [{ key: "bosphore", qty: 2 }] });
    expect(res.total).toBe(2000);
    expect(normalizeSupplements(sansSupp, ["bosphore"], 2, true)).toEqual([]);
  });

  it("restent lisibles sur une réservation existante (documents)", () => {
    const lines = normalizeSupplements(sansSupp, ["bosphore"], 2);
    expect(lines).toMatchObject([{ key: "bosphore", label: "Croisière sur le Bosphore", qty: 2, price: 600 }]);
  });
});

describe("computeServerPrice", () => {
  const pkg = {
    hotelCategories: [{ label: "4 Étoiles", hotels: [{ hotelId: "h1", cols: ["1 000", "1 500", "2 000", "500"] }] }],
    suppliments: [{ key: "bursa", pricePerPax: 250 }],
  };

  it("mode chambres : prix × qté × pax/chambre + suppléments", () => {
    const res = computeServerPrice(pkg, {
      category: "4 Étoiles",
      hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 1 }] }]),
      supplements: ["bursa"],
    });
    // 1 chambre double = 2 pax × 1500 + 2 × 250
    expect(res).toMatchObject({ total: 3500, verified: true, departureSupplement: 0 });
  });

  it("mode par personne quand aucune chambre n'est tarifée", () => {
    expect(computeServerPrice({ basePrice: 900 }, { totalPax: 3, supplements: [] })).toMatchObject({ total: 2700, verified: true });
  });

  it("forme inconnue → verified false, jamais d'exception", () => {
    const res = computeServerPrice(pkg, { category: "Inconnue", hotels: "[{}]" });
    expect(res.verified).toBe(false);
  });
});

describe("formules : séjour (une ville) / circuit (plusieurs villes)", () => {
  const istanbul = {
    label: "Économique",
    hotels: [
      { hotelId: "ant", name: "Grand Ant", city: "Istanbul", nights: 7, cols: ["6 500", "6 700", "8 200"] },
      { hotelId: "ons", name: "Grand Ons", city: "istanbul ", nights: 7, cols: ["6 800", "6 900", "8 650"] },
    ],
  };
  const thai = {
    label: "4 Étoiles",
    hotels: [
      { hotelId: "bkk", name: "Bangkok Inn", city: "Bangkok", nights: 4, cols: ["12 000", "14 900", "18 000"] },
      { hotelId: "hkt", name: "Phuket Bay", city: "Phuket", nights: 5, cols: ["0", "0", "0"] },
    ],
  };

  it("type déduit des villes, nuits = durée du séjour ou somme des étapes", () => {
    expect(formuleMode(istanbul)).toBe("sejour");
    expect(formuleNights(istanbul)).toBe(7);
    expect(formuleMode(thai)).toBe("circuit");
    expect(formuleNights(thai)).toBe(9);
    expect(formuleMode({ ...thai, mode: "sejour" })).toBe("sejour");
  });

  it("séjour : un seul hôtel choisi, prix de cet hôtel", () => {
    const pkg = { hotelCategories: [istanbul], suppliments: [] };
    const ok = computeServerPrice(pkg, { category: "Économique", hotels: JSON.stringify([{ hotelId: "ons", rooms: [{ type: "Double", qty: 1 }] }]) });
    expect(ok).toMatchObject({ total: 13800, pax: 2, verified: true });
    const two = computeServerPrice(pkg, {
      category: "Économique",
      hotels: JSON.stringify([{ hotelId: "ant", rooms: [{ type: "Double", qty: 1 }] }, { hotelId: "ons", rooms: [{ type: "Double", qty: 1 }] }]),
    });
    expect(two.verified).toBe(false);
  });

  it("circuit : mêmes chambres à chaque étape, voyageurs comptés une fois", () => {
    const pkg = { hotelCategories: [thai], suppliments: [] };
    const rooms = [{ type: "Double", qty: 1 }];
    const res = computeServerPrice(pkg, { category: "4 Étoiles", hotels: JSON.stringify([{ hotelId: "bkk", rooms }, { hotelId: "hkt", rooms }]) });
    expect(res).toMatchObject({ total: 29800, pax: 2, verified: true });
    const mismatch = computeServerPrice(pkg, {
      category: "4 Étoiles",
      hotels: JSON.stringify([{ hotelId: "bkk", rooms }, { hotelId: "hkt", rooms: [{ type: "Single", qty: 2 }] }]),
    });
    expect(mismatch.verified).toBe(false);
    const items = lineItems(
      { packageTitle: "Thaïlande", category: "4 Étoiles", totalPax: 2, totalEstimate: 29800, hotels: JSON.stringify([{ name: "Bangkok Inn", rooms, subtotal: 29800 }, { name: "Phuket Bay", rooms, subtotal: 0 }]) },
      pkg,
    );
    expect(items).toHaveLength(1);
    expect(items[0].label).toContain("Bangkok Inn → Phuket Bay");
  });
});

describe("suppléments au nombre de voyageurs", () => {
  const pkg = {
    hotelCategories: [{ label: "4 Étoiles", hotels: [{ hotelId: "h1", cols: ["1 000", "1 500", "2 000"] }] }],
    suppliments: [{ key: "discover", label: "Pack Discover", pricePerPax: 800 }],
  };

  it("2 voyageurs sur 3 prennent le pack", () => {
    const res = computeServerPrice(pkg, {
      category: "4 Étoiles",
      hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Triple", qty: 1 }] }]),
      supplements: [{ key: "discover", qty: 2 }],
    });
    expect(res).toMatchObject({ total: 3000 + 1600, pax: 3 });
    expect(res.supplements).toEqual([{ key: "discover", label: "Pack Discover", qty: 2, pricePerPax: 800, price: 1600 }]);
  });

  it("plafonné au nombre de voyageurs ; ancien format (clé) = tous ; ligne libre ignorée en ligne", () => {
    expect(normalizeSupplements(pkg, [{ key: "discover", qty: 9 }], 3, true)[0].qty).toBe(3);
    expect(normalizeSupplements(pkg, ["discover"], 3, true)[0]).toMatchObject({ qty: 3, price: 2400 });
    expect(normalizeSupplements(pkg, [{ label: "Remise VIP", price: -500 }], 3, true)).toEqual([]);
    expect(normalizeSupplements(pkg, [{ label: "Visa", price: 300 }], 3)[0]).toMatchObject({ label: "Visa", price: 300 });
  });
});

describe("passeports : validité après le retour", () => {
  it("refuse un passeport valable moins de 6 mois après le retour", () => {
    // Retour le 12/11/2026, expiration le 20/12/2026 (cas de la capture)
    expect(passportExpiryIssue("2026-12-20", "2026-11-12", 6)).toContain("moins de 6 mois");
    expect(passportExpiryIssue("2026-11-01", "2026-11-12", 6)).toContain("expiré");
    expect(passportExpiryIssue("2027-05-12", "2026-11-12", 6)).toBeNull();
    expect(passportExpiryIssue("2026-12-20", "2026-11-12", 0)).toBeNull();
  });

  it("ne contrôle que les dates saisies ou modifiées", () => {
    const bad = JSON.stringify([{ fullName: "M. Test", passportExpiry: "2026-12-20" }]);
    expect(() => assertPassports(bad, "[]", "2026-11-12", 6)).toThrow(/Passeport non accepté/);
    expect(() => assertPassports(bad, bad, "2026-11-12", 6)).not.toThrow();
  });
});
