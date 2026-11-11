import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

import db, { Collections, ID, Query } from "../services/database";

// Access rules live in the API (api/src/collections/policies.ts): readable
// by anyone (public catalog), created/deleted by admins, and a logged-in
// customer may update `bookedSnapshot` only (BookingFlow bumps it right
// after a booking — see submit() there).

const HotelsContext = createContext(null);

/**
 * Hotel.rooms — despite the name, this hotel's own room types and their
 * default price ([{type, price}]), not totals: capacity is pooled per
 * package (see PackageeditorPage), not on the shared catalog entry.
 * Picking this hotel in a package's hotel row overrides that formule's
 * price columns with this list, prices included.
 */
export function parseHotelRoomTypes(raw) {
  try {
    const list = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list
      .map((r) => (typeof r === "string" ? { type: r, price: 0 } : r)) // tolerate the pre-price shape
      .filter((r) => r && typeof r.type === "string");
  } catch {
    return [];
  }
}

/**
 * Hotel.bookedSnapshot is a JSON object keyed by packageId:
 * `{ [packageId]: [{type, booked}] }` — the public-safe cached mirror of
 * `computeBookedRooms()`, scoped per package because room stock is pooled
 * per package/formule, not shared hotel-wide across every package that
 * happens to reference the same hotel.
 */
export function parseBookedSnapshot(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/**
 * Global stock counter, not date-aware, and pooled per package: sums
 * `rooms[].qty` per hotelId → packageId → type across every non-cancelled
 * reservation. Two different packages that both reference the same hotel
 * never compete for the same rooms — each package has its own allotment
 * (set in the package editor) and its own booked count here.
 *
 * A reservation only counts once its hotel row carries a `hotelId` (set by
 * HotelPicker) and the reservation itself carries a `packageId` (set by
 * BookingFlow) — rows saved before either existed just don't match
 * anything, which means they're excluded, not wrongly attributed.
 */
export function computeBookedRooms(reservationDocs) {
  const map = {};
  (reservationDocs || []).forEach((res) => {
    if (res.status === "cancelled" || !res.packageId) return;
    let hotelsInRes;
    try {
      hotelsInRes = typeof res.hotels === "string" ? JSON.parse(res.hotels) : res.hotels;
    } catch {
      hotelsInRes = null;
    }
    (hotelsInRes || []).forEach((h) => {
      if (!h?.hotelId) return;
      const perPackage = (map[h.hotelId] ||= {});
      const perType = (perPackage[res.packageId] ||= {});
      (h.rooms || []).forEach((r) => {
        if (!r?.type) return;
        perType[r.type] = (perType[r.type] || 0) + (Number(r.qty) || 0);
      });
    });
  });
  return map;
}

/**
 * Would setting this reservation's room qty to `draftQty` push the
 * package's allotment for this hotel/type over capacity? `globalBooked`
 * (from computeBookedRooms, already scoped to this hotel+package) includes
 * this same reservation's current saved qty, so that has to be subtracted
 * back out before adding the draft value, otherwise every reservation would
 * appear to double-count itself.
 */
export function wouldExceedCapacity({ draftQty, catalogTotal, globalBooked, originalQty }) {
  const bookedByOthers = (globalBooked || 0) - (originalQty || 0);
  return bookedByOthers + (draftQty || 0) > (catalogTotal || 0);
}

/**
 * Shared hotel catalog for the back-office: the package editor and the
 * reservations manager both pick from this instead of free-typing a hotel
 * name each time. Just identity (name/city/stars/image) — room capacity and
 * "block if full" now live per package, in each hotel row of a package's
 * hotelCategories (see PackageeditorPage's HotelCategoryItem), because the
 * same physical hotel can be allotted differently to different packages.
 * Auto-fetches once on mount — the catalog is small and every dashboard
 * page under it may need it.
 */
export function HotelsProvider({ children }) {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookedRooms, setBookedRooms] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const execute = useCallback(async (callback) => {
    setLoading(true);
    setError(null);
    try {
      return await callback();
    } catch (err) {
      console.error(err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const findHotels = useCallback(
    (queries = []) =>
      execute(async () => {
        const result = await db.listAll(Collections.HOTELS, queries);
        setHotels(result.documents ?? result);
        return result;
      }),
    [execute]
  );

  const createHotel = useCallback(
    (hotel) =>
      execute(async () => {
        const doc = await db.create(Collections.HOTELS, { ...hotel }, ID.unique());
        setHotels((prev) => [...prev, doc]);
        return doc;
      }),
    [execute]
  );

  const updateHotel = useCallback(
    (id, hotel) =>
      execute(async () => {
        const doc = await db.update(Collections.HOTELS, id, { ...hotel });
        setHotels((prev) => prev.map((h) => (h.$id === id ? doc : h)));
        return doc;
      }),
    [execute]
  );

  const deleteHotel = useCallback(
    (id) =>
      execute(async () => {
        await db.delete(Collections.HOTELS, id);
        setHotels((prev) => prev.filter((h) => h.$id !== id));
      }),
    [execute]
  );

  // Lazy on purpose: this scans every reservation, so it only runs where a
  // page actually shows availability (PackageeditorPage, ReservationsManager),
  // not on every dashboard page HotelsProvider happens to wrap.
  //
  // Also pushes a per-package `bookedSnapshot` onto each referenced hotel
  // document — the public booking flow blocks off of that snapshot instead
  // of ever reading the reservations collection itself, which would
  // otherwise mean exposing every customer's booking to any logged-in
  // visitor just to compute a room count. The trade-off: the public
  // snapshot is only as fresh as the last time an admin opened a page that
  // calls this (BookingFlow also bumps it optimistically right after a
  // booking — see its submit()).
  const refreshAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    try {
      const result = await db.listAll(Collections.RESERVATIONS);
      const map = computeBookedRooms(result.documents ?? result);
      setBookedRooms(map);

      await Promise.allSettled(
        Object.entries(map)
          .map(([hotelId, perPackage]) => {
            const hotelDoc = hotels.find((h) => h.$id === hotelId);
            if (!hotelDoc) return null; // referenced by a reservation but no longer in the catalog
            const snapshot = {};
            Object.entries(perPackage).forEach(([packageId, perType]) => {
              snapshot[packageId] = Object.entries(perType).map(([type, booked]) => ({ type, booked }));
            });
            const json = JSON.stringify(snapshot);
            return json === hotelDoc.bookedSnapshot
              ? null
              : db.update(Collections.HOTELS, hotelId, { bookedSnapshot: json });
          })
          .filter(Boolean)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [hotels]);

  const getBooked = useCallback(
    (hotelId, packageId, type) => bookedRooms[hotelId]?.[packageId]?.[type] || 0,
    [bookedRooms]
  );

  useEffect(() => {
    findHotels().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    hotels,
    bookedRooms,
    availabilityLoading,
    refreshAvailability,
    getBooked,
    loading,
    error,
    findHotels,
    createHotel,
    updateHotel,
    deleteHotel,
    Query,
  };

  return (
    <HotelsContext.Provider value={value}>
      {children}
    </HotelsContext.Provider>
  );
}

export function useHotels() {
  const context = useContext(HotelsContext);
  if (!context) {
    throw new Error("useHotels must be used inside HotelsProvider");
  }
  return context;
}
