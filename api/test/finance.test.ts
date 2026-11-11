import { describe, expect, it } from "vitest";
import { DEFAULT_AGENCY, cancellationLines, parseAgencyData } from "../src/agency/agency";
import { reminderKind } from "../src/finance/finance.service";
import { allocate, defaultSchedule, financeOf } from "../src/finance/schedule";
import { amountInWords, numberToFrench } from "../src/pdf/words";
import { computeServerPrice, lineItems } from "../src/reservations/pricing";
import { nextOccurrence, travelPeriod } from "../src/reservations/travel-dates";

const day = (iso: string) => new Date(`${iso}T10:00:00Z`);

describe("dates de voyage (JJ/MM sans année)", () => {
  it("prochaine occurrence : cette année si à venir, sinon l'an prochain", () => {
    expect(nextOccurrence("18/07", day("2026-03-01"))?.toISOString().slice(0, 10)).toBe("2026-07-18");
    expect(nextOccurrence("18/07", day("2026-10-15"))?.toISOString().slice(0, 10)).toBe("2027-07-18");
    expect(nextOccurrence("15/10", day("2026-10-15"))?.toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("voyage à cheval sur deux années : le retour suit le départ", () => {
    expect(travelPeriod("28/12", "05/01", day("2026-10-15"))).toEqual({ travelStart: "2026-12-28", travelEnd: "2027-01-05" });
  });

  it("année explicite respectée, date invalide refusée", () => {
    expect(travelPeriod("10/02/2028", "17/02/2028", day("2026-10-15"))?.travelStart).toBe("2028-02-10");
    expect(travelPeriod("31/02", "05/03", day("2026-10-15"))).toBeNull();
  });
});

describe("échéancier", () => {
  const agency = { ...DEFAULT_AGENCY, depositPercent: 30, depositDueDays: 3, balanceDaysBeforeDeparture: 30 };

  it("acompte 30 % à J+3, solde à J-30 du départ", () => {
    expect(defaultSchedule(10000, "2026-10-01", "2027-01-15", agency)).toEqual([
      { id: "deposit", label: "Acompte 30 %", dueDate: "2026-10-04", amount: 3000 },
      { id: "balance", label: "Solde", dueDate: "2026-12-16", amount: 7000 },
    ]);
  });

  it("départ trop proche : un seul règlement, au plus tard le jour du départ", () => {
    expect(defaultSchedule(10000, "2026-10-01", "2026-10-20", agency)).toEqual([
      { id: "total", label: "Règlement total", dueDate: "2026-10-04", amount: 10000 },
    ]);
  });

  it("paiements affectés aux échéances dans l'ordre, statuts calculés", () => {
    const states = allocate(
      [
        { id: "deposit", label: "Acompte", dueDate: "2026-10-04", amount: 3000 },
        { id: "balance", label: "Solde", dueDate: "2026-12-16", amount: 7000 },
      ],
      4000,
      "2026-10-15",
    );
    expect(states.map((s) => [s.id, s.paid, s.remaining, s.status])).toEqual([
      ["deposit", 3000, 0, "paid"],
      ["balance", 1000, 6000, "partial"],
    ]);
  });

  it("acompte non réglé après échéance → en retard ; échéancier saisi prioritaire", () => {
    const f = financeOf(
      { totalEstimate: 9000, payments: "[]", dateFrom: "10/01", dateTo: "17/01", schedule: JSON.stringify([{ id: "a", label: "Unique", dueDate: "2026-10-10", amount: 9000 }]) },
      day("2026-10-01"),
      agency,
      "2026-10-15",
    );
    expect(f.custom).toBe(true);
    expect(f.overdue).toBe(9000);
    expect(f.installments[0].daysToDue).toBe(-5);
    expect(f.travel).toEqual({ travelStart: "2027-01-10", travelEnd: "2027-01-17" });
  });

  it("échéancier saisi dont la somme ne correspond plus au prix → signalé", () => {
    const f = financeOf({ totalEstimate: 10000, schedule: [{ id: "a", label: "x", dueDate: "2026-11-01", amount: 8000 }] }, day("2026-10-01"), agency, "2026-10-15");
    expect(f.mismatch).toBe(true);
  });
});

describe("fiche agence", () => {
  it("valeurs par défaut et nombres invalides corrigés", () => {
    const a = parseAgencyData(JSON.stringify({ kind: "agency", depositPercent: "250", reminderDaysBefore: "abc", licenceNumber: "123" }));
    expect(a?.depositPercent).toBe(100);
    expect(a?.reminderDaysBefore).toBe(DEFAULT_AGENCY.reminderDaysBefore);
    expect(a?.licenceNumber).toBe("123");
    expect(parseAgencyData(JSON.stringify({ kind: "omra" }))).toBeNull();
  });

  it("politique d'annulation en phrases", () => {
    expect(cancellationLines([{ daysBefore: 30, feePercent: 10 }, { daysBefore: 0, feePercent: 100 }])).toEqual([
      "Plus de 30 jours avant le départ : 10 % du prix",
      "Moins de 30 jours avant le départ : 100 % du prix (aucun remboursement)",
    ]);
  });
});

describe("montants en lettres", () => {
  it.each([
    [1, "un"], [21, "vingt-et-un"], [71, "soixante-et-onze"], [80, "quatre-vingts"], [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"], [200, "deux-cents"], [201, "deux-cent-un"], [1000, "mille"],
    [80000, "quatre-vingt-mille"], [200000, "deux-cent-mille"], [13900, "treize-mille-neuf-cents"],
    [2000000, "deux-millions"], [1_250_300, "un-million-deux-cent-cinquante-mille-trois-cents"],
  ])("%i → %s", (n, words) => {
    expect(numberToFrench(n)).toBe(words);
  });

  it("dirhams et centimes", () => {
    expect(amountInWords(1)).toBe("un dirham");
    expect(amountInWords(27800)).toBe("vingt-sept-mille-huit-cents dirhams");
    expect(amountInWords(10.5)).toBe("dix dirhams et cinquante centimes");
  });
});

describe("supplément de départ et lignes de facture", () => {
  const pkg = {
    basePrice: 1000,
    departureDates: [
      { from: "04/07", to: "11/07", supplement: 500 },
      { from: "05/09", to: "12/09", supplement: -200 },
    ],
  };

  it("le supplément du départ choisi s'ajoute par voyageur", () => {
    expect(computeServerPrice(pkg, { totalPax: 2, dateFrom: "04/07", dateTo: "11/07" })).toMatchObject({ total: 3000, departureSupplement: 500 });
    expect(computeServerPrice(pkg, { totalPax: 2, dateFrom: "05/09", dateTo: "12/09" })).toMatchObject({ total: 1600, departureSupplement: -200 });
    expect(computeServerPrice(pkg, { totalPax: 2, dateFrom: "01/01" })).toMatchObject({ total: 2000, departureSupplement: 0 });
  });

  it("les lignes somment toujours au total du dossier (écart → ajustement)", () => {
    const items = lineItems({ packageTitle: "Java", totalPax: 2, departureSupplement: 500, dateFrom: "04/07", totalEstimate: 2800 }, pkg);
    expect(items.map((i) => [i.label, i.amount])).toEqual([
      ["Forfait Java", 2000],
      ["Supplément départ du 04/07", 1000],
      ["Remise / ajustement", -200],
    ]);
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(2800);
  });
});

describe("relances de paiement", () => {
  const agency = { reminderDaysBefore: 7, overdueReminderEveryDays: 7, maxOverdueReminders: 3 };
  const sent = (kind: string, at: string) => ({ key: `deposit:2026-10-04:${kind}`, at: `${at}T08:00:00.000Z` });

  it("rappel unique dès 7 jours avant l'échéance, rattrapé si la tâche n'a pas tourné", () => {
    expect(reminderKind(8, [], "2026-09-26", agency)).toBeNull();
    expect(reminderKind(5, [], "2026-09-29", agency)).toBe("upcoming");
    expect(reminderKind(4, [sent("upcoming", "2026-09-29")], "2026-09-30", agency)).toBeNull();
  });

  it("retard : première relance immédiate (même 9 jours après), puis tous les 7 jours, 3 au plus", () => {
    expect(reminderKind(-9, [], "2026-10-13", agency)).toBe("overdue-1");
    expect(reminderKind(-12, [sent("overdue-1", "2026-10-13")], "2026-10-16", agency)).toBeNull();
    expect(reminderKind(-16, [sent("overdue-1", "2026-10-13")], "2026-10-20", agency)).toBe("overdue-2");
    expect(reminderKind(-40, [sent("overdue-1", "2026-10-13"), sent("overdue-2", "2026-10-20"), sent("overdue-3", "2026-10-27")], "2026-11-13", agency)).toBeNull();
  });
});
