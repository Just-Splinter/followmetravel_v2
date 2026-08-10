import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../styles/FollowMeTravel.css";
import { useTravelData } from "../context/TravelDataContext";
import ScrollToTop, { DestinationCard, Footer, Hero } from "../sites/commun";
import { useNavigate } from "react-router-dom";
import { useEvents } from "../context/EventsContext";
import { Modal } from "./UI";
import ContactPage from "../pages/Contactpage";
import { TravelSearchBar } from "./TravelSearchbar";
import { About } from "./AboutHome";
import "../styles/hero.css";

const AIChat = ({ onClose, destinations }) => {
  const [messages, setMessages] = useState([
    { role: "system", text: "Bonjour ! Je suis votre conseiller voyage IA Follow Me Travel. Décrivez-moi votre voyage idéal et je vous prépare un itinéraire sur mesure ✦" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  //console.log(destinations);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    const history = messages.map(m => ({
      role: m.role === "system" ? "system" : m.role,
      content: m.text,
    }));

    const isBookingIntent = /réserver|booking|devis|prix|marrakech|voyage/i.test(userMsg);

    const systemPrompt =
      `Tu es un assistant expert en voyage, spécialisé dans la création d'itinéraires détaillés, réalistes et adaptés aux envies, au budget et au style de vie du voyageur.
Ton rôle est de recueillir les informations essentielles (destination, dates, départ, budget, préférences), compléter les éléments manquants par des suggestions logiques, et structurer un programme jour par jour.
Adopte un ton chaleureux, professionnel et inspirant. Toujours en Markdown.
Voici les destinations : ` + JSON.stringify(destinations);

    setMessages(prev => [...prev, { role: "assistant", text: "" }]);

    try {
      const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("Assistant IA non configuré (clé API manquante).");

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          stream: true,
          max_tokens: 800,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: "On cas de posez des qestion il faut passé une par une avec validation " },
            ...history,
            { role: "user", content: userMsg },
          ],
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", text: assistantText };
                return copy;
              });
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }

      if (isBookingIntent) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "assistant",
            text: "✦ Parfait, je vais préparer votre demande.\n\nCommençons : combien de voyageurs partez-vous ?",
          }]);
        }, 400);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Erreur streaming. Réessayez ou passez sur WhatsApp." }]);
    }

    setLoading(false);
  };

  return (
    <div className="fmt-chat-modal">
      <div className="fmt-chat-modal__panel">

        {/* Header */}
        <div className="fmt-chat-modal__header">
          <div className="fmt-chat-modal__header-left">
            <img src='src/assets/logo.png' style={{ width: "80px" }}></img>
            <div>
              <div className="fmt-chat-modal__title">Conseiller IA</div>
              <div className="fmt-chat-modal__subtitle">FOLLOW ME TRAVEL</div>
            </div>
          </div>
          <button className="fmt-chat-modal__close" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        <div className="fmt-chat-modal__messages">
          {messages.map((m, i) => (
            <div key={i} className={`fmt-chat-msg fmt-chat-msg--${m.role}`}>
              <div className="fmt-chat-msg__bubble">
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="fmt-chat-modal__typing">
              <div className="fmt-chat-modal__typing-dot" />
              <div className="fmt-chat-modal__typing-dot" />
              <div className="fmt-chat-modal__typing-dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* WhatsApp shortcut */}
        {/* <div className="fmt-chat-modal__wa-bar">
          <a
            href="https://wa.me/212661429349?text=Bonjour%20Follow%20Me%20Travel%2C%20je%20souhaite%20un%20voyage%20sur%20mesure"
            target="_blank"
            rel="noreferrer"
            className="fmt-chat-modal__wa-link"
          >
            <span>💬</span>
            Passer directement sur WhatsApp
          </a>
        </div> */}

        {/* Input */}
        <div className="fmt-chat-modal__input-row">
          <input
            className="fmt-chat-modal__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ex: 2 semaines en Asie, budget 3000€…"
          />
          <button className="fmt-chat-modal__send" onClick={send} disabled={loading}>→</button>
        </div>

      </div>
    </div>
  );
};

const CHIPS = [
  "Inspire me where to go",
  "Create a new Trip",
  "Find family hotels in Dubai",
];

const styles = {
  // Reset & Base
  pageWrapper: {
    fontFamily: "'Playfair Display', Georgia, serif",
    color: "#1a1a2e",
    overflowX: "hidden",
    background: "#fafaf8",
  },

  // Header Top Bar
  headerTopSection: {
    background: "#1a1a2e",
    padding: "10px 0",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 20px",
  },
  headerTopWrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  contactList: {
    display: "flex",
    gap: "24px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  contactListItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#c8b89a",
    fontSize: "13px",
  },
  topRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  topList: {
    display: "flex",
    gap: "16px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  topListLink: {
    color: "#c8b89a",
    textDecoration: "none",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
  },
  socialIcons: {
    display: "flex",
    gap: "10px",
  },
  socialIcon: {
    color: "#c8b89a",
    textDecoration: "none",
    fontSize: "14px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(200, 184, 154, 0.3)",
    borderRadius: "50%",
    transition: "all 0.3s",
  },

  // Sticky Header
  header: {
    background: "transparent",
    padding: "15px 0",
    position: "sticky",
    top: 0,
    zIndex: 1000,
  },
  headerMain: {
    display: "flex",
    paddingTop: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a2e",
    textDecoration: "none",
    fontFamily: "'Playfair Display', serif",
    letterSpacing: "-0.5px",
  },
  logoAccent: {
    color: "rgb(255 117 14)",
  },
  nav: {
    display: "flex",
    gap: "32px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  navLink: {
    color: "#1a1a2e",
    textDecoration: "none",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    letterSpacing: "0.3px",
    transition: "color 0.3s",
    textTransform: "uppercase",
  },
  planeShape: {
    position: "absolute",
    left: "42%",
    top: "80px"
  },
  planeShape2: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  bgShape: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  themeBtn: {
    background: "rgb(255 117 14)",
    color: "#fff",
    border: "none",
    padding: "12px 28px",
    borderRadius: "40px",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
    letterSpacing: "0.3px",
  },
  themeBtnOutline: {
    background: "transparent",
    color: "rgb(255 117 14)",
    border: "2px solid rgb(255 117 14)",
    padding: "10px 24px",
    borderRadius: "40px",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
  },

  // Hero Section
  heroSection: {
    background: "linear-gradient(135deg, #f8f4ef 0%, #fdf9f5 60%, #f0ebe3 100%)",
    padding: "0px 0 60px",
    position: "relative",
    overflow: "hidden",
  },
  rightShape: {
    position: "absolute",
    top: 0,
    right: 0
  },
  leftShape: {
    position: "absolute",
    left: 0,
    top: "154px"
  },
  heroRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "60px",
    marginTop: 50,
    alignItems: "center",
  },
  heroContent: {
    zIndex: 2,
    position: "relative",
  },
  heroTitle: {
    fontSize: "clamp(32px, 5vw, 58px)",
    lineHeight: "1.1",
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: "20px",
    fontFamily: "'Playfair Display', serif",
  },
  heroTitleAccent: {
    color: "rgb(255 117 14)",
    display: "block",
  },
  heroSubtitle: {
    fontSize: "17px",
    color: "#6b6b7a",
    marginBottom: "36px",
    lineHeight: "1.7",
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "420px",
  },
  heroButtons: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "40px",
  },
  heroImageGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gridTemplateRows: "220px 180px",
    gap: "12px",
  },
  heroImg1: {
    gridRow: "1 / 3",
    borderRadius: "20px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
  },
  heroImg2: {
    borderRadius: "16px",
    overflow: "hidden",
    background: "linear-gradient(135deg, #6b9fbd 0%, #3d7a9c 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  heroImg3: {
    borderRadius: "16px",
    overflow: "hidden",
    background: "linear-gradient(135deg, #88c9a1 0%, #4da870 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },

  // Booking Bar
  bookingBar: {
    background: "#fff",
    borderRadius: "20px",
    padding: "20px 28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "30px",
  },
  bookingSelect: {
    flex: 1,
    minWidth: "140px",
    padding: "12px 16px",
    border: "1.5px solid #e8e3db",
    borderRadius: "12px",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1a1a2e",
    background: "#fafaf8",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23d4853a' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "calc(100% - 12px) center",
    paddingRight: "36px",
  },

  // Section Common
  sectionPadding: {
    padding: "90px 0",
  },
  sectionTitle: {
    marginBottom: "50px",
  },
  subTitle: {
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    letterSpacing: "3px",
    color: "rgb(255 117 14)",
    textTransform: "uppercase",
    marginBottom: "12px",
    display: "block",
  },
  sectionH2: {
    fontSize: "clamp(32px, 4vw, 46px)",
    fontWeight: "700",
    color: "#1a1a2e",
    lineHeight: "1.15",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "16px",
  },
  sectionDesc: {
    fontSize: "16px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "500px",
    lineHeight: "1.7",
  },
  sectionTitleArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "40px",
    flexWrap: "wrap",
    gap: "20px",
  },

  // Destination Cards
  destinationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "24px",
  },
  destCard: {
    borderRadius: "20px",
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
  },
  destImageWrap: {
    position: "relative",
    height: "220px",
    overflow: "hidden",
  },
  destImagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    transition: "transform 0.4s",
  },
  destStar: {
    position: "absolute",
    top: "14px",
    right: "14px",
    background: "rgb(255 117 14)",
    color: "#fff",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  destContent: {
    padding: "20px",
  },
  destTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "6px",
  },
  destListing: {
    fontSize: "13px",
    color: "rgb(255 117 14)",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
  },

  // Best Destination (Tour Packages)
  bestDestBg: {
    background: "#1a1a2e",
    padding: "90px 0",
  },
  tourCard: {
    background: "#fff",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    transition: "transform 0.3s",
  },
  tourImageWrap: {
    height: "200px",
    overflow: "hidden",
    position: "relative",
  },
  tourImagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
  },
  offerBadge: {
    position: "absolute",
    top: "14px",
    left: "14px",
    background: "#e74c3c",
    color: "#fff",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
  },
  tourContent: {
    padding: "20px",
  },
  tourMeta: {
    display: "flex",
    gap: "12px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  tourMetaItem: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  tourTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "16px",
    lineHeight: "1.3",
  },
  tourPriceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tourPrice: {
    fontSize: "22px",
    fontWeight: "700",
    color: "rgb(255 117 14)",
    fontFamily: "'Playfair Display', serif",
  },
  tourPriceSub: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
  },

  // About Section
  aboutBg: {
    background: "#fafaf8",
    backgroundImage: "url('https://webnextpro.com/tf/touro/assets/img/home-1/about/shape.png')",
    backgroundRepeat: "no-repeat",
    padding: "90px 0",
    paddingBottom: "20px",
  },
  aboutRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "70px",
    alignItems: "center",
  },
  aboutImageArea: {
    position: "relative",
    height: "480px",
  },
  aboutImg1: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "72%",
    height: "70%",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "100px",
  },
  aboutImg2: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "55%",
    height: "55%",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px"
  },
  counterBadge: {
    position: "absolute",
    top: "30%",
    right: "-5%",
    background: "rgb(255 117 14)",
    color: "#fff",
    borderRadius: "16px",
    padding: "16px 20px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(212, 133, 58, 0.4)",
    zIndex: 3,
  },
  counterNum: {
    fontSize: "32px",
    fontWeight: "700",
    fontFamily: "'Playfair Display', serif",
    display: "block",
    lineHeight: 1,
  },
  counterLabel: {
    fontSize: "11px",
    fontFamily: "'DM Sans', sans-serif",
    opacity: 0.9,
    marginTop: "4px",
  },
  checkList: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    margin: "28px 0",
    listStyle: "none",
    padding: 0,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1a1a2e",
    fontWeight: "500",
  },
  checkIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    flexShrink: 0,
  },

  // Adventures
  adventureBg: {
    background: "#1a1a2e",
    padding: "90px 0",
    position: "relative",
    overflow: "hidden",
  },
  adventureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "16px",
    marginTop: "50px",
  },
  adventureCard: {
    borderRadius: "16px",
    overflow: "hidden",
    position: "relative",
    cursor: "pointer",
    transition: "transform 0.3s",
  },
  adventureImgWrap: {
    height: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px",
    position: "relative",
  },
  adventureOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(transparent, rgba(26,26,46,0.9))",
    padding: "30px 16px 16px",
  },
  adventureTitle: {
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    lineHeight: "1.3",
  },

  // Counter Section
  counterSection: {
    background: "#fff",
    padding: "70px 0",
    borderTop: "1px solid #f0ebe3",
    borderBottom: "1px solid #f0ebe3",
  },
  counterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "30px",
  },
  counterBox: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "24px",
    background: "#fafaf8",
    borderRadius: "16px",
    border: "1px solid #f0ebe3",
  },
  counterIconWrap: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
    flexShrink: 0,
  },
  counterBoxNum: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    lineHeight: 1,
    marginBottom: "4px",
  },
  counterBoxLabel: {
    fontSize: "13px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
  },

  // CTA Offer
  ctaOfferBg: {
    backgroundImage: "url(https://webnextpro.com/tf/touro/assets/img/home-1/cta/bg.jpg)",
    padding: "90px 0",
    position: "relative",
    overflow: "hidden",
  },
  ctaRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "60px",
    alignItems: "center",
  },
  ctaImagesGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "12px",
    height: "360px",
  },
  ctaImg1: {
    borderRadius: "20px",
    background: "linear-gradient(135deg, #6b9fbd, #3d7a9c)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    gridRow: "1/3",
  },
  ctaImg2: {
    borderRadius: "16px",
    background: "linear-gradient(135deg, #88c9a1, #4da870)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  ctaImg3: {
    borderRadius: "16px",
    background: "linear-gradient(135deg, #c8a882, #9b7c5a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  discountCircle: {
    position: "absolute",
    bottom: "30px",
    left: "20px",
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "'Playfair Display', serif",
    boxShadow: "0 10px 30px rgba(212,133,58,0.5)",
  },

  // Team Section
  teamBg: {
    background: "#fafaf8",
    padding: "90px 0",
  },
  teamGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "24px",
    marginTop: "50px",
  },
  teamCard: {
    background: "#fff",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "transform 0.3s",
    textAlign: "center",
  },
  teamImgWrap: {
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    position: "relative",
    overflow: "hidden",
  },
  teamSocialOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(26,26,46,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    opacity: 0,
    transition: "opacity 0.3s",
  },
  teamContent: {
    padding: "16px 20px 20px",
  },
  teamName: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "4px",
  },
  teamRole: {
    fontSize: "13px",
    color: "rgb(255 117 14)",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
  },

  // Testimonials
  testimonialBg: {
    background: "#1a1a2e",
    padding: "90px 0",
  },
  testimonialRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "60px",
    alignItems: "start",
  },
  testimonialGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  testimonialCard: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "24px",
    backdropFilter: "blur(10px)",
  },
  testimonialClientRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  clientInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  clientAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgb(255 117 14), #e8a060)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  clientName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
  },
  clientRole: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "'DM Sans', sans-serif",
  },
  testimonialText: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.7)",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.7",
    marginBottom: "16px",
  },
  stars: {
    display: "flex",
    gap: "4px",
    color: "rgb(255 117 14)",
    fontSize: "13px",
  },

  // News / Blog
  newsBg: {
    background: "#fff",
    padding: "90px 0",
  },
  newsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "28px",
    marginTop: "40px",
  },
  newsCard: {
    borderRadius: "20px",
    overflow: "hidden",
    background: "#fafaf8",
    border: "1px solid #f0ebe3",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
  },
  newsImgWrap: {
    height: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    overflow: "hidden",
  },
  newsContent: {
    padding: "22px",
  },
  newsMeta: {
    display: "flex",
    gap: "12px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  newsMetaItem: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  newsTag: {
    background: "rgb(255 117 14)",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
  },
  newsTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "10px",
    lineHeight: "1.4",
  },
  newsExcerpt: {
    fontSize: "14px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.6",
    marginBottom: "16px",
  },

  // Gallery
  galleryBg: {
    background: "#fafaf8",
    padding: "90px 0",
  },
  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gridTemplateRows: "220px 220px",
    gap: "14px",
  },
  galleryItem: {
    borderRadius: "16px",
    overflow: "hidden",
    cursor: "pointer",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px",
    transition: "transform 0.3s",
  },

  // CTA Banner
  ctaBanner: {
    background: "rgb(255 117 14)",
    padding: "80px 0",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  },
  ctaBannerTitle: {
    fontSize: "clamp(36px, 5vw, 56px)",
    fontWeight: "700",
    color: "#fff",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "20px",
    lineHeight: "1.15",
  },
  ctaBannerSubtitle: {
    fontSize: "16px",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "36px",
    maxWidth: "500px",
    margin: "0 auto 36px",
    lineHeight: "1.7",
  },
  ctaBannerBtn: {
    background: "#fff",
    color: "rgb(255 117 14)",
    border: "none",
    padding: "16px 40px",
    borderRadius: "40px",
    fontSize: "15px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
  },

  // Footer
  footer: {
    background: "#0f0f1e",
    padding: "70px 0 0",
    color: "#c8b89a",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
    gap: "50px",
    marginBottom: "50px",
  },
  footerLogo: {
    fontSize: "28px",
    fontFamily: "'Playfair Display', serif",
    color: "#fff",
    marginBottom: "16px",
    display: "block",
    textDecoration: "none",
  },
  footerDesc: {
    fontSize: "14px",
    color: "rgba(200,184,154,0.7)",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.7",
    marginBottom: "24px",
  },
  footerContact: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "28px",
  },
  footerContactItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#c8b89a",
    fontFamily: "'DM Sans', sans-serif",
  },
  footerHeading: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "20px",
    paddingBottom: "12px",
    borderBottom: "2px solid rgb(255 117 14)",
    display: "inline-block",
  },
  footerLinks: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  footerLink: {
    fontSize: "14px",
    color: "rgba(200,184,154,0.7)",
    textDecoration: "none",
    fontFamily: "'DM Sans', sans-serif",
    transition: "color 0.3s",
  },
  footerNewsletter: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  footerInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "40px",
    border: "1px solid rgba(200,184,154,0.3)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  footerBottom: {
    borderTop: "1px solid rgba(200,184,154,0.15)",
    padding: "24px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  footerCopy: {
    fontSize: "13px",
    color: "rgba(200,184,154,0.5)",
    fontFamily: "'DM Sans', sans-serif",
  },

  // Back to top
  backToTop: {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    color: "#fff",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 20px rgba(212,133,58,0.4)",
    zIndex: 999,
    transition: "all 0.3s",
  },

  // Brands
  brandsBg: {
    background: "#fff",
    padding: "50px 0",
    borderBottom: "1px solid #f0ebe3",
  },
  brandsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "48px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "20px",
  },
  brandItem: {
    fontSize: "20px",
    fontFamily: "'Playfair Display', serif",
    color: "#c8b89a",
    fontWeight: "700",
    letterSpacing: "2px",
    transition: "color 0.3s",
    cursor: "default",
  },
};



