import { describe, expect, it } from "vitest";
import { formuleMode, formuleNights } from "./formules";

describe("formules", () => {
  const sejour = { hotels: [{ city: "Istanbul", nights: 7 }, { city: "ISTANBUL", nights: 7 }] };
  const circuit = { hotels: [{ city: "Bangkok", nights: 4 }, { city: "Phuket", nights: 5 }] };

  it("séjour : hôtels au choix dans une ville, nuits = durée du séjour", () => {
    expect(formuleMode(sejour)).toBe("sejour");
    expect(formuleNights(sejour)).toBe(7);
  });

  it("circuit : étapes dans plusieurs villes, nuits additionnées", () => {
    expect(formuleMode(circuit)).toBe("circuit");
    expect(formuleNights(circuit)).toBe(9);
  });

  it("le type saisi dans l'éditeur l'emporte", () => {
    expect(formuleMode({ ...circuit, mode: "sejour" })).toBe("sejour");
    expect(formuleNights({ ...circuit, mode: "sejour" })).toBe(5);
  });

  it("même règle que l'API", async () => {
    const api = await import("../../api/src/reservations/formules.ts");
    for (const c of [sejour, circuit, { ...sejour, mode: "circuit" }, {}, { hotels: [{ city: "" }] }]) {
      expect(api.formuleMode(c)).toBe(formuleMode(c));
      expect(api.formuleNights(c)).toBe(formuleNights(c));
    }
  });
});
