import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, Query } from "../services/database";
import { useAuth } from "./AuthContext";
import functionService from "../services/functions";

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
      execute(() => {
        requireAuth();
        
        return functionService.execute('6a312ae3000737bbe2ac', {
          userId: user.$id,
          userEmail: user.email,
          userName: user.name,
          status: "pending",
          $createdAt: new Date().toISOString(),
          ...payload,
        })

      }),
    [execute, requireAuth, user]
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
        const result = await db.list(Collections.RESERVATIONS, [
          Query.equal("userId", user.$id),
          Query.orderDesc("$createdAt"),
        ]);
        setReservations(result.documents ?? result);
        return result;
      }),
    [execute, requireAuth, user]
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

  // ── Annuler une réservation ───────────────────────────────────────
  const cancelReservation = useCallback(
    (id) =>
      execute(() => {
        requireAuth();
        return db.update(Collections.RESERVATIONS, id, {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
        });
      }),
    [execute, requireAuth]
  );

  return (
    <ReservationContext.Provider value={{
      loading,
      error,
      reservations,
      createReservation,
      deleteReservation,
      updateReservation,
      fetchMyReservations,
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