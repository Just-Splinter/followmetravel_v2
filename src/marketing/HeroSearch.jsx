import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { useClickOutside } from "../components/ClickOutSide";
import { useEvents } from "../context/EventsContext";
import RangeCalendar from "./RangeCalendar";

const S = 1.5;
const I = {
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>,
  calin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8.5 15h7M13 12.5 15.5 15 13 17.5" /></svg>,
  calout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M15.5 15h-7M11 12.5 8.5 15 11 17.5" /></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c1.2-2.9 3.4-4.3 6-4.3s4.8 1.4 6 4.3" /><circle cx="17" cy="9" r="2.4" /><path d="M17.6 14.6c1.9.4 3.1 1.6 3.9 3.4" /></svg>,
  chev: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  stay: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6.5A2.5 2.5 0 0 1 5.5 9H13c2.8 0 5 2.2 5 5v4" /><path d="M3 21v-3h15v3M21 21v-8.5c0-2-1-3.5-3-4.5" /><circle cx="7.5" cy="6" r="2" /></svg>,
  plane: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 13.5L3 11l1.5-1.5 6 .5 5-5.5c.6-.6 1.6-.6 2.2 0 .6.6.6 1.6 0 2.2l-5.5 5 .5 6L11.2 19l-2.5-7.5" /></svg>,
  hotel: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round"><rect x="4" y="3.5" width="16" height="17" rx="1.5" /><path d="M4 20.5h16M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20.5v-4h3v4" /></svg>,
  bus: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={S} strokeLinecap="round"><rect x="4" y="4" width="16" height="13.5" rx="2.5" /><path d="M4 11h16M8 21l1-3.5M16 21l-1-3.5" /><circle cx="8.2" cy="14.5" r="0.8" fill="currentColor" /><circle cx="15.8" cy="14.5" r="0.8" fill="currentColor" /></svg>,
};

const fmtDay = (d, locale) =>
  d ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" }).format(d) : null;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Hero search — reference "Bundle & Save" panel in Quiet Atlas materials:
 * category icon row, grouped destination autocomplete, range-calendar dates,
 * rooms/guests expander, ink CTA.
 */
