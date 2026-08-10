import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useClickOutside } from "./ClickOutSide";
import { useNavigate } from "react-router-dom";

export default function GoogleAuthButton() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setOpen(false));
  const navigate = useNavigate();

  if (loading)
    return (
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          background: "#f3f3f3",
        }}
      />
    );

  if (!user) {
    return (
      <button
        onClick={loginWithGoogle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 18px",
          borderRadius: 999,
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 600,
          transition: ".2s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>

        Continuer avec Google
      </button>
    );
  }

  return (
    <div
      style={{
        position: "relative",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "white",
          border: "1px solid #eee",
          borderRadius: 999,
          padding: "6px 12px 6px 6px",
          cursor: "pointer",
        }}
      >
        <img
          src={user.photoURL || 'https://cdn-icons-png.flaticon.com/512/10337/10337609.png'}
          alt=""
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />

        <div
          style={{
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {user.name}
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#777",
            }}
          >
            {user.email}
          </div>
        </div>

        ▼
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: 60,
            right: 0,
            width: 240,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,.12)",
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: "1px solid #eee",
            }}
          >
           

            <div style={{ fontWeight: 700 }}>
              {user.name}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#777",
              }}
            >
              {user.email}
            </div>
          </div>

          <button
            onClick={()=> navigate('/profil#infos')}
            style={{
              width: "100%",
              padding: 14,
              border: 0,
              background: "white",
              cursor: "pointer",
            }}
          >
            Mon profil
          </button>

          <button
            onClick={()=> navigate('/profil#reservations')}
            style={{
              width: "100%",
              padding: 14,
              border: 0,
              background: "white",
              cursor: "pointer",
            }}
          >
            Mes réservations
          </button>

          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: 14,
              border: 0,
              background: "#fff5f5",
              color: "#d33",
              cursor: "pointer",
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}