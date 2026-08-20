import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, ID, Query, ADMIN_ONLY_PERMISSIONS } from "../services/database";

const MailContext = createContext(null);

export function MailProvider({ children }) {
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

  const createTemplate = useCallback(
    (template) =>
      execute(() =>
        db.create(
          Collections.EMAIL_TEMPLATES,
          {
            ...template,
            variables: JSON.stringify(template.variables || []),
            tags: JSON.stringify(template.tags || []),
          },
          ID.unique(),
          ADMIN_ONLY_PERMISSIONS
        )
      ),
    [execute]
  );

  const updateTemplate = useCallback(
    (id, template) =>
      execute(() =>
        db.update(
          Collections.EMAIL_TEMPLATES,
          id,
          {
            ...template,
            variables: JSON.stringify(template.variables || []),
            tags: JSON.stringify(template.tags || []),
          }
        )
      ),
    [execute]
  );

  const deleteTemplate = useCallback(
    (id) =>
      execute(() => db.delete(Collections.EMAIL_TEMPLATES, id)),
    [execute]
  );

  const getTemplate = useCallback(
    (id) =>
      execute(() => db.get(Collections.EMAIL_TEMPLATES, id)),
    [execute]
  );

  const findTemplates = useCallback(
    (queries = []) =>
      execute(() => db.listAll(Collections.EMAIL_TEMPLATES, queries)),
    [execute]
  );

  const value = {
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    findTemplates,
    Query,
  };

  return (
    <MailContext.Provider value={value}>
      {children}
    </MailContext.Provider>
  );
}

export function useMail() {
  const context = useContext(MailContext);
  if (!context) {
    throw new Error("useMail must be used inside MailProvider");
  }
  return context;
}