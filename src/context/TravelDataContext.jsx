import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

import db, { Collections, ID, Query } from "../services/database";

const TravelDataContext = createContext(null);

export function TravelDataProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [packages, setPackages] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [tours, setTours] = useState([]);
  const [adventures, setAdventures] = useState([]);
  const [team, setTeam] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [news, setNews] = useState([]);

  const execute = useCallback(async (callback, loading) => {
    if (loading) setLoading(true);
    setError(null);
    try {
      return await callback();
    } catch (err) {
      console.error(err);
      setError(err);
      throw err;
    } finally {
      if (loading) setLoading(false);
    }
  }, []);

  // ─── Generic CRUD factory ───────────────────────────────────────────────────

  const makeActions = (collection, setter , loading = false) => ({
    fetch: (queries = []) =>
      execute(async () => {
        const res = await db.list(collection, queries);
        setter(res.documents ?? res);
        return res;
      }, loading),

    create: (data) =>
      execute(async () => {
        const doc = await db.create(collection, data, ID.unique());
        setter((prev) => [...prev, doc]);
        return doc;
      }),

    update: (id, data) =>
      execute(async () => {
        const doc = await db.update(collection, id, data);
        setter((prev) => prev.map((item) => (item.$id === id ? doc : item)));
        return doc;
      }),

    remove: (id) =>
      execute(async () => {
        await db.delete(collection, id);
        setter((prev) => prev.filter((item) => item.$id !== id));
      }),

    getOne: (id) =>
      execute(() => db.get(collection, id)),
  });

  // ─── Per-collection actions ─────────────────────────────────────────────────

  const destinationActions = makeActions(Collections.DESTINATIONS, setDestinations);
  const tourActions        = makeActions(Collections.TOURS,         setTours);
  const adventureActions   = makeActions(Collections.ADVENTURES,    setAdventures);
  const teamActions        = makeActions(Collections.TEAM,          setTeam);
  const testimonialActions = makeActions(Collections.TESTIMONIALS,  setTestimonials);
  const newsActions        = makeActions(Collections.NEWS,          setNews);
  const packageActions     = makeActions(Collections.PRODUCTS,      setPackages, true);

  // ─── Bootstrap: load everything on mount ───────────────────────────────────

  useEffect(() => {
    destinationActions.fetch();
    tourActions.fetch();
    adventureActions.fetch();
    teamActions.fetch();
    testimonialActions.fetch();
    packageActions.fetch();
    //newsActions.fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    loading,
    error,
    Query,

    destinations,
    tours,
    adventures,
    team,
    testimonials,
    news,
    packages,
    destinationActions,
    tourActions,
    adventureActions,
    teamActions,
    testimonialActions,
    newsActions,
    packageActions,
  };

  return (
    <TravelDataContext.Provider value={value}>
      {children}
    </TravelDataContext.Provider>
  );
}

export function useTravelData() {
  const ctx = useContext(TravelDataContext);
  if (!ctx) throw new Error("useTravelData must be used inside TravelDataProvider");
  return ctx;
}