const galleryItems = [
  { emoji: "https://www.followmetravel.ma/images/upload/1729441863xmsf-morocco-sahara-pax-camel-ride.webp", gradient: "linear-gradient(135deg, #e8c77a, #c4933f)", gridArea: "1 / 1 / 3 / 2" },
  { emoji: "https://www.followmetravel.ma/images/upload/17017174282023-10-11-10-54-131.webp", gradient: "linear-gradient(135deg, #82cfff, #3d99d4)", gridArea: "1 / 2 / 2 / 3" },
  { emoji: "https://www.followmetravel.ma/images/upload/17017174282023-10-11-10-54-130.webp", gradient: "linear-gradient(135deg, #88c9a1, #4da870)", gridArea: "2 / 2 / 3 / 3" },
  { emoji: "https://www.followmetravel.ma/images/upload/1729370055widiane-suites-spa.webp", gradient: "linear-gradient(135deg, #d4a0c8, #9b5fa5)", gridArea: "1 / 3 / 2 / 4" },
  { emoji: "https://www.followmetravel.ma/images/upload/1757857497674058367.jpg", gradient: "linear-gradient(135deg, #ffb86c, #e8751c)", gridArea: "2 / 3 / 3 / 4" },
];



function Button({ children, variant = "filled", style: extraStyle = {}, onClick }) {
  const base = variant === "outline" ? styles.themeBtnOutline : styles.themeBtn;
  const [hovered, setHovered] = useState(false);
  const hoverStyle = hovered
    ? variant === "outline"
      ? { background: "rgb(255 117 14)", color: "#fff" }
      : { background: "#c4733a", transform: "translateY(-2px)" }
    : {};
  return (
    <span
      style={{ ...base, ...extraStyle, ...hoverStyle, cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </span>
  );
}


function PackageCard({ pkg }) {
  const _id = pkg.$id;
  pkg = JSON.parse(pkg.data);
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={'/packages/view?pkgId=' + _id}
      style={{ ...styles.destCard, transform: hovered ? "translateY(-8px)" : "none", boxShadow: hovered ? "0 16px 40px rgba(0,0,0,0.14)" : "0 4px 20px rgba(0,0,0,0.06)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.destImageWrap}>
        <img src={pkg.heroBg || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDCy4i-sCq0eOXc0q0qxf14tM3Sm_ReI1ykg&s'} style={{ ...styles.destImagePlaceholder, background: pkg.gradient, transform: hovered ? "scale(1.07)" : "scale(1)" }}></img>
        <div style={styles.destStar}>A partir {pkg.basePrice} DH </div>
      </div>
      <div style={styles.destContent}>
        <div style={styles.destTitle}>{pkg.itineraryTitle}</div>
        <div style={styles.destListing}>{pkg.durationLabel}</div>
      </div>
    </a>
  );
}

function TeamCard({ member }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ ...styles.teamCard, transform: hovered ? "translateY(-6px)" : "none" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ ...styles.teamImgWrap, background: member.bg }}>
        <img src={member.emoji}></img>
        <div style={{ ...styles.teamSocialOverlay, opacity: hovered ? 1 : 0 }}>
          {["f", "t", "p", "ig"].map((s, i) => (
            <span key={i} style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgb(255 117 14)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px", cursor: "pointer" }}>{s[0].toUpperCase()}</span>
          ))}
        </div>
      </div>
      <div style={styles.teamContent}>
        <div style={styles.teamName}>{member.name}</div>
        <div style={styles.teamRole}>{member.role}</div>
      </div>
    </div>
  );
}

export default function TravelPage() {
  const [scrolled, setScrolled] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiOpenDraft] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const { trackClick } = useEvents();
  const {
    destinations,
    adventures,
    team,
    testimonials,
    packages,
  } = useTravelData();

  const maxIndex = Math.max(0, packages.length - itemsPerPage);

  const isPrevDisabled = currentIndex === 0;
  const isNextDisabled = currentIndex >= maxIndex;


  const next = () => {
    setCurrentIndex((prev) => Math.min(prev + itemsPerPage, maxIndex));
  };

  const prev = () => {
    setCurrentIndex((prev) => Math.max(prev - itemsPerPage, 0));
  };

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 768)
        setItemsPerPage(1);
      else if (window.innerWidth < 1024)
        setItemsPerPage(2);
      else
        setItemsPerPage(4);
    };

    resize();

    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const navigate = useNavigate();

  return (
    <div style={styles.pageWrapper}>
      <ScrollToTop />

      <img
        src="https://png.pngtree.com/png-vector/20250320/ourmid/pngtree-realistic-passenger-airplane-in-mid-flight-isolated-on-transparent-background-png-image_15788014.png"
        className="plane"
      />
      {/* Back to top */}
      {scrolled && (
        <button onClick={scrollToTop} style={styles.backToTop} aria-label="Back to top">↑</button>
      )}

      {/* Hero */}
      <Hero></Hero>

      {/* Popular Destinations */}
      <section style={{ ...styles.sectionPadding, background: "#fff" }} id="destination">
        {/* AI box */}
        {/* Booking Bar */}
        {aiOpenDraft && <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 700,
            bottom: 30,
            zIndex: 10000,
            borderRadius: 18,
            background: "white",
            border: "1px solid #e5e7eb",
            padding: "14px 14px 14px 20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)"
          }}
        >          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              //value={query}
              //onChange={(e) => setQuery(e.target.value)}
              //onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="I'm planning a trip to Istanbul..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "'Inter',sans-serif", color: "#111827", background: "transparent" }}
            />
            <button className="send-btn"
              onClick={() => { setAiOpen(true) }}
              aria-label="Search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
          {/* Chips */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {CHIPS.map((c) => (
              <button key={c} className="chip"
              //onClick={() => setQuery(c)}
              >✦ {c}</button>
            ))}
          </div>
        </div>}
        <TravelSearchBar></TravelSearchBar>

        <div style={styles.container}>
          <div style={styles.sectionTitleArea}>
            <div>
              <span style={styles.subTitle}>Popular Destination</span>
              <h2 style={styles.sectionH2}>Our Popular<br />Destination</h2>
              <p style={styles.sectionDesc}>Nous donnons une dimension aventureuse à vos voyages, en vous proposant des destinations de plein air partout dans le monde.
                Commencez votre aventure dès maintenant !</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={prev}
                disabled={isPrevDisabled}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid rgb(255 117 14)",
                  background: isPrevDisabled ? "#f5f5f5" : "transparent",
                  color: isPrevDisabled ? "#bbb" : "rgb(255 117 14)",
                  cursor: isPrevDisabled ? "not-allowed" : "pointer",
                  opacity: isPrevDisabled ? 0.6 : 1,
                  transition: "0.3s"
                }}
              >
                ←
              </button>

              <button
                onClick={next}
                disabled={isNextDisabled}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: isNextDisabled
                    ? "#ddd"
                    : "rgb(255 117 14)",
                  color: "#fff",
                  cursor: isNextDisabled ? "not-allowed" : "pointer",
                  opacity: isNextDisabled ? 0.6 : 1,
                  transition: "0.3s"
                }}
              >
                →
              </button>
            </div>
          </div>
          <div
            style={{
              overflow: "hidden",
              width: "100%"
            }}
          >
            <div
              style={{
                display: "flex",
                transition: "0.5s ease",
                transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`
              }}
            >
              {destinations.map((d, i) => (
                <div
                  key={i}
                  style={{
                    flex: `0 0 ${100 / itemsPerPage}%`,
                    padding: "12px",
                    boxSizing: "border-box"
                  }}
                >
                  <DestinationCard dest={d} key={i} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Brands */}
      <div style={styles.brandsBg}>
        <div style={styles.container}>
          <p style={{ textAlign: "center", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", color: "#c8b89a", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Trips awarded and featured by:</p>
          <div style={styles.brandsRow}>
            {["TRIPADVISOR", "LONELY PLANET", "NATIONAL GEO", "AIRBNB", "BOOKING", "EXPEDIA"].map((b, i) => (
              <span key={i} style={styles.brandItem}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* About */}
      <About></About>

      {/* Best Destinations */}
      <section style={styles.bestDestBg}>
        <div style={styles.container}>
          <div style={{ ...styles.sectionTitle, textAlign: "center" }}>
            <span style={{ ...styles.subTitle, color: "rgba(200,184,154,0.8)" }}>Meilleure destination</span>
            <h2 style={{ ...styles.sectionH2, color: "#fff" }}>Des destinations qui inspirent l'évasion</h2>
            <p style={{ ...styles.sectionDesc, color: "rgba(255,255,255,0.6)", maxWidth: "500px", margin: "0 auto" }}>
              Des montagnes majestueuses aux plages paradisiaques, découvrez des expériences uniques soigneusement sélectionnées pour les amoureux du voyage et de l'aventure.            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginTop: "40px" }}>
            {packages.map((t, i) => <PackageCard key={i} pkg={t} />)}
          </div>
        </div>
      </section>

      {/* Adventures */}
      <section style={styles.adventureBg}>
        <div style={styles.container}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "end", marginBottom: "20px" }}>
            <div>
              <span style={{ ...styles.subTitle, color: "rgba(200,184,154,0.8)" }}>
                Aventures authentiques
              </span>

              <h2
                style={{
                  ...styles.sectionH2,
                  color: "#fff",
                  marginBottom: "12px",
                }}
              >
                Vivez des aventures uniques
                <br />
                au plus près de la nature
              </h2>
            </div>

            <p
              style={{
                ...styles.sectionDesc,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Explorez des paysages exceptionnels et laissez-vous guider vers des
              expériences inoubliables. Notre expertise est de sélectionner les plus
              belles destinations en plein air afin de vous offrir des voyages riches en
              découvertes, en émotions et en liberté.
            </p>
          </div>
          <div style={styles.adventureGrid}>
            {adventures.map((a, i) => (
              <div key={i} style={{ ...styles.adventureCard }}>
                <div onClick={() => {
                  trackClick('click', a.name, a.$id, '/')
                  navigate(
                    `/search?adventures=${a.$id}`
                  );
                }} style={{ ...styles.adventureImgWrap, background: a.gradient }}>
                  <img src={a.emoji}></img>
                  <div style={styles.adventureOverlay}>
                    <div style={styles.adventureTitle}>{a.name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Counter */}
      <section style={styles.counterSection}>
        <div style={styles.container}>
          <div style={styles.counterGrid}>
            {[
              { num: "34+", label: "Worldwide Branches", emoji: "https://webnextpro.com/tf/touro/assets/img/home-1/icon/01.svg" },
              { num: "12k+", label: "Total Destinations", emoji: "https://webnextpro.com/tf/touro/assets/img/home-1/icon/02.svg" },
              { num: "44k", label: "International Trips", emoji: "https://webnextpro.com/tf/touro/assets/img/home-1/icon/03.svg" },
              { num: "18k+", label: "Happy Travelers", emoji: "https://webnextpro.com/tf/touro/assets/img/home-1/icon/04.svg" },
            ].map((c, i) => (
              <div key={i} style={styles.counterBox}>
                <img src={c.emoji} style={styles.counterIconWrap}></img>
                <div>
                  <div style={styles.counterBoxNum}>{c.num}</div>
                  <div style={styles.counterBoxLabel}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Offer */}
      <section style={styles.ctaOfferBg}>
        <div style={styles.container}>
          <div style={styles.ctaRow}>
            <div style={{ position: "relative" }}>
              <div style={styles.ctaImagesGrid}>
                <img src="https://webnextpro.com/tf/touro/assets/img/home-1/cta/05.jpg" style={styles.ctaImg1}></img>
                <img src="https://webnextpro.com/tf/touro/assets/img/home-1/cta/06.jpg" style={styles.ctaImg2}></img>
                <img src="https://webnextpro.com/tf/touro/assets/img/home-1/cta/07.jpg" style={styles.ctaImg3}></img>
              </div>
              <div style={styles.discountCircle}>
                <span style={{ fontSize: "11px", fontFamily: "'DM Sans', sans-serif", opacity: 0.85 }}>UP TO</span>
                <span style={{ fontSize: "32px", fontWeight: "700", lineHeight: 1 }}>50%</span>
                <span style={{ fontSize: "11px", fontFamily: "'DM Sans', sans-serif", fontWeight: "600", letterSpacing: "1px" }}>DISCOUNT</span>
              </div>
            </div>
            <div>
              <span style={{ ...styles.subTitle, color: "rgba(200,184,154,0.8)" }}>Exclusive Offers</span>
              <h2 style={{ ...styles.sectionH2, color: "#fff", marginBottom: "20px" }}>Singapore and Thailand 4<br />Friendship Tour</h2>
              <p style={{ ...styles.sectionDesc, color: "rgba(255,255,255,0.65)", maxWidth: "100%", marginBottom: "32px" }}>
                We are experienced in bringing adventures to their journey, with all outdoor destinations on the world as our specialties. Start your adventure now! Nature has already called you!
              </p>
              <Button style={{ background: 'black' }}>→ Discover Offers</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={styles.teamBg}>
        <div style={styles.container}>
          <div style={{ ...styles.sectionTitle, textAlign: "center" }}>
            <span style={styles.subTitle}>Tour Guider</span>
            <h2 style={styles.sectionH2}>Our Tour Guider</h2>
            <p style={{ ...styles.sectionDesc, margin: "0 auto", textAlign: "center" }}>
              Bringing adventures to their journey, with all outdoor destinations on the world as our specialties.
            </p>
          </div>
          <div style={styles.teamGrid}>
            {team.map((m, i) => <TeamCard key={i} member={m} />)}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={styles.testimonialBg} id="testimonial">
        <div style={styles.container}>
          <div style={styles.testimonialRow}>
            <div>
              <span style={{ ...styles.subTitle, color: "rgba(200,184,154,0.8)" }}>Our Testimonials</span>
              <h2 style={{ ...styles.sectionH2, color: "#fff" }}>See What They are Talking About Touro?</h2>
              <p style={{ ...styles.sectionDesc, color: "rgba(255,255,255,0.6)" }}>
                Bringing adventures to their journey, with all outdoor destinations on the world as our specialties.
              </p>
            </div>
            <div style={styles.testimonialGrid}>
              {testimonials.map((t, i) => (
                <div key={i} style={styles.testimonialCard}>
                  <div style={styles.testimonialClientRow}>
                    <div style={styles.clientInfo}>
                      <img src={t.emoji} style={styles.clientAvatar}></img>
                      <div>
                        <div style={styles.clientName}>{t.name}</div>
                        <div style={styles.clientRole}>{t.role}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: "24px", opacity: 0.3 }}>"</span>
                  </div>
                  <p style={styles.testimonialText}>{t.text}</p>
                  <div style={styles.stars}>{"⭐⭐⭐⭐⭐"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={styles.ctaBanner}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 40%)" }} />
        <div style={styles.container}>
          <h2 style={styles.ctaBannerTitle}>Let's go, so pack your bags<br />For Exciting Trip!</h2>
          <p style={styles.ctaBannerSubtitle}>Start planning your dream adventure today. The world is waiting for you to explore its wonders.</p>
          <a href="#destination" style={styles.ctaBannerBtn}>→ Explore Destinations</a>
        </div>
      </section>

      {/* Gallery */}
      <section style={styles.galleryBg}>
        <div style={styles.container}>
          <div style={styles.sectionTitleArea}>
            <div>
              <span style={styles.subTitle}>Our Gallery</span>
              <h2 style={styles.sectionH2}>View Our Image Gallery</h2>
            </div>
            <Button variant="outline">View All Photos</Button>
          </div>
          <div style={{ ...styles.galleryGrid }}>
            {galleryItems.map((g, i) => (
              <div key={i} style={{ ...styles.galleryItem, background: g.gradient, gridArea: g.gridArea }}>
                <img src={g.emoji} style={{ width: "100%", height: "100%", objectFit: "cover" }}></img>
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s" }} />
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* Footer */}
      <Footer></Footer>

      {contactOpen && <Modal onClose={() => setContactOpen(false)} >
        <ContactPage></ContactPage>
      </Modal>}
      {aiOpen && <AIChat destinations={packages} onClose={() => setAiOpen(false)} />}
    </div>
  );
}