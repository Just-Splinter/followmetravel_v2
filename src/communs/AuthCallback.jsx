import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { account } from "../services/account";
import { useEvents } from "../context/EventsContext";
import { isStaff } from "../services/roles";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { trackAuth, setUserId } = useEvents();

  useEffect(() => {
    async function load() {
      try {
        const u = await account.get();
        if (u && !isStaff(u)) {
          setUserId(u.$id);
          trackAuth({ action: "login", method: "google" });
        }

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
  }, [navigate, trackAuth, setUserId]);

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