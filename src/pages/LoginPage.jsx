import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/appwrite";
import "../marketing/marketing.css";

/** Espace équipe — the dashboard sign-in, in the house style. */
export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

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
    <div className="mk mk-login">
      {/* the view — a window on the world, in the house palette */}
      <aside className="mk-login-scene mk-grain" aria-hidden="true">
        <img src="/hero/kerala.avif" alt="" fetchPriority="high" />
        <div className="mk-login-shade" />
        <a className="mk-login-logo" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          <img src="/logo-256.png" alt="Follow Me Travel" />
        </a>
        <p className="mk-login-quote">
          <span className="mk-eyebrow">Espace équipe</span>
          Le monde est vaste.<br />Partons bien accompagnés.
        </p>
      </aside>

      {/* the sheet */}
      <main className="mk-login-sheet">
        <div className="mk-login-in">
          <span className="mk-eyebrow">Follow Me Travel — Administration</span>
          <h1>Bon retour</h1>
          <p className="mk-login-sub">Connectez-vous pour accéder au tableau de bord.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mk-field">
              <label htmlFor="l_email">E-mail</label>
              <input
                id="l_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="mk-field">
              <label htmlFor="l_password">Mot de passe</label>
              <input
                id="l_password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
            </div>

            {error && <p className="mk-login-err">⚠ {error}</p>}

            <button className="mk-btn mk-login-btn" type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mk-login-note">Accès réservé à l'équipe Follow Me Travel.</p>
        </div>
        <footer className="mk-login-foot">
          <span>© {new Date().getFullYear()} Follow Me Travel</span>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>← Retour au site</a>
        </footer>
      </main>
    </div>
  );
}
