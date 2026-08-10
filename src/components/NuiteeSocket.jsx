import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

export default function NuiteeCombined() {
  // --- ÉTATS POUR LE SOCKET ---
  const [socketMessages, setSocketMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  // --- ÉTATS POUR LE HTTP POST ---
  const [httpResponse, setHttpResponse] = useState(null);
  const [httpLoading, setHttpLoading] = useState(false);
  const [httpError, setHttpError] = useState(null);

  // --- INITIALISATION DU SOCKET ---
  useEffect(() => {
    const socket = io("https://demo-distribution-nuitee.nuitee.link", {
      transports: ["websocket"],
      query: { language: "fr" },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket Disconnected:", reason);
      setConnected(false);
    });

    socket.onAny((event, ...args) => {
      console.log("Socket Event:", event, args);
      setSocketMessages((prev) => [
        ...prev,
        { event, data: args, date: new Date().toISOString() },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // --- HANDLER POUR LE SOCKET (hotels:fetch-rates) ---
  const handleSocketEmit = () => {
    if (socketRef.current) {
      socketRef.current.emit("hotels:fetch-rates", {
        requestId: "72hfn",
        placeId: "34.0531,-6.7985",
        checkin: "2026-06-24",
        checkout: "2026-06-25",
        rooms: "1",
        adults: "2",
        currency: "MAD",
        guestNationality: "MA",
        domain: "demo-distribution-nuitee.link",
        occupancies: [{ adults: 2, children: [] }],
        limit: null,
        isGuestUser: true,
        searchHotelName: "",
        clustering: false,
        stars: "",
        distance: "",
        freeCancellation: 1,
        hotelName: "",
        ratings: "",
        facilities: "",
        roomAmenities: "",
        mealPlans: "",
        chains: "",
        hotelTypes: "",
        suburbs: "",
        popularFilters: "",
        receptionAndRestaurant: [],
        elevator: [],
        room: [],
        bathroom: [],
        stairs: [],
        poolAndSpa: [],
        parking: [],
        publicToilets: [],
        accessibilityCategories: [],
        city: "Près de moi",
        sessionId: "ca5adab7-15b9-4f30-be32-b74342f1e54c",
        trackingId: "ca5adab7-15b9-4f30-be32-b74342f1e54c",
        currencyMaxPrice: 10000,
        language: "fr",
        clientReference: null,
      });
    }
  };

  // --- HANDLER POUR LE HTTP POST (/v1/hotels/filters) ---
  const handleHttpPost = async () => {
    setHttpLoading(true);
    setHttpError(null);
    setHttpResponse(null);

    const url =
      "https://demo-distribution-nuitee.nuitee.link/v1/hotels/filters?sessionId=ca5adab7-15b9-4f30-be32-b74342f1e54c&trackingId=ca5adab7-15b9-4f30-be32-b74342f1e54c&language=fr";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({}), // Décommente si tu as un body à envoyer
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP : ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setHttpResponse(data);
    } catch (err) {
      setHttpError(err.message);
      console.error("Erreur HTTP :", err);
    } finally {
      setHttpLoading(false);
    }
  };

  // --- STYLES COMMUNS ---
  const buttonStyle = (isActive, color) => ({
    padding: "10px 20px",
    marginRight: 10,
    marginBottom: 15,
    cursor: isActive ? "pointer" : "not-allowed",
    backgroundColor: isActive ? color : "#ccc",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
  });

  const boxStyle = {
    border: "1px solid #ddd",
    padding: 15,
    maxHeight: 400,
    overflow: "auto",
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
    marginTop: 10,
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>Test API Nuitee (HTTP & Socket)</h2>

      {/* ================= SECTION HTTP POST ================= */}
      <div style={{ marginBottom: 40, borderBottom: "2px solid #eee", paddingBottom: 20 }}>
        <h3>1. HTTP POST : Récupérer les filtres</h3>
        
        <button
          onClick={handleHttpPost}
          disabled={httpLoading}
          style={buttonStyle(!httpLoading, "#28a745")}
        >
          {httpLoading ? "Chargement..." : "Envoyer POST /v1/hotels/filters"}
        </button>

        {httpError && (
          <div style={{ color: "red", backgroundColor: "#ffe6e6", padding: 10, borderRadius: 4, marginBottom: 10 }}>
            {httpError}
          </div>
        )}

        <div style={boxStyle}>
          {httpResponse ? (
            <pre>{JSON.stringify(httpResponse, null, 2)}</pre>
          ) : (
            <p style={{ color: "#888", fontStyle: "italic" }}>En attente de la réponse HTTP...</p>
          )}
        </div>
      </div>

      {/* ================= SECTION SOCKET ================= */}
      <div>
        <h3>
          2. Socket.IO : Statut{" "}
          <span style={{ color: connected ? "green" : "red" }}>
            {connected ? "🟢 Connecté" : "🔴 Déconnecté"}
          </span>
        </h3>

        <button
          onClick={handleSocketEmit}
          disabled={!connected}
          style={buttonStyle(connected, "#007bff")}
        >
          Envoyer Socket hotels:fetch-rates
        </button>
        
        <button 
          onClick={() => setSocketMessages([])} 
          style={buttonStyle(true, "#6c757d")}
        >
          Vider les logs Socket
        </button>

        <div style={boxStyle}>
          {socketMessages.length === 0 ? (
            <p style={{ color: "#888", fontStyle: "italic" }}>En attente d'événements Socket...</p>
          ) : (
            socketMessages.map((msg, index) => (
              <pre key={index} style={{ borderBottom: "1px dashed #ccc", paddingBottom: 10, marginBottom: 10 }}>
                {JSON.stringify(msg, null, 2)}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
}