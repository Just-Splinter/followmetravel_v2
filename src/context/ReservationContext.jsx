import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, Query, ID } from "../services/database";
import { useAuth } from "./AuthContext";
import functionService from "../services/functions";
import { sendTriggerEmail, buildReservationParams } from "../services/emailSender";

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

        const result = await functionService.execute('6a312ae3000737bbe2ac', {
          userId: user.$id,
          userEmail: user.email,
          userName: user.name,
          status: "pending",
          $createdAt: new Date().toISOString(),
          ...payload,
        });

        // Notification emails are a side effect, never awaited and never
        // allowed to fail the booking itself — see emailSender.js. Only
        // fires if the admin turned the trigger on in Paramètres and picked
        // a template (Notifications tab).
        if (result?.success && result?.reservation) {
          const params = buildReservationParams(result.reservation);
          const clientEmail = result.reservation.userEmail || user.email;
          sendTriggerEmail("reservation_created_client", { params, targetEmails: [clientEmail] });
          sendTriggerEmail("reservation_created_admin", { params });
        }

        return result;
      }),
    [execute, requireAuth, user]
  );

  // ── Créer une réservation depuis le dashboard (téléphone, agence…) ──
  // Skips the public Appwrite Function entirely — no recaptcha token to
  // verify, and the price doesn't need the server-side recompute that
  // function does for public submissions, since an admin typing the total
  // in is already the trusted source (there's no "client" to distrust
  // here). Writes straight to the collection like the function does.
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
          const params = buildReservationParams(reservation);
          sendTriggerEmail("reservation_created_client", { params, targetEmails: [reservation.userEmail] });
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

        const original = reservations.find((r) => r.$id === id);
        sendTriggerEmail("reservation_cancelled", {
          params: buildReservationParams({ ...original, ...result }),
          targetEmails: [original?.userEmail || user?.email].filter(Boolean),
        });

        return result;
      }),
    [execute, requireAuth, reservations, user]
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