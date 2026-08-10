import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Login.module.css";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/appwrite";

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

    // Message Appwrite
    if (err?.message) {
      setError(err.message);
    } else {
      setError("Unable to login. Please try again.");
    }
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
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>MiniPostman</span>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>Sign in to your workspace</p>

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
            <label className={styles.label}>PASSWORD</label>
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
              "Sign in →"
            )}
          </button>
        </form>

        <p className={styles.hint}>
          No account? <span className={styles.link}>Request access</span>
        </p>
      </div>
    </div>
  );
}