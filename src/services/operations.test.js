import { describe, it, expect } from "vitest";
import { passportIssue, travelersStatus } from "./travelers";
import { manifestRows, roomingRows, toCsv } from "./exports";
import { cancellationLines, whatsappLink, whatsappNumber } from "./agency";
import { isPubliclyVisible, isSiteDoc } from "./siteDocs";

describe("passportIssue", () => {
  it("passeport valide 6 mois après le retour", () => {
    expect(passportIssue({ passportNumber: "AB1", passportExpiry: "2030-01-01" }, "2027-07-11")).toBeNull();
  });
  it("signale manquant, expiré, ou valide moins de 6 mois", () => {
    expect(passportIssue({}, "2027-07-11")).toBe("Passeport à renseigner");
    expect(passportIssue({ passportNumber: "AB1" }, "2027-07-11")).toMatch(/expiration/);
    expect(passportIssue({ passportNumber: "AB1", passportExpiry: "2027-07-01" }, "2027-07-11")).toBe("Passeport expiré avant la date de retour");
    expect(passportIssue({ passportNumber: "AB1", passportExpiry: "2027-11-01" }, "2027-07-11")).toMatch(/^Passeport valable moins de 6 mois/);
    // Durée configurable (Paramètres → Agence) : 3 mois suffisent ici, 0 = pas de contrôle.
    expect(passportIssue({ passportNumber: "AB1", passportExpiry: "2027-11-01" }, "2027-07-11", 3)).toBeNull();
    expect(passportIssue({ passportNumber: "AB1", passportExpiry: "2027-07-01" }, "2027-07-11", 0)).toBeNull();
  });
  it("accepte l'ancien champ docNumber des réservations existantes", () => {
    expect(passportIssue({ docNumber: "X1", passportExpiry: "2031-01-01" }, "2027-01-01")).toBeNull();
  });
  it("résumé d'un dossier : voyageurs manquants", () => {
    const s = travelersStatus({ totalPax: 3, participants: JSON.stringify([{ fullName: "A", passportNumber: "1", passportExpiry: "2031-01-01" }]) });
    expect(s.missing).toBe(2);
    expect(s.complete).toBe(false);
  });
});

describe("exports", () => {
  const reservation = {
    ref: "FMT-1",
    travelStart: "2027-07-04",
    travelEnd: "2027-07-11",
    hotels: JSON.stringify([{ name: "Ubud Villas", rooms: [{ type: "Double", qty: 1 }, { type: "Single", qty: 1 }] }]),
    participants: JSON.stringify([
      { civility: "Mme", fullName: "Sara A", passportNumber: "AB1", birthDate: "1990-04-12" },
      { civility: "M.", fullName: "Omar A" },
      { fullName: "Lina A" },
    ]),
  };

  it("rooming list : une ligne par chambre, occupants répartis", () => {
    const { rows } = roomingRows([reservation]);
    expect(rows.map((r) => [r[0], r[2], r[4]])).toEqual([
      ["Ubud Villas", "Double", "Mme Sara A, M. Omar A"],
      ["Ubud Villas", "Single", "Lina A"],
    ]);
    expect(rows[0][5]).toBe("04/07/2027");
  });

  it("manifeste : un voyageur par ligne, dates au format français", () => {
    const { rows } = manifestRows([reservation]);
    expect(rows).toHaveLength(3);
    expect(rows[0].slice(0, 6)).toEqual(["FMT-1", "Mme", "Sara A", "12/04/1990", undefined, "AB1"]);
  });

  it("CSV Excel : séparateur ; et guillemets échappés", () => {
    expect(toCsv(["a", "b"], [["x;y", 'il dit "oui"']])).toBe('a;b\r\n"x;y";"il dit ""oui"""');
  });
});

describe("fiche agence", () => {
  it("numéro WhatsApp au format international", () => {
    expect(whatsappNumber({ whatsapp: "06 64 58 64 25" })).toBe("212664586425");
    expect(whatsappNumber({ whatsapp: "+212 664 586 425" })).toBe("212664586425");
    expect(whatsappNumber({ whatsapp: "00212664586425" })).toBe("212664586425");
    expect(whatsappLink({ whatsapp: "" }, "x")).toBeNull();
    expect(whatsappLink({ whatsapp: "+212664586425" }, "Bonjour à vous")).toBe("https://wa.me/212664586425?text=Bonjour%20%C3%A0%20vous");
  });

  it("conditions d'annulation en phrases, paliers triés", () => {
    expect(cancellationLines([{ daysBefore: 0, feePercent: 100 }, { daysBefore: 30, feePercent: 10 }])).toEqual([
      "Plus de 30 jours avant le départ : 10 % du prix",
      "Moins de 30 jours avant le départ : 100 % du prix (aucun remboursement)",
    ]);
  });
});

describe("visibilité sur le site", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  it("statut publié + fenêtre de publication", () => {
    expect(isPubliclyVisible({ status: "published" }, now)).toBe(true);
    expect(isPubliclyVisible({ status: "draft" }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "active", publishAt: "2026-11-01" }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "active", unpublishAt: "2026-10-16" }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "active", publishAt: "2026-10-01", unpublishAt: "2026-12-01" }, now)).toBe(true);
  });
  it("les réglages du site (data.kind) ne sont pas des packages", () => {
    expect(isSiteDoc({ data: JSON.stringify({ kind: "agency" }) })).toBe(true);
    expect(isSiteDoc({ data: JSON.stringify({ destination: "BALI" }) })).toBe(false);
    expect(isSiteDoc({ data: "pas du json" })).toBe(false);
  });
});
