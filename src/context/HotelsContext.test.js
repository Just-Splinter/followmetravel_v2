import { describe, it, expect } from "vitest";
import { computeBookedRooms, parseBookedSnapshot, wouldExceedCapacity } from "./HotelsContext";

describe("computeBookedRooms", () => {
  it("sums room qty per hotelId, packageId and type across reservations", () => {
    const reservations = [
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 2 }] }]) },
      { status: "confirmed", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 1 }, { type: "Triple", qty: 1 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({
      h1: { p1: { Double: 3, Triple: 1 } },
    });
  });

  it("pools separately per package — two packages on the same hotel never share stock", () => {
    const reservations = [
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 2 }] }]) },
      { status: "pending", packageId: "p2", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 5 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({
      h1: { p1: { Double: 2 }, p2: { Double: 5 } },
    });
  });

  it("excludes cancelled reservations from the count", () => {
    const reservations = [
      { status: "cancelled", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 5 }] }]) },
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 1 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({ h1: { p1: { Double: 1 } } });
  });

  it("ignores hotel rows with no hotelId — plain-text rows never saved via the picker", () => {
    const reservations = [
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ name: "Some Hotel", rooms: [{ type: "Double", qty: 2 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({});
  });

  it("ignores reservations with no packageId", () => {
    const reservations = [
      { status: "pending", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 2 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({});
  });

  it("keeps hotels separate — no cross-contamination between different hotelIds", () => {
    const reservations = [
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 2 }] }]) },
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h2", rooms: [{ type: "Double", qty: 4 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({ h1: { p1: { Double: 2 } }, h2: { p1: { Double: 4 } } });
  });

  it("tolerates malformed hotels JSON instead of throwing", () => {
    const reservations = [
      { status: "pending", packageId: "p1", hotels: "not json" },
      { status: "pending", packageId: "p1", hotels: JSON.stringify([{ hotelId: "h1", rooms: [{ type: "Double", qty: 1 }] }]) },
    ];
    expect(computeBookedRooms(reservations)).toEqual({ h1: { p1: { Double: 1 } } });
  });

  it("returns an empty map for no reservations", () => {
    expect(computeBookedRooms([])).toEqual({});
    expect(computeBookedRooms(undefined)).toEqual({});
  });
});

describe("parseBookedSnapshot", () => {
  it("parses the public-safe snapshot shape, keyed by packageId", () => {
    expect(parseBookedSnapshot('{"p1":[{"type":"Double","booked":3}]}')).toEqual({
      p1: [{ type: "Double", booked: 3 }],
    });
  });

  it("returns an empty object for malformed, missing, or array input", () => {
    expect(parseBookedSnapshot("nope")).toEqual({});
    expect(parseBookedSnapshot(undefined)).toEqual({});
    expect(parseBookedSnapshot("[]")).toEqual({}); // old flat-array shape, pre-migration
  });
});

describe("wouldExceedCapacity", () => {
  it("allows a draft qty that fits within remaining capacity", () => {
    // 10 total, 4 booked by other reservations, this one wants 3 more → 7, fine.
    expect(wouldExceedCapacity({ draftQty: 3, catalogTotal: 10, globalBooked: 4, originalQty: 0 })).toBe(false);
  });

  it("blocks a draft qty that pushes past total capacity", () => {
    expect(wouldExceedCapacity({ draftQty: 7, catalogTotal: 10, globalBooked: 4, originalQty: 0 })).toBe(true);
  });

  it("excludes this reservation's own prior qty from the comparison", () => {
    // globalBooked (8) already includes this reservation's saved qty (2), so
    // others hold 6. Raising the draft to 4 makes 6 + 4 = 10, exactly at
    // capacity — allowed. Naively comparing draftQty against globalBooked
    // without subtracting originalQty would wrongly block this.
    expect(wouldExceedCapacity({ draftQty: 4, catalogTotal: 10, globalBooked: 8, originalQty: 2 })).toBe(false);
  });

  it("does not double-block when re-saving the exact same qty", () => {
    expect(wouldExceedCapacity({ draftQty: 10, catalogTotal: 10, globalBooked: 10, originalQty: 10 })).toBe(false);
  });

  it("treats an exact match at capacity as allowed, not exceeded", () => {
    expect(wouldExceedCapacity({ draftQty: 10, catalogTotal: 10, globalBooked: 0, originalQty: 0 })).toBe(false);
  });
});
