import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { account } from "../services/appwrite";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        await account.get();

        const redirect =
          sessionStorage.getItem("afterLogin") || "/";

        sessionStorage.removeItem("afterLogin");

        navigate(redirect, {
          replace: true,
        });
      } catch {
        navigate("/auth/error", {
          replace: true,
        });
      }
    }

    load();
  }, [navigate]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: 18,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          className="ti-loader"
          style={{
            fontSize: 40,
            marginBottom: 20,
            animation: "spin 1s linear infinite",
          }}
        />
        <div>Connexion en cours...</div>
      </div>
    </div>
  );
}