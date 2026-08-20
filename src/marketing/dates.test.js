import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { upcomingDepartures, parseDDMM, daysInMonth, formatDDMM } from "./dates";

describe("daysInMonth", () => {
  it("caps February at 28 (evergreen dates have no year, so no leap-year case)", () => {
    expect(daysInMonth(2)).toBe(28);
  });

  it("gives 30 for the short months", () => {
    expect([4, 6, 9, 11].map(daysInMonth)).toEqual([30, 30, 30, 30]);
  });

  it("gives 31 for the rest", () => {
    expect([1, 3, 5, 7, 8, 10, 12].map(daysInMonth)).toEqual([31, 31, 31, 31, 31, 31, 31]);
  });
});

describe("parseDDMM", () => {
  it("parses a well-formed DD/MM string", () => {
    expect(parseDDMM("05/06")).toEqual({ day: 5, month: 6 });
    expect(parseDDMM("5/6")).toEqual({ day: 5, month: 6 });
  });

  it("rejects an out-of-range month instead of letting Date() silently overflow it", () => {
    // new Date(year, 12, 99) would previously roll into a bogus date;
    // that used to reach upcomingDepartures() unvalidated.
    expect(parseDDMM("15/13")).toBeNull();
    expect(parseDDMM("01/00")).toBeNull();
  });

  it("rejects a day that doesn't exist in the given month", () => {
    expect(parseDDMM("31/02")).toBeNull();
    expect(parseDDMM("31/04")).toBeNull();
    expect(parseDDMM("29/02")).toBeNull();
  });

  it("rejects empty, missing or garbage input", () => {
    expect(parseDDMM("")).toBeNull();
    expect(parseDDMM(undefined)).toBeNull();
    expect(parseDDMM("JJ/MM")).toBeNull(); // the old placeholder default
    expect(parseDDMM("bientôt")).toBeNull();
  });
});

describe("formatDDMM", () => {
  it("zero-pads single digits", () => {
    expect(formatDDMM(5, 6)).toBe("05/06");
  });

  it("round-trips through parseDDMM", () => {
    expect(parseDDMM(formatDDMM(31, 12))).toEqual({ day: 31, month: 12 });
  });
});

describe("upcomingDepartures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a date that hasn't happened yet this year, using the current year", () => {
    vi.setSystemTime(new Date(2026, 5, 1)); // June 1st, 2026

    const [result] = upcomingDepartures([{ id: 1, from: "15/06", to: "22/06" }]);

    expect(result.when).toEqual(new Date(2026, 5, 15));
  });

  it("rolls a date that already passed this year over to next year", () => {
    // The evergreen "DD/MM" contract this depends on: past entries must not
    // disappear, they refer to next year's occurrence (see dates.js header).
    vi.setSystemTime(new Date(2026, 5, 20)); // June 20th, 2026

    const [result] = upcomingDepartures([{ id: 1, from: "15/06", to: "22/06" }]);

    expect(result.when).toEqual(new Date(2027, 5, 15));
  });

  it("treats today's day/month as still upcoming, not passed", () => {
    vi.setSystemTime(new Date(2026, 5, 15));

    const [result] = upcomingDepartures([{ id: 1, from: "15/06", to: "22/06" }]);

    expect(result.when).toEqual(new Date(2026, 5, 15));
  });

  it("drops entries with a missing or malformed 'from' instead of crashing", () => {
    vi.setSystemTime(new Date(2026, 5, 1));

    const result = upcomingDepartures([
      { id: 1, from: "", to: "22/06" },
      { id: 2, from: "not-a-date", to: "22/06" },
      { id: 3 }, // from entirely absent
      { id: 4, from: "10/07", to: "17/07" },
    ]);

    expect(result.map((r) => r.id)).toEqual([4]);
  });

  it("sorts the results by upcoming date", () => {
    vi.setSystemTime(new Date(2026, 0, 1)); // Jan 1st

    const result = upcomingDepartures([
      { id: "late", from: "20/12" },
      { id: "early", from: "05/03" },
    ]);

    expect(result.map((r) => r.id)).toEqual(["early", "late"]);
  });

  it("returns an empty array for no input", () => {
    expect(upcomingDepartures(undefined)).toEqual([]);
    expect(upcomingDepartures([])).toEqual([]);
  });

  it("drops an out-of-range 'from' instead of silently overflowing into a wrong date", () => {
    // Before parseDDMM() was reused here, "31/02" or "99/13" were passed
    // straight into `new Date(year, month - 1, day)`, which normalizes
    // out-of-range values instead of rejecting them (e.g. day 99 rolls into
    // a later month) — a bad entry showed up as a wrong departure date
    // instead of being dropped.
    vi.setSystemTime(new Date(2026, 0, 1));

    const result = upcomingDepartures([
      { id: "bad-month", from: "15/13" },
      { id: "bad-day", from: "31/02" },
      { id: "good", from: "10/03" },
    ]);

    expect(result.map((r) => r.id)).toEqual(["good"]);
  });
});
