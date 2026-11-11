import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { useClickOutside } from "../components/ClickOutSide";
import { upcomingDepartures } from "./dates";
import RangeCalendar from "./RangeCalendar";
import { packageHref } from "./seo";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Check price" — departure calendar dropdown on listing cards. */
export default function QuickPrice({ pkgId, title, price, departureDates, compact = false }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const deps = upcomingDepartures(departureDates);

  const go = () => {
    navigate(packageHref(pkgId, title, { date: sel?.from ? iso(sel.from) : "" }));
  };

  return (
    <div className="mk-qp" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        className={`mk-btn mk-btn--sm ${compact ? "mk-btn--ghost" : ""} mk-qp-btn`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {t("qp_check")}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .25s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="mk-qp-pop">
          <div className="mk-qp-price">
            <span>{t("qp_departures")}</span>
            <b>{t("trips_from")} {nf.format(price || 0)} DH <i>{t("qp_pp")}</i></b>
          </div>
          {deps.length ? (
            <RangeCalendar
              mode="departures"
              departures={deps}
              value={sel}
              onChange={setSel}
              onSelect={go}
              onClear={() => setSel(null)}
              footerNote={t("bk_no_dates")}
            />
          ) : (
            <p className="mk-bk-muted" style={{ padding: "0 4px 6px" }}>{t("bk_no_dates")}</p>
          )}
        </div>
      )}
    </div>
  );
}
