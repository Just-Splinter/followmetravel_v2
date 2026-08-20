import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

import db, { Collections, ID, Query, PUBLIC_CATALOG_PERMISSIONS } from "../services/database";

const PackageContext = createContext(null);

export function PackageProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const createPackage = useCallback(
    (pkg) =>
      execute(() =>
        db.create(
          Collections.PRODUCTS,
          {
            ...pkg,
          },
          ID.unique(),
          PUBLIC_CATALOG_PERMISSIONS
        )
      ),
    [execute]
  );

  const updatePackage = useCallback(
    (id, pkg) =>
      execute(() =>
        db.update(
          Collections.PRODUCTS,
          id,
          {
            ...pkg,
          }
        )
      ),
    [execute]
  );

  const deletePackage = useCallback(
    (id) =>
      execute(() =>
        db.delete(
          Collections.PRODUCTS,
          id
        )
      ),
    [execute]
  );

  const getPackage = useCallback(
    (id) =>
      execute(() =>
        db.get(
          Collections.PRODUCTS,
          id
        )
      ),
    [execute]
  );

  const findPackages = useCallback(
    (queries = []) =>
      execute(() =>
        db.listAll(
          Collections.PRODUCTS,
          queries
        )
      ),
    [execute]
  );

  const value = {
    loading,
    error,

    createPackage,
    updatePackage,
    deletePackage,
    getPackage,
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
    throw new Error(
      "usePackages must be used inside PackageProvider"
    );
  }

  return context;
}