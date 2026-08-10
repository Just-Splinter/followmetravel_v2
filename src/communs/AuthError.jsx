import { useNavigate } from "react-router-dom";

export default function AuthError() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          width: 420,
          background: "#fff",
          padding: 30,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 64,
            marginBottom: 20,
          }}
        >
          ❌
        </div>

        <h2>Connexion impossible</h2>

        <p
          style={{
            color: "#777",
            marginTop: 12,
            marginBottom: 30,
          }}
        >
          L'authentification Google a été annulée ou une erreur est survenue.
          Les redirections OAuth ont cette délicieuse habitude de casser pour
          une virgule mal placée. Les protocoles sont des divas.
        </p>

        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: 0,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}