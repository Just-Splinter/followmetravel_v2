import { createContext, useContext, useState, useCallback } from "react";
import db, { Collections, ID, Query } from "../services/database";

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
          ID.unique()
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
      execute(() => db.list(Collections.EMAIL_TEMPLATES, queries)),
    [execute]
  );

  const sendTestEmail = useCallback(
    async (templateId, recipientEmail, variables = {}) =>
      execute(async () => {
        const response = await fetch("/api/email/send-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, recipientEmail, variables }),
        });
        if (!response.ok) throw new Error("Failed to send test email");
        return await response.json();
      }),
    [execute]
  );

  const sendBulkEmail = useCallback(
    async (templateId, recipientList, variables = {}) =>
      execute(async () => {
        const response = await fetch("/api/email/send-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, recipientList, variables }),
        });
        if (!response.ok) throw new Error("Failed to send bulk email");
        return await response.json();
      }),
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
    sendTestEmail,
    sendBulkEmail,
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