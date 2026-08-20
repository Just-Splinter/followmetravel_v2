import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login, requestPasswordRecovery } from "../services/appwrite";
import "../marketing/marketing.css";

/** Espace équipe — the dashboard sign-in, in the house style. */
export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser, loginWithGoogle } = useAuth();

  // "forgot password" replaces the form in place rather than a separate
  // route — the request step only needs an email, no redirect/session state.
  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setRecoveryError("");
    if (!recoveryEmail.trim()) {
      setRecoveryError("Entrez votre adresse email.");
      return;
    }
    setRecoveryLoading(true);
    try {
      await requestPasswordRecovery(recoveryEmail.trim(), `${window.location.origin}/auth/recovery`);
      setRecoverySent(true);
    } catch (err) {
      // Appwrite refuses recovery for an unknown email with a 401 — surfacing
      // that would let anyone probe which addresses have an account, so this
      // always shows the same "check your inbox" outcome either way.
      console.error(err);
      setRecoverySent(true);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const backToLogin = () => {
    setMode("login");
    setRecoverySent(false);
    setRecoveryError("");
    setRecoveryEmail("");
  };

  // Google sign-in as an admin is only meaningful if the account also has
  // the "admin" label (ProtectedRoute checks that) — a non-admin Google
  // account just lands back on the public site, same as typing the URL by
  // hand would. Point the post-login redirect at the dashboard rather than
  // the default "/" so a real admin doesn't have to navigate there again.
  const handleGoogleLogin = () => {
    sessionStorage.setItem("afterLogin", "/dashboard/home");
    loginWithGoogle();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      await refreshUser();
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Connexion impossible. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* Background grid */}
      <div className={styles.grid} aria-hidden />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <img src="/logo-256.png" alt="Follow Me Travel" className={styles.logoImg} />
        </div>

        {mode === "forgot" ? (
          recoverySent ? (
            <>
              <h1 className={styles.title}>Vérifiez vos emails</h1>
              <p className={styles.sub}>
                Si un compte existe pour {recoveryEmail}, un lien de réinitialisation vient de lui être envoyé.
              </p>
              <button className={styles.btn} type="button" onClick={backToLogin}>
                Retour à la connexion
              </button>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Mot de passe oublié</h1>
              <p className={styles.sub}>Indiquez votre email, nous vous envoyons un lien de réinitialisation.</p>

              <form className={styles.form} onSubmit={handleForgotSubmit}>
                <div className={styles.field}>
                  <label className={styles.label}>EMAIL</label>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="you@company.io"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                {recoveryError && <p className={styles.error}>⚠ {recoveryError}</p>}

                <button className={styles.btn} type="submit" disabled={recoveryLoading}>
                  {recoveryLoading ? <span className={styles.spinner} /> : "Envoyer le lien →"}
                </button>
                <button type="button" className={styles.googleBtn} onClick={backToLogin}>
                  Retour à la connexion
                </button>
              </form>
            </>
          )
        ) : (
          <>
            <h1 className={styles.title}>Espace administration</h1>
            <p className={styles.sub}>Connectez-vous pour accéder au tableau de bord</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>EMAIL</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="you@company.io"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </div>

              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label className={styles.label}>PASSWORD</label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: "var(--ink-2)", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="••••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
              </div>

              {error && <p className={styles.error}>⚠ {error}</p>}

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? (
                  <span className={styles.spinner} />
                ) : (
                  "Se connecter →"
                )}
              </button>
            </form>

            <div className={styles.divider}><span>ou</span></div>

            <button type="button" className={styles.googleBtn} onClick={handleGoogleLogin}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.4 38 47 31.9 47 24.6z"/>
                <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"/>
              </svg>
              Continuer avec Google
            </button>
          </>
        )}
      </div>

    </div>
  );
}
