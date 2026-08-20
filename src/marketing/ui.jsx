import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useLocale, LOCALES } from "./i18n";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";

/* ─── Reveal: adds .is-in when scrolled into view ──────────────────────────── */
export function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If the element is already inside the viewport (initial paint, instant
    // jumps), reveal synchronously instead of waiting an observer frame.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`mk-rv ${className}`} style={{ "--rv-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

/* ─── Lines: masked line-by-line reveal for multi-line titles ─────────────── */
export function Lines({ text, stagger = 90, base = 0 }) {
  return text.split("\n").map((line, i) => (
    <span className="mk-line" key={i}>
      <span style={{ "--ln-delay": `${base + i * stagger}ms` }}>{line}</span>
    </span>
  ));
}

/* ─── Section head: eyebrow + title (+ optional intro & aside link) ───────── */
export function SectionHead({ eyebrow, title, intro, aside }) {
  return (
    <div className="mk-sechead">
      <div>
        <Reveal as="span" className="mk-eyebrow">{eyebrow}</Reveal>
        <Reveal as="h2" delay={80} className="mk-h2">{title}</Reveal>
        {intro && <Reveal as="p" delay={160} className="mk-lead">{intro}</Reveal>}
      </div>
      {aside && <Reveal delay={220}>{aside}</Reveal>}
    </div>
  );
}

/* ─── Arrow glyph ─────────────────────────────────────────────────────────── */
export function Arrow({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8h13M9.5 3l5 5-5 5" />
    </svg>
  );
}

export function ArrowLink({ children, onClick, href, className = "" }) {
  const Tag = href ? "a" : "button";
  return (
    <Tag className={`mk-alink ${className}`} onClick={onClick} href={href}>
      {children}
      <Arrow />
    </Tag>
  );
}

export function Button({ children, onClick, href, variant = "", className = "" }) {
  const Tag = href ? "a" : "button";
  return (
    <Tag className={`mk-btn ${variant ? `mk-btn--${variant}` : ""} ${className}`} onClick={onClick} href={href}>
      {children}
      <span className="mk-btn-arrow"><Arrow size={14} /></span>
    </Tag>
  );
}

/* ─── Favorite toggle (heart) ───────────────────────────────────────────────
   Logged-out click: remembers the current page (AuthCallback reads
   "afterLogin" from sessionStorage) and sends the visitor to Google login
   instead of silently doing nothing. ─────────────────────────────────────── */
export function FavoriteButton({ id, label, className = "" }) {
  const { t } = useLocale();
  const { user, loginWithGoogle } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(id);

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      sessionStorage.setItem("afterLogin", window.location.pathname + window.location.search);
      toast.info(t("fav_login"));
      loginWithGoogle();
      return;
    }
    toggleFavorite({ id, label }).catch(() => toast.error(t("fav_err")));
  };

  return (
    <button
      type="button"
      className={`mk-fav-btn ${active ? "is-active" : ""} ${className}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? t("fav_remove") : t("fav_add")}
      title={active ? t("fav_remove") : t("fav_add")}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-10-9.3C.4 8 1.8 4.5 5 3.4c2.2-.8 4.5.1 6 2 .1.1.3.3.5.6.6.7 1 1.2 1 1.2s.4-.5 1-1.2c.2-.3.4-.5.5-.6 1.5-1.9 3.8-2.8 6-2 3.2 1.1 4.6 4.6 3 7.8-2.5 4.7-10 9.3-10 9.3z" />
      </svg>
    </button>
  );
}

/* ─── Language switcher ───────────────────────────────────────────────────── */
export function LangSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="mk-lang" role="group" aria-label={t("lang_label")}>
      {LOCALES.map((l, i) => (
        <span key={l.code} className="mk-lang-item">
          {i > 0 && <i aria-hidden="true">/</i>}
          <button
            className={locale === l.code ? "is-active" : ""}
            onClick={() => setLocale(l.code)}
            aria-pressed={locale === l.code}
            lang={l.code}
          >
            {l.short}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ─── Count-up number (for stats) ─────────────────────────────────────────── */
const FLAT_CAPTURE = new URLSearchParams(window.location.search).has("flat");

export function CountUp({ to, decimals = 0, duration = 1600 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(FLAT_CAPTURE ? to : 0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (FLAT_CAPTURE) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, Math.max(0, (now - t0) / duration));
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(to * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{val.toFixed(decimals)}</span>;
}
