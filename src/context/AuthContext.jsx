import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { account } from "../services/account";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // vérifie la session au démarrage

  // ── Vérifie la session existante ──────────────────────────────────
  useEffect(() => {
    account.get()
      .then((data)=>{
        setUser(data)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {
    account.createOAuth2Session(
      "google",
      `${window.location.origin}/auth/callback`, // success redirect
      `${window.location.origin}/auth/error`     // failure redirect
    );
  }, []);

  // ── Logout ────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await account.deleteSession("current");
    setUser(null);
  }, []);

  // ── Refresh user (appelé depuis /auth/callback) ───────────────────
  const refreshUser = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}