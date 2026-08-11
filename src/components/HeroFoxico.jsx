import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClickOutside } from "./ClickOutSide";
import { slideBg, slideCard } from "../services/heroSlides";
import "../styles/HeroFoxico.css";

// Dev affordances: ?fxvw=1440 forces the measured viewport width (lets the
// desktop canvas render in a small window), ?fxslow=8 slows every hero
// animation down for frame-by-frame inspection.
const QS = new URLSearchParams(window.location.search);
const FORCED_VW = Number(QS.get("fxvw")) || null;
const SLOW = Number(QS.get("fxslow")) || 1;
const viewportW = () => FORCED_VW || window.innerWidth;

// ─── Design canvas (measured from the reference video, 1440×800) ─────────────
const CANVAS_W = 1440;
const CANVAS_H = 800;

// Card slots (slot 0 is the featured "next up" card)
const SLOT0 = { x: 778, y: 230, w: 272, h: 407 };
const SLOTN = { y: 264, w: 269, h: 340 };
const SLOT_GAP = 22;
const ENTER_OFFSET = 320; // incoming card starts this far right of its slot

// Rail
const RAIL_X = 47;
const RAIL_TOP = 210;
const RAIL_STEP = 115;

// Timing: slide every 5s; each transition lasts ~620ms (background = pure fade)
const AUTOPLAY_MS = 5000 * SLOW;
const DUR = 620 * SLOW;
const EASE = "cubic-bezier(0.55, 0.06, 0.25, 1)";

function slotRect(n) {
  if (n === 0) return { ...SLOT0 };
  const x = SLOT0.x + SLOT0.w + SLOT_GAP + (n - 1) * (SLOTN.w + SLOT_GAP);
  return { x, y: SLOTN.y, w: SLOTN.w, h: SLOTN.h };
}

const titleCase = (s) =>
  (s || "").charAt(0).toUpperCase() + (s || "").slice(1).toLowerCase();

// Compact auth control matching the reference's "Hello , Anney !" slot
function HeroAuth() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  if (loading) return <span className="fx-hello" style={{ opacity: 0.5 }}>…</span>;
  if (!user)
    return (
      <button className="fx-hello" onClick={loginWithGoogle}>
        Se connecter
      </button>
    );
  const first = (user.name || user.email || "").split(/[ @]/)[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="fx-hello" onClick={() => setOpen((o) => !o)}>
        Hello , {first} !
      </button>
      {open && (
        <div className="fx-hello-menu">
          <button onClick={() => navigate("/profil#profil")}>Mon profil</button>
          <button onClick={() => navigate("/profil#reservations")}>Mes réservations</button>
          <button onClick={() => logout().then(() => window.location.reload())}>Déconnexion</button>
        </div>
      )}
    </div>
  );
}

// ─── Card sprite: absolutely positioned, morphs between slots via CSS ────────
function CardSprite({ slide, rect, entering, hidden, onClick }) {
  const [style, setStyle] = useState(() =>
    entering
      ? { left: rect.x + ENTER_OFFSET, top: rect.y, width: rect.w, height: rect.h, opacity: 0 }
      : { left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity: 1 }
  );

  useEffect(() => {
    // double rAF so the entering position paints before transitioning to target
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setStyle({ left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity: hidden ? 0 : 1 });
      });
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [rect.x, rect.y, rect.w, rect.h, hidden]);

  return (
    <div
      className="fx-card"
      style={{ ...style, transition: `all ${DUR}ms ${EASE}` }}
      onClick={onClick}
    >
      <div className="fx-card-caption">
        <div className="fx-card-label">{slide.cardLabel || slide.name}</div>
        <div className="fx-card-dots">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < (slide.dots ?? 4) ? "on" : ""} />
          ))}
        </div>
      </div>
      <div className="fx-card-img-wrap">
        <img src={slideCard(slide)} alt={slide.name} draggable={false} />
        <button className="fx-card-bookmark" aria-label="Bookmark" onClick={(e) => e.stopPropagation()}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
            <path d="M2 0h10a1.2 1.2 0 0 1 1.2 1.2V15.3a.55.55 0 0 1-.87.45L7 12.1l-5.33 3.65a.55.55 0 0 1-.87-.45V1.2A1.2 1.2 0 0 1 2 0Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main hero ───────────────────────────────────────────────────────────────
