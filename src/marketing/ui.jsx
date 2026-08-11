import { useEffect, useRef, useState } from "react";
import { useLocale, LOCALES } from "./i18n";

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

/* ─── Language switcher ───────────────────────────────────────────────────── */
export function LangSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="mk-lang" role="group" aria-label={t("lang_label")}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          className={locale === l.code ? "is-active" : ""}
          onClick={() => setLocale(l.code)}
          aria-pressed={locale === l.code}
          lang={l.code}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

/* ─── Count-up number (for stats) ─────────────────────────────────────────── */
export function CountUp({ to, decimals = 0, duration = 1600 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / duration);
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
