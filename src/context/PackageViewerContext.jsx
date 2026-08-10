import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

import db, { Collections, ID, Query } from "../services/database";

const PackageContext = createContext(null);

export function PackageViewerProvider({ children }) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [packages, setPackages]     = useState([]);

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

  // ── CRUD ──────────────────────────────────────────────────────────

  const createPackage = useCallback(
    (pkg) =>
      execute(() =>
        db.create(Collections.PRODUCTS, { ...pkg }, ID.unique())
      ),
    [execute]
  );

  const updatePackage = useCallback(
    (id, pkg) =>
      execute(() =>
        db.update(Collections.PRODUCTS, id, { ...pkg })
      ),
    [execute]
  );

  const deletePackage = useCallback(
    (id) =>
      execute(() => db.delete(Collections.PRODUCTS, id)),
    [execute]
  );

  const findPackages = useCallback(
    (queries = []) =>
      execute(async () => {
        const result = await db.list(Collections.PRODUCTS, queries);
        setPackages(result.documents ?? result);
        return result;
      }),
    [execute]
  );

  // ── Fetch par ID (pour le viewer) ─────────────────────────────────

  const fetchById = useCallback(
    (id) =>
      execute(async () => {
        const doc = await db.get(Collections.PRODUCTS, id);

        // Si le champ `data` est un JSON stringifié, on le parse
        const pkg =
          doc?.data && typeof doc.data === "string"
            ? { ...doc, data: JSON.parse(doc.data) }
            : doc;

        setSelectedPkg(pkg);
        return pkg;
      }),
    [execute]
  );

  // ── Valeur exposée ────────────────────────────────────────────────

  const value = {
    loading,
    error,
    selectedPkg,
    packages,

    createPackage,
    updatePackage,
    deletePackage,
    fetchById,
    findPackages,

    Query,
  };

  return (
    <PackageContext.Provider value={value}>
      {children}
    </PackageContext.Provider>
  );
}

export function usePackages() {
  const context = useContext(PackageContext);
  if (!context) {
    throw new Error("usePackages must be used inside PackageProvider");
  }
  return context;
}