export default function HeroFoxico({ slides }) {
  const N = slides.length;
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState(null); // { from, to }
  const [scale, setScale] = useState(1);
  const [canvasLeft, setCanvasLeft] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => viewportW() >= 1024);
  const timerRef = useRef(null);
  const animLock = useRef(false);
  const navigate = useNavigate();

  // Responsive scale of the 1440×800 canvas
  useEffect(() => {
    const onResize = () => {
      const vw = viewportW();
      setIsDesktop(vw >= 1024);
      setScale(Math.min(vw, 1920) / CANVAS_W);
      setCanvasLeft(Math.max(0, (vw - 1920) / 2));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Preload all images once
  useEffect(() => {
    slides.forEach((s) => {
      [slideBg(s), slideCard(s)].forEach((src) => {
        if (src) { const im = new Image(); im.src = src; }
      });
    });
  }, [slides]);

  const advance = useCallback(
    (to) => {
      if (animLock.current || N < 2) return;
      to = ((to % N) + N) % N;
      if (to === idx) return;
      animLock.current = true;
      setAnim({ from: idx, to });
      setTimeout(() => {
        setIdx(to);
        setAnim(null);
        animLock.current = false;
      }, DUR + 60);
    },
    [idx, N]
  );

  // Autoplay
  useEffect(() => {
    if (N < 2) return;
    timerRef.current = setInterval(() => {
      if (!animLock.current && !document.hidden) advance(idx + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [advance, idx, N]);

  const manual = (to) => {
    clearInterval(timerRef.current);
    advance(to);
  };

  const active = anim ? anim.to : idx;
  const ghostIdx = (active + 1) % N;

  // Card queue: every slide except the active one, in cycle order.
  // During a transition the same DOM nodes (keyed by $id) receive their new
  // slot rects and CSS-transition into place; the outgoing slide's card mounts
  // off-canvas right and slides in.
  const queue = useMemo(() => {
    const q = [];
    for (let k = 1; k < N; k++) q.push((active + k) % N);
    return q;
  }, [active, N]);

  const pad = (n) => String(n).padStart(2, "0");

  if (N === 0) return null;
  const cur = slides[idx];
  const nxt = anim ? slides[anim.to] : null;

  // ─── Mobile / tablet layout ────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <section className="fx-hero fx-hero--mobile">
        <div className="fx-bg-stack">
          {slides.map((s, i) => (
            <div key={s.$id} className="fx-bg" style={{ backgroundImage: `url(${slideBg(s)})`, opacity: i === active ? 1 : 0 }} />
          ))}
        </div>
        <div className="fx-overlay" />
        <header className="fx-m-nav">
          <a href="/"><img src="/logo.png" alt="Follow Me Travel" /></a>
          <HeroAuth />
        </header>
        <div className="fx-m-content">
          <div className="fx-title-mask" key={active}>
            <h1 className="fx-title">{(slides[active].name || "").toUpperCase()}</h1>
          </div>
          <p className="fx-m-para">{slides[active].description}</p>
          <button className="fx-explore" onClick={() => navigate("/search")}>
            Explore <span className="fx-explore-arrow">→</span>
          </button>
        </div>
        <div className="fx-m-cards">
          {queue.map((qi) => (
            <div key={slides[qi].$id} className="fx-m-card" onClick={() => manual(qi)}>
              <img src={slideCard(slides[qi])} alt={slides[qi].name} />
              <span>{slides[qi].cardLabel || slides[qi].name}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ─── Desktop: scaled 1440×800 canvas ───────────────────────────────────────
  return (
    <section className="fx-hero" style={{ height: CANVAS_H * scale }}>
      {/* 1 — backgrounds */}
      <div className="fx-bg-stack">
        {slides.map((s, i) => (
          <div
            key={s.$id}
            className="fx-bg"
            style={{ backgroundImage: `url(${slideBg(s)})`, opacity: i === active ? 1 : 0 }}
          />
        ))}
      </div>

      {/* 2 — tint overlay */}
      <div className="fx-overlay" />

      <div className="fx-canvas" style={{ width: CANVAS_W, height: CANVAS_H, left: canvasLeft, transform: `scale(${scale})` }}>
        {/* 3 — ghost next-destination name */}
        <div className="fx-ghost" key={`g-${ghostIdx}`}>
          {titleCase(slides[ghostIdx].name)}
        </div>

        {/* 5 — header */}
        <header className="fx-nav">
          <a className="fx-logo" href="/">
            <img src="/logo.png" alt="Follow Me Travel" />
          </a>
          <nav className="fx-links">
            <a href="/#">Home</a>
            <a href="/#about">About Us</a>
            <a href="/#destination">Destination</a>
            <a href="/#testimonial">Testimonial</a>
            <a href="/#blog">Blog</a>
          </nav>
          <button className="fx-search" aria-label="Rechercher" onClick={() => navigate("/search")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </button>
          <div className="fx-auth"><HeroAuth /></div>
        </header>

        {/* 6 — progress rail */}
        <div className="fx-rail" style={{ height: RAIL_TOP + RAIL_STEP * (N - 1) + 90 - 150 }}>
          {slides.map((s, i) => (
            <span key={s.$id} className="fx-rail-dot" style={{ top: RAIL_TOP - 150 + i * RAIL_STEP }} />
          ))}
          <span className="fx-rail-active" style={{ top: RAIL_TOP - 150 + active * RAIL_STEP - 16 }}>
            <span key={active} className="fx-rail-num">{active + 1}</span>
          </span>
        </div>

        {/* 7 — title / paragraph / CTA */}
        <div className="fx-content">
          <div className="fx-title-mask">
            <div
              className="fx-title-track"
              style={
                anim
                  ? { transform: "translateY(-118px)", transition: `transform 520ms ${EASE}` }
                  : { transform: "translateY(0)", transition: "none" }
              }
            >
              <h1 className="fx-title">{(cur.name || "").toUpperCase()}</h1>
              {anim && <h1 className="fx-title">{(nxt.name || "").toUpperCase()}</h1>}
            </div>
          </div>
          <div className="fx-para-stack">
            <p className={`fx-para ${anim ? "out" : ""}`}>{cur.description}</p>
            {anim && <p className="fx-para in">{nxt.description}</p>}
          </div>
          <button className="fx-explore" onClick={() => navigate("/search")}>
            Explore <span className="fx-explore-arrow">→</span>
          </button>
        </div>

        {/* 8 — destination cards */}
        <div className="fx-cards">
          {queue.map((qi, slot) => (
            <CardSprite
              key={slides[qi].$id}
              slide={slides[qi]}
              rect={slotRect(slot)}
              entering={anim ? qi === anim.from : false}
              hidden={false}
              onClick={() => manual(qi)}
            />
          ))}
        </div>

        {/* 9 — prev / next */}
        <div className="fx-arrows">
          <button aria-label="Précédent" onClick={() => manual(idx - 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button aria-label="Suivant" onClick={() => manual(idx + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* 10 — counters */}
        <div className="fx-counter" key={`c-${active}`}>{pad(active + 1)}/{pad(N)}</div>
        <div className="fx-pagination">
          <span>01</span>
          <span className="fx-pagination-line" />
          <span>{pad(N)}</span>
        </div>
      </div>
    </section>
  );
}
