import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, Query, ID } from "../services/database";
import { useAuth } from "./AuthContext";
import { request } from "../services/api";
import { sendTriggerEmail } from "../services/emailSender";

const ReservationContext = createContext(null);

export function ReservationProvider({ children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reservations, setReservations] = useState([]);

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

  // ── Guard : lève une erreur si non connecté ───────────────────────
  const requireAuth = useCallback(() => {
    if (!user) throw new Error("AUTH_REQUIRED");
  }, [user]);

  // ── Créer une réservation ─────────────────────────────────────────
  const createReservation = useCallback(
    (payload) =>
      execute(async () => {
        requireAuth();

        // L'API vérifie le captcha, recalcule le prix, prend l'identité du
        // client dans la session, et envoie elle-même les emails
        // reservation_created_client / _admin s'ils sont activés.
        return request("POST", "/v1/reservations", { body: { userName: user.name, ...payload } });
      }),
    [execute, requireAuth, user]
  );

  // ── Créer une réservation depuis le dashboard (téléphone, agence…) ──
  // Skips the public POST /v1/reservations entirely — no recaptcha token to
  // verify, and the price doesn't need the server-side recompute it does
  // for public submissions, since an admin typing the total in is already
  // the trusted source (there's no "client" to distrust here). Writes
  // straight to the collection (admin only, enforced by the API).
  const createReservationAdmin = useCallback(
    (payload) =>
      execute(async () => {
        requireAuth();

        const reservation = await db.create(
          Collections.RESERVATIONS,
          {
            userId: "",
            userEmail: "",
            userName: "",
            status: "pending",
            ref: "FMT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
            ...payload,
          },
          ID.unique()
        );

        setReservations((prev) => [reservation, ...prev]);

        if (reservation.userEmail) {
          sendTriggerEmail("reservation_created_client", { reservationId: reservation.$id });
        }

        return { success: true, reservation };
      }),
    [execute, requireAuth]
  );

  const updateReservation = useCallback(
    (id, payload) =>
      execute(() => {
        requireAuth();
        return db.update(
          Collections.RESERVATIONS,
          id,
          payload
        );
      }),
    [execute, requireAuth]
  );

  // ── Mes réservations ──────────────────────────────────────────────
  const fetchMyReservations = useCallback(
    () =>
      execute(async () => {
        requireAuth();
        const result = await db.listAll(Collections.RESERVATIONS, [
          Query.equal("userId", user.$id),
          Query.orderDesc("$createdAt"),
        ]);
        setReservations(result.documents ?? result);
        return result;
      }),
    [execute, requireAuth, user]
  );

  // ── Toutes les réservations (admin) ─────────────────────────────────
  // Not user-scoped — ReservationsManager needs every customer's booking,
  // not just the logged-in admin's own. Requires the "reservations"
  // collection to grant read beyond per-owner permissions; if it's locked
  // to Role.user(userId) server-side, this still only returns the caller's
  // own documents regardless of the query below.
  const findAllReservations = useCallback(
    (queries = []) =>
      execute(async () => {
        const result = await db.listAll(Collections.RESERVATIONS, [
          Query.orderDesc("$createdAt"),
          ...queries,
        ]);
        setReservations(result.documents ?? result);
        return result;
      }),
    [execute]
  );

    const deleteReservation = useCallback(
    (id) =>
      execute(async () => {
        requireAuth();
        await db.delete(
          Collections.RESERVATIONS,
          id
        );

        setReservations((prev) =>
          prev.filter((r) => r.$id !== id)
        );

        return { success: true, id };
      }),
    [execute, requireAuth]
  );

  // ── Annuler une réservation (self-service client) ──────────────────
  const cancelReservation = useCallback(
    (id) =>
      execute(async () => {
        requireAuth();
        const result = await db.update(Collections.RESERVATIONS, id, {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
        });

        setReservations((prev) =>
          prev.map((r) => (r.$id === id ? { ...r, ...result } : r))
        );

        sendTriggerEmail("reservation_cancelled", { reservationId: id });

        return result;
      }),
    [execute, requireAuth]
  );

  return (
    <ReservationContext.Provider value={{
      loading,
      error,
      reservations,
      createReservation,
      createReservationAdmin,
      deleteReservation,
      updateReservation,
      fetchMyReservations,
      findAllReservations,
      cancelReservation,
      setReservations,
      Query,
    }}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const ctx = useContext(ReservationContext);
  if (!ctx) throw new Error("useReservation must be used inside ReservationProvider");
  return ctx;
}