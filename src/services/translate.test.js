import { describe, it, expect } from "vitest";
import { extractTranslatable, localizeData } from "./translate";

describe("localizeData", () => {
  const data = {
    destination: "Marrakech",
    tagline: "Le rouge et l'or",
    country: "Maroc",
    sections: [{ title: "Inclus", items: [{ text: "Vol A/R" }] }],
    i18n: {
      en: { destination: "Marrakech", tagline: "Red and gold", sections: [{ title: "Included" }] },
      ar: { destination: "مراكش" },
    },
  };

  it("returns the data unchanged for the fr locale", () => {
    expect(localizeData(data, "fr")).toBe(data);
  });

  it("returns the data unchanged when no translation exists for the locale", () => {
    const noI18n = { destination: "Marrakech" };
    expect(localizeData(noI18n, "en")).toBe(noI18n);
  });

  it("overlays translated fields while keeping untranslated ones from the original", () => {
    const localized = localizeData(data, "en");
    expect(localized.tagline).toBe("Red and gold");
    // "country" has no English entry in i18n.en — must fall back to the original.
    expect(localized.country).toBe("Maroc");
  });

  it("overlays nested arrays by index without dropping fields missing from the translation", () => {
    const localized = localizeData(data, "en");
    expect(localized.sections[0].title).toBe("Included");
    expect(localized.sections[0].items[0].text).toBe("Vol A/R");
  });

  it("ignores blank translated strings and keeps the original value", () => {
    const withBlank = {
      destination: "Marrakech",
      i18n: { en: { destination: "   " } },
    };
    expect(localizeData(withBlank, "en").destination).toBe("Marrakech");
  });

  it("does not mutate the source object", () => {
    const before = JSON.stringify(data);
    localizeData(data, "en");
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe("extractTranslatable", () => {
  it("keeps only the known translatable fields, dropping empty/null values", () => {
    const out = extractTranslatable({
      destination: "Marrakech",
      country: "",
      basePrice: 4200, // not a translatable field
      subtitleItalic: null,
    });
    expect(out).toEqual({ destination: "Marrakech" });
  });

  it("cleans empty labels out of nested collections", () => {
    const out = extractTranslatable({
      hotelCategories: [{ label: "4 étoiles" }, { label: "" }],
    });
    expect(out.hotelCategories).toEqual([{ label: "4 étoiles" }, {}]);
  });
});
