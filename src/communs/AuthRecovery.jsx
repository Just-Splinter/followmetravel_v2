import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "../styles/Login.module.css";
import { confirmPasswordRecovery } from "../services/account";

// Landing page for the link the API emails out after requestPasswordRecovery
// (LoginPage's "Mot de passe oublié ?" flow) — userId/secret are appended to
// the URL by the API (api/src/auth/auth.service.ts), valid for one hour.
export default function AuthRecovery() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !userId || !secret;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordRecovery(userId, secret, password);
      setDone(true);
    } catch (err) {
      setError(err?.message || "Ce lien n'est plus valide, demandez-en un nouveau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.grid} aria-hidden />

      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/logo-256.png" alt="Follow Me Travel" className={styles.logoImg} />
        </div>

        {invalidLink ? (
          <>
            <h1 className={styles.title}>Lien invalide</h1>
            <p className={styles.sub}>
              Ce lien de réinitialisation est incomplet ou a expiré. Demandez-en un nouveau
              depuis la page de connexion.
            </p>
            <button className={styles.btn} type="button" onClick={() => navigate("/login")}>
              Retour à la connexion
            </button>
          </>
        ) : done ? (
          <>
            <h1 className={styles.title}>Mot de passe mis à jour</h1>
            <p className={styles.sub}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <button className={styles.btn} type="button" onClick={() => navigate("/login")}>
              Se connecter →
            </button>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Nouveau mot de passe</h1>
            <p className={styles.sub}>Choisissez un nouveau mot de passe pour votre compte.</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.label}>NOUVEAU MOT DE PASSE</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>CONFIRMER</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className={styles.error}>⚠ {error}</p>}

              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? <span className={styles.spinner} /> : "Réinitialiser le mot de passe"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