export default function HeroSearch({ destinations, heroSlides }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { trackSearch } = useEvents();

  const [tab, setTab] = useState("holiday");
  const [query, setQuery] = useState("");
  const [destId, setDestId] = useState(null);
  const [panel, setPanel] = useState(null); // 'dest' | 'dates' | 'guests'
  const [range, setRange] = useState(null);
  const [roomsList, setRoomsList] = useState([{ adults: 2, children: 0 }]);

  const boxRef = useRef(null);
  useClickOutside(boxRef, () => setPanel(null));

  const cats = [
    { k: "holiday", icon: I.stay, label: t("hs_tab_holiday") },
    { k: "flight", icon: I.plane, label: t("hs_tab_flight") },
    { k: "hotels", icon: I.hotel, label: t("hs_tab_hotels") },
    { k: "transfers", icon: I.bus, label: t("hs_tab_transfers") },
  ];

  /* grouped suggestions: CMS destinations / countries / moods-fallback */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || s?.toLowerCase().includes(q);
    const g = [];
    const dests = (destinations || []).filter((d) => match(d.name));
    if (dests.length) g.push({ title: t("sr_dests"), items: dests.map((d) => ({ id: d.$id, name: d.name })) });
    const slideNames = (heroSlides || []).filter((s) => match(s.name)).map((s) => ({ id: null, name: s.name }));
    if (!dests.length && slideNames.length) g.push({ title: t("sr_dests"), items: slideNames });
    return g;
  }, [destinations, heroSlides, query, t]);

  const totalPax = roomsList.reduce((a, r) => a + r.adults + r.children, 0);
  const totalAdults = roomsList.reduce((a, r) => a + r.adults, 0);
  const totalChildren = roomsList.reduce((a, r) => a + r.children, 0);

  const setRoom = (i, key, delta) =>
    setRoomsList((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, [key]: Math.max(key === "adults" ? 1 : 0, r[key] + delta) } : r
      )
    );

  const explore = () => {
    if (tab !== "holiday") { navigate("/contact"); return; }
    trackSearch({ label: query.trim() || "(any destination)", action: destId ? "destination" : "text" });
    const params = new URLSearchParams();
    if (destId) params.set("dest", destId);
    if (range?.from) params.set("date", iso(range.from));
    if (range?.to) params.set("dateTo", iso(range.to));
    params.set("adults", String(totalAdults + totalChildren));
    if (totalChildren) params.set("children", String(totalChildren));
    navigate(`/search?${params.toString()}`);
  };

  const dateLabel = (d) => fmtDay(d, locale) ?? t("hs_add_dates");

  return (
    <div className="mk-hsearch" ref={boxRef}>
      <h2 className="mk-hsearch-title">{t("hs_title")}</h2>

      {/* category icon row */}
      <div className="mk-hsearch-cats" role="tablist">
        {cats.map((c) => (
          <button key={c.k} role="tab" aria-selected={tab === c.k}
            className={tab === c.k ? "is-active" : ""} onClick={() => setTab(c.k)}>
            <span className="mk-hsearch-cat-ico">{c.icon}</span>
            <span className="mk-hsearch-cat-label">{c.label}</span>
          </button>
        ))}
      </div>

      {/* destination */}
      <div className="mk-hsearch-boxfield" style={{ position: "relative" }}>
        <button className="mk-hsearch-fieldbtn" onClick={() => setPanel(panel === "dest" ? null : "dest")}>
          {I.search}
          <span className="mk-hsearch-fb-main">
            <em>{t("hs_dest")}</em>
            <b className={destId || query ? "" : "is-ph"}>{query || t("hs_dest_ph")}</b>
          </span>
          {I.chev}
        </button>
        {panel === "dest" && (
          <div className="mk-hsearch-pop">
            <input
              autoFocus
              className="mk-hsearch-popinput"
              value={query}
              placeholder={t("hs_dest_ph")}
              onChange={(e) => { setQuery(e.target.value); setDestId(null); }}
            />
            {groups.map((g) => (
              <div key={g.title} className="mk-hsearch-group">
                <em>{g.title}</em>
                {g.items.slice(0, 5).map((o) => (
                  <button key={o.id ?? o.name} className={destId === o.id && o.id ? "is-active" : ""}
                    onClick={() => { setQuery(o.name); setDestId(o.id); setPanel(null); }}>
                    {o.name}
                    <i>›</i>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* dates */}
      <div className="mk-hsearch-boxfield mk-hsearch-split" style={{ position: "relative" }}>
        <button className="mk-hsearch-fieldbtn" onClick={() => setPanel(panel === "dates" ? null : "dates")}>
          {I.calin}
          <span className="mk-hsearch-fb-main">
            <em>{t("hs_checkin")}</em>
            <b className={range?.from ? "" : "is-ph"}>{dateLabel(range?.from)}</b>
          </span>
          {I.chev}
        </button>
        <i className="mk-hsearch-vr" />
        <button className="mk-hsearch-fieldbtn" onClick={() => setPanel(panel === "dates" ? null : "dates")}>
          {I.calout}
          <span className="mk-hsearch-fb-main">
            <em>{t("hs_checkout")}</em>
            <b className={range?.to ? "" : "is-ph"}>{dateLabel(range?.to)}</b>
          </span>
          {I.chev}
        </button>
        {panel === "dates" && (
          <div className="mk-hsearch-pop mk-hsearch-pop--cal">
            <RangeCalendar mode="free" value={range} onChange={setRange} onSelect={() => setPanel(null)} />
          </div>
        )}
      </div>

      {/* guests */}
      <div className="mk-hsearch-boxfield" style={{ position: "relative" }}>
        <button className="mk-hsearch-fieldbtn" onClick={() => setPanel(panel === "guests" ? null : "guests")}>
          {I.users}
          <span className="mk-hsearch-fb-main">
            <em>{t("hs_guests")} · {roomsList.length} {roomsList.length > 1 ? t("hs_rooms_pl") : t("hs_room").toLowerCase()}</em>
            <b>{totalPax} {t("bk_travelers")}</b>
          </span>
          {I.chev}
        </button>
        {panel === "guests" && (
          <div className="mk-hsearch-pop mk-hsearch-pop--guests">
            {roomsList.map((r, i) => (
              <div key={i} className="mk-hsearch-roomblock">
                <div className="mk-hsearch-roomhead">
                  <em>{t("hs_room")} {i + 1}</em>
                  {i === 0 ? (
                    <button className="mk-hsearch-addroom" onClick={() => setRoomsList((p) => [...p, { adults: 2, children: 0 }])}>
                      {t("hs_add_room")} +
                    </button>
                  ) : (
                    <button className="mk-hsearch-addroom" onClick={() => setRoomsList((p) => p.filter((_, x) => x !== i))}>✕</button>
                  )}
                </div>
                {[
                  { key: "adults", label: t("hs_adults"), hint: t("hs_adults_hint") },
                  { key: "children", label: t("hs_children"), hint: t("hs_children_hint") },
                ].map((row) => (
                  <div key={row.key} className="mk-hsearch-guestrow">
                    <div>
                      <b>{row.label}</b>
                      <span>{row.hint}</span>
                    </div>
                    <div className="mk-bk-stepper">
                      <button disabled={r[row.key] <= (row.key === "adults" ? 1 : 0)} onClick={() => setRoom(i, row.key, -1)}>−</button>
                      <b>{r[row.key]}</b>
                      <button onClick={() => setRoom(i, row.key, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <button className="mk-btn mk-btn--sm" style={{ width: "100%" }} onClick={() => setPanel(null)}>
              {t("hs_select")}
            </button>
          </div>
        )}
      </div>

      {tab !== "holiday" && <p className="mk-hsearch-soon">{t("hs_soon")}</p>}

      <button className="mk-btn mk-hsearch-cta" onClick={explore}>
        {tab === "holiday" ? t("hs_explore") : t("hs_contact")}
      </button>
    </div>
  );
}
