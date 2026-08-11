import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { Arrow } from "./ui";
import { slideBg, slideCard } from "../services/heroSlides";

const HERO_MS = 6500;

/**
 * Quiet Atlas hero — full-bleed imagery, serif destination name revealed
 * line-by-line under a mask, thin progress lines, swipe on touch.
 */
export default function Hero({ slides }) {
  const { t, isRTL } = useLocale();
  const [active, setActive] = useState(0);
  const [textIn, setTextIn] = useState(true);
  const navigate = useNavigate();
  const timer = useRef(null);
  const N = slides.length;

  const goTo = useCallback(
    (i) => {
      if (N < 2) return;
      const next = ((i % N) + N) % N;
      if (next === active) return;
      setTextIn(false);
      setTimeout(() => {
        setActive(next);
        setTextIn(true);
      }, 260);
    },
    [active, N]
  );

  // Autoplay (paused while tab is hidden)
  useEffect(() => {
    if (N < 2) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!document.hidden) goTo(active + 1);
      else {
        const onVis = () => {
          document.removeEventListener("visibilitychange", onVis);
          goTo(active + 1);
        };
        document.addEventListener("visibilitychange", onVis);
      }
    }, HERO_MS);
    return () => clearTimeout(timer.current);
  }, [active, goTo, N]);

  // Preload
  useEffect(() => {
    slides.forEach((s) => {
      [slideBg(s), slideCard(s)].forEach((src) => {
        if (src) { const im = new Image(); im.src = src; }
      });
    });
  }, [slides]);

  // Touch / pointer swipe
  const drag = useRef(null);
  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      const dir = dx < 0 ? 1 : -1;
      goTo(active + (isRTL ? -dir : dir));
    }
  };

  if (N === 0) return null;
  const s = slides[active];
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <section
      className="mk-hero"
      id="top"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ "--hero-ms": `${HERO_MS}ms`, touchAction: "pan-y" }}
    >
      <div className="mk-hero-bg" aria-hidden="true">
        {slides.map((sl, i) => (
          <div
            key={sl.$id}
            className={`mk-hero-img ${i === active ? "is-active" : ""}`}
            style={{ backgroundImage: `url(${slideBg(sl)})` }}
          />
        ))}
        <div className="mk-hero-shade" />
      </div>

      <div className="mk-wrap mk-hero-in">
        <span className="mk-eyebrow">{t("hero_eyebrow")}</span>

        <h1 className="mk-hero-title" key={`t-${active}`}>
          <span className="mk-line is-in">
            <span style={{ "--ln-delay": "60ms" }}>{s.name}</span>
          </span>
        </h1>

        <p
          className="mk-hero-desc"
          key={`d-${active}`}
          style={{
            opacity: textIn ? 1 : 0,
            transform: textIn ? "none" : "translateY(8px)",
            transition: "opacity 600ms ease 250ms, transform 700ms var(--ease) 250ms",
          }}
        >
          {s.description}
        </p>

        <div style={{ opacity: textIn ? 1 : 0, transition: "opacity 500ms ease 350ms" }}>
          <a
            className="mk-alink"
            href="/search"
            onClick={(e) => { e.preventDefault(); navigate("/search"); }}
          >
            {t("hero_explore")} — {s.name}
            <Arrow />
          </a>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mk-hero-bar">
        <div className="mk-wrap">
          <div className="mk-hero-bar-in">
            {N > 1 && (
              <div className="mk-hero-prog" role="tablist" aria-label="slides">
                {slides.map((sl, i) => (
                  <button
                    key={sl.$id}
                    role="tab"
                    aria-selected={i === active}
                    aria-label={sl.name}
                    className={i === active ? "is-active" : i < active ? "is-done" : ""}
                    onClick={() => goTo(i)}
                  >
                    <i key={i === active ? `p-${active}` : undefined} />
                  </button>
                ))}
              </div>
            )}
            <span className="mk-hero-count">
              {pad(active + 1)} / {pad(N)}
            </span>
            {N > 1 && (
              <div className="mk-hero-arrows">
                <button onClick={() => goTo(active - 1)} aria-label={t("hero_prev")}>
                  <span style={{ transform: "scaleX(-1)", display: "flex" }}><Arrow /></span>
                </button>
                <button onClick={() => goTo(active + 1)} aria-label={t("hero_next")}>
                  <Arrow />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
