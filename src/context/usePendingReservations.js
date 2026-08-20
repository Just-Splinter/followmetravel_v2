import { useEffect, useState } from "react";
import db, { Collections, Query } from "../services/database";

const REFRESH_MS = 60_000;

/**
 * Number of reservations still awaiting handling.
 *
 * The sidebar badge used to read this from AppContext, which was seeded from
 * src/data/seed.js — so it displayed a hardcoded mock count forever. This asks
 * Appwrite for a server-side `total` and never downloads the documents.
 */
export function usePendingReservations() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const poll = () =>
      db
        .count(Collections.RESERVATIONS, [Query.equal("status", "pending")])
        .then((total) => {
          if (alive) setCount(total);
        })
        // A badge is not worth surfacing an error for — keep the last value.
        .catch((err) => console.warn("[usePendingReservations]", err));

    poll();
    const id = setInterval(poll, REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return count;
}
