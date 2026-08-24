// Runner-independent on purpose. Assertions use node:assert/strict (no
// dependencies), so `node --test src/services/roomTypes.test.js` passes on a
// bare checkout with no test runner installed. The repo's other test files are
// vitest-only; vitest does NOT collect node:test suites ("No test suite found"),
// so describe/it come from whichever runner is actually driving this file —
// vitest sets VITEST=true. That keeps this file green under both `node --test`
// and `npm test`, with one copy of the cases.
import assert from "node:assert/strict";
import { ROOM_TYPES, roomTypesFor, pricedRoomTypes } from "./roomTypes.js";

// via globalThis: eslint's browser env has no `process` global.
const { describe, it } = globalThis.process?.env?.VITEST
  ? await import("vitest")
  : await import("node:test");

const cat = (tableHeaders, cols) => ({
  tableHeaders,
  hotels: cols.map((c, i) => ({ id: String(i), name: `H${i}`, cols: c })),
});

describe("roomTypesFor", () => {
  it("falls back to the four classic types when the category has nothing", () => {
    assert.deepEqual(roomTypesFor(undefined), ROOM_TYPES);
    assert.deepEqual(roomTypesFor({ hotels: [] }), ROOM_TYPES);
  });

  it("keeps classic labels and occupancy for a legacy doc with no headers", () => {
    const rts = roomTypesFor(cat(undefined, [["3000", "3500", "4500", "1500"]]));
    assert.deepEqual(rts.map((r) => r.label), ["Triple", "Double", "Single", "2–5 ans"]);
    assert.deepEqual(rts.map((r) => r.paxPerRoom), [3, 2, 1, 1]);
    assert.deepEqual(rts.map((r) => r.colIdx), [0, 1, 2, 3]);
  });

  it("still renders four columns when a headerless legacy doc prices fewer", () => {
    const rts = roomTypesFor(cat(undefined, [["3000", "3500", "4500"]]));
    assert.deepEqual(rts.map((r) => r.label), ["Triple", "Double", "Single", "2–5 ans"]);
  });

  it("matches the Istanbul-style doc (4 classic headers) exactly", () => {
    const rts = roomTypesFor(
      cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans"], [["3000", "3500", "4500", "1500"]])
    );
    assert.deepEqual(rts.map((r) => [r.label, r.colIdx, r.paxPerRoom]), [
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
    assert.equal(rts.length, 5);
    assert.deepEqual(rts[4], { key: "c4", label: "Baby 1-2", colIdx: 4, paxPerRoom: 1 });
    assert.equal(rts[0].paxPerRoom, 3);
  });

  it("honours a relabelled classic column by name, not by position", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Nuits", "★", "Double", "Triple"], [["3500", "3000"]]));
    assert.deepEqual(rts.map((r) => r.paxPerRoom), [2, 3]);
  });

  it("treats the en-dash and hyphen spellings of 2-5 ans as the same type", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Nuits", "★", "2-5 ANS"], [["1500"]]));
    assert.equal(rts[0].paxPerRoom, 1);
    assert.equal(rts[0].label, "2-5 ANS"); // label is preserved verbatim
  });

  it("takes price headers as the last N when the doc has a shorter prefix", () => {
    const rts = roomTypesFor(cat(["Hôtel", "Ville", "Triple", "Double"], [["3000", "3500"]]));
    assert.deepEqual(rts.map((r) => r.label), ["Triple", "Double"]);
  });

  it("uses the widest hotel row when rows disagree on column count", () => {
    const rts = roomTypesFor(
      cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Baby 1-2"], [["3000", "3500"], ["3100", "3600", "500"]])
    );
    assert.deepEqual(rts.map((r) => r.label), ["Triple", "Double", "Baby 1-2"]);
  });

  it("names an unlabelled extra column rather than leaving it blank", () => {
    const rts = roomTypesFor(
      cat(["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans", "  "], [["1", "1", "1", "1", "1"]])
    );
    assert.equal(rts[4].label, "Chambre 5");
  });
});

describe("pricedRoomTypes", () => {
  it("keeps only the columns a hotel row actually prices", () => {
    const category = cat(
      ["Hôtel", "Ville", "Nuits", "★", "Triple", "Double", "Single", "2–5 ans", "Baby 1-2"],
      [["3 000", "0", "", "1500", "500"]]
    );
    assert.deepEqual(
      pricedRoomTypes(category, category.hotels[0]).map((r) => r.label),
      ["Triple", "2–5 ans", "Baby 1-2"]
    );
  });
});
