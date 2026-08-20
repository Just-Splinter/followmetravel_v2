import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, ID, Query } from "../services/database";

const ClientsContext = createContext(null);

/**
 * Standalone client records — a client that exists before any booking
 * (a prospect, or a walk-in noted by phone). Distinct from reservations.jsx
 * on purpose: a reservation-derived "client" only appears once someone has
 * actually booked, this collection is for the ones who haven't yet.
 * ClientsManager.jsx merges both sources by email — see mergeClients() in
 * src/services/clients.js.
 */
export function ClientsProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);

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

  const findAllClients = useCallback(
    () =>
      execute(async () => {
        const res = await db.listAll(Collections.CLIENTS, [Query.orderDesc("$createdAt")]);
        const docs = res.documents ?? res;
        setClients(docs);
        return docs;
      }),
    [execute]
  );

  const createClient = useCallback(
    (data) =>
      execute(async () => {
        const doc = await db.create(Collections.CLIENTS, data, ID.unique());
        setClients((prev) => [doc, ...prev]);
        return doc;
      }),
    [execute]
  );

  const updateClient = useCallback(
    (id, data) =>
      execute(async () => {
        const doc = await db.update(Collections.CLIENTS, id, data);
        setClients((prev) => prev.map((c) => (c.$id === id ? doc : c)));
        return doc;
      }),
    [execute]
  );

  const deleteClient = useCallback(
    (id) =>
      execute(async () => {
        await db.delete(Collections.CLIENTS, id);
        setClients((prev) => prev.filter((c) => c.$id !== id));
      }),
    [execute]
  );

  return (
    <ClientsContext.Provider
      value={{ loading, error, clients, findAllClients, createClient, updateClient, deleteClient, setClients }}
    >
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used inside ClientsProvider");
  return ctx;
}
