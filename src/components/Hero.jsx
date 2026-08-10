import { useState } from "react";

const DESTINATIONS = [
  {
    id: "tokyo",
    name: "Tokyo",
    flag: "🇯🇵",
    img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=300&q=80",
    style: {
      width: 120,
      height: 86,
      top: 18,
      left: "50%",
      marginLeft: -10,
      animationName: "floatA",
      animationDuration: "5s",
    },
    flagStyle: {
      top: 8,
      left: "calc(50% + 72px)",
    },
  },

  {
    id: "newyork",
    name: "New York",
    flag: "🇺🇸",
    img: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=300&q=80",
    style: {
      width: 108,
      height: 78,
      top: 52,
      left: 28,
      animationName: "floatB",
      animationDuration: "6s",
      animationDelay: "0.8s",
    },
    flagStyle: {
      top: 36,
      left: 110,
    },
  },

  {
    id: "paris",
    name: "Paris",
    flag: "🇫🇷",
    img: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=300&q=80",
    style: {
      width: 104,
      height: 74,
      top: 58,
      right: 22,
      animationName: "floatB",
      animationDuration: "7s",
      animationDelay: "1.6s",
    },
    flagStyle: {
      top: 42,
      right: 8,
    },
  },

  {
    id: "seoul",
    name: "Seoul",
    flag: "🇰🇷",
    img: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=300&q=80",
    style: {
      width: 112,
      height: 80,
      top: 310,
      left: 36,
      animationName: "floatC",
      animationDuration: "5.5s",
      animationDelay: "1.2s",
    },
    flagStyle: {
      top: 292,
      left: 118,
    },
  },

  {
    id: "beijing",
    name: "Beijing",
    flag: "🇬🇾",
    img: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=300&q=80",
    style: {
      width: 116,
      height: 80,
      top: 430,
      left: "50%",
      marginLeft: -58,
      animationName: "floatD",
      animationDuration: "6.5s",
      animationDelay: "0.4s",
    },
    flagStyle: {
      top: 314,
      left: "calc(50% + 44px)",
    },
  },

  {
    id: "delhi",
    name: "Delhi",
    flag: "🇲🇦",
    img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=300&q=80",
    style: {
      width: 114,
      height: 82,
      top: 394,
      right: 24,
      animationName: "floatE",
      animationDuration: "5.8s",
      animationDelay: "2s",
    },
    flagStyle: {
      top: 278,
      right: 6,
    },
  },
];

const CHIPS = [
  "Inspire me where to go",
  "Create a new Trip",
  "Find family hotels in Dubai",
];

export default function TravoLanding({ onSearch }) {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const handleSearch = () => {
    const val = query.trim();
    if (!val) return;
    if (onSearch) { onSearch(val); return; }
    setToast(`✈️ Planning: ${val}`);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <section className="fmt-hero">
      <div className="fmt-hero__bg" />
      <div className="fmt-hero__overlay" />
      <div className="fmt-hero__content">
        
          <div style={{ position: "relative", width: "80%", margin: "140px auto", minHeight: 570, background: "transparent", borderRadius: 20, overflow: "hidden", fontFamily: "'Inter',sans-serif", animation: "fadeIn 0.5s ease forwards" }}>

            {/* Floating destination cards */}
            {DESTINATIONS.map((d) => (
              <div key={d.id}>
                <div
                  className="dest-card"
                  style={{ ...d.style, animationFillMode: "both" }}
                  title={d.name}
                >
                  <img src={d.img} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <span style={{ position: "absolute", bottom: 6, left: 8, fontSize: 11, fontWeight: 600, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.65)" }}>{d.name}</span>
                </div>
                {/* <div className="flag-dot" style={{ ...d.flagStyle, animationName: d.style.animationName, animationDuration: d.style.animationDuration, animationDelay: d.style.animationDelay || "0s" }}>
              {d.flag}
            </div> */}
              </div>
            ))}

            {/* Center content */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 32px" }}>

              {/* Headline */}
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 38, fontWeight: 800, color: "rgb(244, 243, 240)", textAlign: "center", lineHeight: 1.1, letterSpacing: -0.5 }}>
                Where is your next<br />destination?
              </h1>

              {/* Search box */}
              <div style={{ width: "100%", maxWidth: 600, background: "#fff", borderRadius: 18, border: "1px solid #e5e7eb", padding: "14px 14px 14px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="I'm planning a trip to Istanbul..."
                    style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "'Inter',sans-serif", color: "#111827", background: "transparent" }}
                  />
                  <button className="send-btn" onClick={handleSearch} aria-label="Search">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
                {/* Chips */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {CHIPS.map((c) => (
                    <button key={c} className="chip" onClick={() => setQuery(c)}>✦ {c}</button>
                  ))}
                </div>
              </div>
            </div>

           


            {/* Toast */}
            {toast && (
              <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "#fff", padding: "10px 22px", borderRadius: 24, fontSize: 13, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", animation: "toastIn 0.3s ease forwards" }}>
                {toast}
              </div>
            )}
          </div>
      </div>

      <div className="fmt-hero__scroll-hint">↓</div>
    </section>

  );
}