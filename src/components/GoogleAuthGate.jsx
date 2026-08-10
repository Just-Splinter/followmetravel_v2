import { useAuth } from "../context/AuthContext";

export function GoogleAuthGate({ onAuthenticated, children }) {
  const { user, loading, loginWithGoogle } = useAuth();

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#7a6a50", fontSize: 13 }}>
      Vérification…
    </div>
  );

  if (user) {
    // connecté → on affiche le contenu normal
    if (onAuthenticated) onAuthenticated(user);
    return children;
  }

  // non connecté → on bloque avec le prompt Google
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 20, padding: "48px 24px",
      fontFamily: "'Nunito Sans','Segoe UI',sans-serif",
    }}>
      <div style={{ fontSize: 40 }}>🔐</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#1a3a5c", marginBottom: 8 }}>
          Connexion requise
        </div>
        <div style={{ fontSize: 13, color: "#7a6a50", lineHeight: 1.6, maxWidth: 320 }}>
          Connectez-vous pour finaliser votre réservation et accéder à votre espace personnel.
        </div>
      </div>

      <button
        onClick={loginWithGoogle}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1.5px solid #d0c8b8",
          borderRadius: 8, padding: "12px 24px",
          fontSize: 14, fontWeight: 700, color: "#2a1f0a",
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#C8A45A"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#d0c8b8"}
      >
        {/* Google SVG logo */}
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continuer avec Google
      </button>

      <div style={{ fontSize: 11, color: "#b0a090", textAlign: "center", lineHeight: 1.5 }}>
        Vos données sont sécurisées.<br />Aucun paiement requis à cette étape.
      </div>
    </div>
  );
}