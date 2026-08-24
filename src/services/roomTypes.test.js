import { describe, it, expect } from "vitest";
import { ROOM_TYPES, roomTypesFor, pricedRoomTypes } from "./roomTypes";

const cat = (tableHeaders, cols) => ({
  tableHeaders,
  hotels: cols.map((c, i) => ({ id: String(i), name: `H${i}`, cols: c })),
});

describe("roomTypesFor", () => {
  it("falls back to the four classic types when the category has nothing", () => {
    expect(roomTypesFor(undefined)).toEqual(ROOM_TYPES);
    expect(roomTypesFor({ hotels: [] })).toEqual(ROOM_TYPES);
  });

  it("keeps classic labels and occupancy for a legacy doc with no headers", () => {
    const rts = roomTypesFor(cat(undefined, [["3000", "3500", "4500", "1500"]]));
    expect(rts.map((r) => r.label)).toEqual(["Triple", "Double", "Single", "2–5 ans"]);
    expect(rts.map((r) => r.paxPerRoom)).toEqual([3, 2, 1, 1]);
    expect(rts.map((r) => r.colIdx)).toEqual([0, 1, 2, 3]);
  });

  it("still renders four columns when a headerless legacy doc prices fewer", () => {
    const rts = roomTypesFor(cat(undefined, [["3000", "3500", "4500"]]));
    expect(rts.map((r) => r.label)).toEqual(["Triple", "Double", "Single", "2–5 ans"]);
  });

  it("matches the Istanbul-style doc (4 classic headers) exactly", () => {
    const rts = roomTypesFor(
      cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans"], [["3000", "3500", "4500", "1500"]])
    );
    expect(rts.map((r) => [r.label, r.colIdx, r.paxPerRoom])).toEqual([
      ["Triple", 0, 3],
      ["Double", 1, 2],
      ["Single", 2, 1],
      ["2–5 ans", 3, 1],
    ]);
  });

  it("surfaces a custom column with its own label and paxPerRoom 1", () => {
    const rts = roomTypesFor(
      cat(
        ["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans", "Baby 1-2"],
        [["3000", "3500", "4500", "1500", "500"]]
      )
    );
    expect(rts).toHaveLength(5);
    expect(rts[4]).toMatchObject({ label: "Baby 1-2", colIdx: 4, paxPerRoom: 1 });
    expect(rts[0].paxPerRoom).toBe(3);
  });

  it("honours a relabelled classic column by name, not by position", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Nuits", "★", "Double", "Triple"], [["3500", "3000"]]));
    expect(rts.map((r) => r.paxPerRoom)).toEqual([2, 3]);
  });

  it("treats the en-dash and hyphen spellings of 2-5 ans as the same type", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Nuits", "★", "2-5 ANS"], [["1500"]]));
    expect(rts[0].paxPerRoom).toBe(1);
    expect(rts[0].label).toBe("2-5 ANS"); // label is preserved verbatim
  });

  it("takes price headers as the last N when the doc has a shorter prefix", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Triple", "Double"], [["3000", "3500"]]));
    expect(rts.map((r) => r.label)).toEqual(["Triple", "Double"]);
  });

  it("uses the widest hotel row when rows disagree on column count", () => {
    const rts = roomTypesFor(
      cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Baby 1-2"], [["3000", "3500"], ["3100", "3600", "500"]])
    );
    expect(rts.map((r) => r.label)).toEqual(["Triple", "Double", "Baby 1-2"]);
  });

  it("names an unlabelled extra column rather than leaving it blank", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans", "  "], [["1", "1", "1", "1", "1"]]));
    expect(rts[4].label).toBe("Chambre 5");
  });
});

describe("pricedRoomTypes", () => {
  it("keeps only the columns a hotel row actually prices", () => {
    const category = cat(
      ["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans", "Baby 1-2"],
      [["3 000", "0", "", "1500", "500"]]
    );
    expect(pricedRoomTypes(category, category.hotels[0]).map((r) => r.label)).toEqual([
      "Triple",
      "2–5 ans",
      "Baby 1-2",
    ]);
  });
});
