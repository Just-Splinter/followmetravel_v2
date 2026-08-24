import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "./i18n";
import { LangSwitcher } from "./ui";

export default function Header({ light = false }) {
  const { t } = useLocale();
  const { user, loading, logout } = useAuth();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const links = [
    { k: "nav_destinations", href: "/#destinations" },
    { k: "nav_trips", href: "/#trips" },
    { k: "nav_omra", href: "/omra", gold: true },
    { k: "nav_about", href: "/#house" },
    { k: "nav_journal", href: "/#testimonials" },
    { k: "nav_contact", href: "/contact" },
  ];

  const authLabel = loading ? "…" : user ? (user.name || user.email).split(/[ @]/)[0] : t("nav_signin");
  const onAuth = () => {
    if (loading) return;
    if (!user) navigate("/login");
    else navigate("/profil#reservations");
  };

  const go = (href) => {
    setOpen(false);
    if (href.startsWith("/#")) {
      if (window.location.pathname !== "/") { navigate(href.slice(1) ? "/" + href.slice(1) : "/"); return; }
      // wait for the menu's body scroll-lock to release before scrolling
      setTimeout(() => {
        document.querySelector(`#${href.split("#")[1]}`)?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    } else {
      navigate(href);
    }
  };

  return (
    <>
      <header className={`mk-header ${solid ? "is-solid" : ""} ${light ? "is-light" : ""} ${open ? "is-menu" : ""}`}>
        <div className="mk-wrap">
          <div className="mk-header-in">
            <a className="mk-logo" href="/" onClick={(e) => { e.preventDefault(); go("/#top"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <img className="mk-logo-img" src="/logo-256.png" alt="Follow Me Travel" />
            </a>

            <nav className="mk-nav" aria-label="principal">
              {links.map((l) => (
                <a
                  key={l.k}
                  href={l.href}
                  className={l.gold ? "mk-nav-gold" : ""}
                  onClick={(e) => { e.preventDefault(); go(l.href); }}
                >
                  {t(l.k)}
                </a>
              ))}
            </nav>

            <div className="mk-hactions">
              <span className="mk-hide-mobile"><LangSwitcher /></span>
              <button className="mk-nav-auth mk-hide-mobile" onClick={onAuth} style={{ fontSize: 13.5, fontWeight: 500 }}>
                {authLabel}
              </button>
              {user && user.labels?.includes("admin") && (
                <button className="mk-btn mk-hide-mobile"  onClick={()=> navigate('/dashboard/home')} style={{ fontSize: 13.5, fontWeight: 500 }}>
                  Administration
                </button>
              )}

              <button
                className={`mk-burger ${open ? "is-open" : ""}`}
                onClick={() => setOpen((o) => !o)}
                aria-label="Menu"
                aria-expanded={open}
              >
                <span /><span /><span />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      <div className={`mk mk-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {links.map((l, i) => (
            <a
              key={l.k}
              className="mk-menu-link"
              href={l.href}
              style={{ transitionDelay: open ? `${120 + i * 70}ms` : "0ms" }}
              onClick={(e) => { e.preventDefault(); go(l.href); }}
            >
              <i>0{i + 1}</i> {t(l.k)}
            </a>
          ))}
        </nav>
        <div className="mk-menu-foot">
          <button onClick={() => { setOpen(false); onAuth(); }} style={{ fontSize: 15, fontWeight: 500 }}>
            {user ? `${authLabel} — ${t("nav_bookings")}` : t("nav_signin")}
          </button>
          <LangSwitcher />
        </div>
        {user && (
          <button
            onClick={() => { setOpen(false); logout().then(() => window.location.reload()); }}
            style={{ marginTop: 14, fontSize: 13, color: "var(--ink-2)", textAlign: "start" }}
          >
            {t("nav_signout")}
          </button>
        )}
      </div>
    </>
  );
}
