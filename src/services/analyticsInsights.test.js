import { describe, it, expect } from "vitest";
import { buildInsights, change, periodFor } from "./analyticsInsights";
import { contactKind, detectAcquisition } from "./acquisition";

describe("provenance des visites", () => {
  const host = "followmetravel.ma";
  it("utm_* prioritaires", () => {
    expect(detectAcquisition("?utm_source=Facebook&utm_medium=paid_social&utm_campaign=Bali-Ete", "https://google.com/", host))
      .toEqual({ source: "facebook", medium: "paid_social", campaign: "bali-ete" });
  });
  it("identifiants de clic publicitaire", () => {
    expect(detectAcquisition("?fbclid=abc", "", host).source).toBe("facebook");
    expect(detectAcquisition("?gclid=abc", "", host)).toMatchObject({ source: "google", medium: "cpc" });
  });
  it("référents : réseaux sociaux, moteurs, sites, interne et direct", () => {
    expect(detectAcquisition("", "https://l.instagram.com/x", host)).toMatchObject({ source: "instagram", medium: "social" });
    expect(detectAcquisition("", "https://www.google.co.ma/", host)).toMatchObject({ source: "google", medium: "organic" });
    expect(detectAcquisition("", "https://blog-voyage.ma/article", host)).toMatchObject({ source: "blog-voyage.ma", medium: "referral" });
    expect(detectAcquisition("", "https://www.followmetravel.ma/search", host).source).toBe("direct");
    expect(detectAcquisition("", "", host).source).toBe("direct");
  });
  it("liens de contact", () => {
    expect(contactKind("tel:+212664586425")).toBe("phone");
    expect(contactKind("mailto:contact@followmetravel.ma")).toBe("email");
    expect(contactKind("https://wa.me/212664586425?text=Bonjour")).toBe("whatsapp");
    expect(contactKind("https://followmetravel.ma/contact")).toBeNull();
  });
});

describe("périodes et variations", () => {
  it("N derniers jours, aujourd'hui inclus", () => {
    expect(periodFor(7, new Date("2026-10-16T15:00:00Z"))).toEqual({ from: "2026-10-10", to: "2026-10-17" });
    expect(periodFor(0, new Date("2026-10-16T15:00:00Z"))).toEqual({ from: "2026-10-16", to: "2026-10-17" });
  });
  it("variation relative, null sans période précédente", () => {
    expect(change(120, 100)).toBeCloseTo(0.2);
    expect(change(5, 0)).toBeNull();
  });
});

describe("constats", () => {
  const base = {
    kpis: { sessions: 200, requests: 10, conversion: 0.004, mobileShare: 0.7, abroadShare: 0.2, bookingOpens: 20, abandons: 12, leadDays: 60, contacts: {} },
    previous: { requests: 5 },
    funnel: [
      { label: "Visites", value: 200 }, { label: "Voyage", value: 150 }, { label: "Réservation", value: 20 },
    ],
    packages: [
      { title: "Java Volcans", views: 40, requests: 0, revenue: 0 },
      { title: "Bali Évasion", views: 30, requests: 6, confirmed: 3, revenue: 80000 },
    ],
    sources: [{ source: "facebook", medium: "paid_social", sessions: 80, requests: 6, conversion: 0.075 }],
    searches: [{ term: "maldives", count: 9, noResult: 9 }],
  };
  const texts = buildInsights(base).map((i) => i.text).join("\n");

  it("signale les points d'action", () => {
    expect(texts).toMatch(/en hausse de 100 %/);
    expect(texts).toMatch(/Java Volcans.*aucune demande/);
    expect(texts).toMatch(/maldives/);
    expect(texts).toMatch(/Plus grosse perte du parcours : entre « Voyage » et « Réservation »/);
    expect(texts).toMatch(/12 réservations abandonnées/);
    expect(texts).toMatch(/Canal le plus rentable : facebook/);
  });

  it("les alertes passent avant les informations, 8 constats au plus", () => {
    const list = buildInsights(base);
    expect(list.length).toBeLessThanOrEqual(8);
    expect(["bad", "warn"]).toContain(list[0].level);
  });

  it("aucune visite : un seul message explicatif", () => {
    expect(buildInsights({ kpis: { ...base.kpis, sessions: 0 } })).toHaveLength(1);
  });
});
