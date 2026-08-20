import { useMemo, useState } from "react";
import { useLocale } from "./i18n";
import { parseDDMM } from "./dates";

const DAY = 864e5;
const strip = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const same = (a, b) => a && b && a.getTime() === b.getTime();

/**
 * Brand range calendar (reference: Bundle-and-Save picker).
 * mode "free":       pick check-in then check-out (min today)
 * mode "departures": only departure start days are selectable; picking one
 *                    highlights its full from→to span.
 */
export default function RangeCalendar({ mode = "free", departures = [], value, onChange, onSelect, onClear, footerNote }) {
  const { t, locale, isRTL } = useLocale();
  const today = strip(new Date());
  const initial = value?.from || departures[0]?.when || today;
  const [view, setView] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  const monthName = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR", { month: "long", year: "numeric" }).format(view);
  const weekdays = useMemo(() => {
    const base = new Date(2023, 0, 1); // a Sunday
    const f = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR", { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(base.getTime() + i * DAY)));
  }, [locale]);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first.getTime() - first.getDay() * DAY);
    return Array.from({ length: 42 }, (_, i) => strip(new Date(start.getTime() + i * DAY)));
  }, [view]);

  const depByTime = useMemo(() => {
    const m = new Map();
    departures.forEach((d) => m.set(strip(d.when).getTime(), d));
    return m;
  }, [departures]);

  const from = value?.from ? strip(value.from) : null;
  const to = value?.to ? strip(value.to) : null;
  const nights = from && to ? Math.round((to - from) / DAY) : 0;

  const pick = (d) => {
    if (mode === "departures") {
      const dep = depByTime.get(d.getTime());
      if (!dep) return;
      const parsedTo = parseDDMM(dep.to);
      let end = parsedTo ? new Date(dep.when.getFullYear(), parsedTo.month - 1, parsedTo.day) : null;
      if (end && end < dep.when) end = new Date(dep.when.getFullYear() + 1, parsedTo.month - 1, parsedTo.day);
      onChange({ from: dep.when, to: end, dep });
      return;
    }
    if (d < today) return;
    if (!from || (from && to)) onChange({ from: d, to: null });
    else if (d < from) onChange({ from: d, to: null });
    else onChange({ from, to: d });
  };

  const cls = (d) => {
    const out = [];
    if (d.getMonth() !== view.getMonth()) out.push("is-out");
    if (mode === "free" && d < today) out.push("is-past");
    if (mode === "departures") out.push(depByTime.has(d.getTime()) ? "is-avail" : "is-past");
    if (same(d, from) || same(d, to)) out.push("is-edge");
    else if (from && to && d > from && d < to) out.push("is-mid");
    if (same(d, today)) out.push("is-today");
    return out.join(" ");
  };

  return (
    <div className="mk-cal" dir="ltr" data-rtl={isRTL || undefined}>
      <div className="mk-cal-head" dir={isRTL ? "rtl" : "ltr"}>
        <button onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))} aria-label="‹">‹</button>
        <b>{monthName}</b>
        <button onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))} aria-label="›">›</button>
      </div>
      <div className="mk-cal-grid">
        {weekdays.map((w, i) => <span key={i} className="mk-cal-dow">{w}</span>)}
        {cells.map((d) => (
          <button key={d.getTime()} className={`mk-cal-day ${cls(d)}`} onClick={() => pick(d)}>
            {d.getDate()}
          </button>
        ))}
      </div>
      <div className="mk-cal-foot" dir={isRTL ? "rtl" : "ltr"}>
        <span className="mk-cal-chip">
          {nights > 0 ? `${nights} ${nights > 1 ? t("cal_nights") : t("cal_night")}` : footerNote || "—"}
        </span>
        <div className="mk-cal-actions">
          <button className="mk-cal-clear" onClick={() => { onChange(null); onClear?.(); }}>{t("hs_clear")}</button>
          <button className="mk-btn mk-btn--sm" disabled={!from} onClick={onSelect}>{t("hs_select")}</button>
        </div>
      </div>
    </div>
  );
}
