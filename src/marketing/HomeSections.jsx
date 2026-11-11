// Sections de la page d'accueil centrées sur les voyages : prochains départs,
// sélection de packages, déroulé de la réservation, chiffres de l'agence,
// bandeau destinations et demande de voyage sur mesure.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "./i18n";
import { Reveal, Lines, SectionHead, ArrowLink, Arrow, CountUp, FavoriteButton } from "./ui";
import QuickPrice from "./QuickPrice";
import { FEW_SEATS, dayLabel } from "./homeData";
import { packageHref, packagePath } from "./seo";
import { agencyStats, whatsappLink } from "../services/agency";
import { submitLead } from "../services/operations";
import { useEvents } from "../context/EventsContext";
import { useAuth } from "../context/AuthContext";

const useMoney = () => {
  const { locale } = useLocale();
  return useMemo(() => new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA"), [locale]);
};

/** Pastille d'état d'un départ : complet, dernières places, garanti, ouvert. */
function SeatChip({ closed, remaining, guaranteed, quiet = false }) {
  const { t } = useLocale();
  if (closed) return <span className="mk-chip mk-chip--off">{t("dep_full")}</span>;
  if (remaining !== null && remaining !== undefined && remaining <= FEW_SEATS) {
    return <span className="mk-chip mk-chip--hot">{remaining} {t("dep_seats_left")}</span>;
  }
  if (guaranteed) return <span className="mk-chip mk-chip--ok">{t("dep_guaranteed")}</span>;
  return quiet ? null : <span className="mk-chip">{t("dep_open")}</span>;
}

/* ─── Prochains départs ──────────────────────────────────────────────────── */
export function UpcomingDepartures({ departures }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const nf = useMoney();
  const { trackClick } = useEvents();
  const rows = (departures || []).slice(0, 8);
  if (!rows.length) return null;

  const open = (d) => {
    trackClick({ category: "home", action: "departure", label: d.title, targetId: d.packageId });
    navigate(packageHref(d.packageId, d.title, { date: d.start }));
  };

  return (
    <section className="mk-section" id="departures">
      <div className="mk-wrap">
        <SectionHead
          eyebrow={t("dep_eyebrow")}
          title={<Lines text={t("dep_title")} />}
          intro={t("dep_intro")}
          aside={<ArrowLink onClick={() => navigate("/search")}>{t("dep_all")}</ArrowLink>}
        />
        {/* Rail horizontal de cartes (défilement + aimantation) */}
        <ol className="mk-rail mk-depcards">
          {rows.map((d, i) => (
            <Reveal as="li" key={`${d.packageId}-${d.start}`} delay={i * 50}>
              <a
                className={`mk-depc ${d.closed ? "is-closed" : ""}`}
                href={packageHref(d.packageId, d.title, { date: d.start })}
                onClick={(e) => { e.preventDefault(); open(d); }}
              >
                <span className="mk-depc-fig">
                  {d.image ? <img src={d.image} alt="" loading="lazy" /> : <span className="mk-depc-fallback" aria-hidden="true">{(d.title || "—").charAt(0)}</span>}
                  <span className="mk-dep-date">
                    <b>{dayLabel(d.start, locale, { day: "numeric" })}</b>
                    <span>{dayLabel(d.start, locale, { month: "short" })}</span>
                  </span>
                  <span className="mk-depc-seat">
                    <SeatChip closed={d.closed} remaining={d.remaining} guaranteed={d.guaranteed} />
                  </span>
                </span>
                <span className="mk-depc-body">
                  <strong>{d.title}</strong>
                  <span className="mk-depc-meta">{[d.country, d.durationLabel, `${dayLabel(d.start, locale)} → ${dayLabel(d.end, locale)}`].filter(Boolean).join(" · ")}</span>
                  <span className="mk-depc-foot">
                    <span className="mk-dep-price">
                      {d.price > 0 && <><span className="mk-dep-from">{t("trips_from")}</span><b>{nf.format(d.price)}</b> DH</>}
                    </span>
                    <span className="mk-roundgo" aria-hidden="true"><Arrow size={14} /></span>
                  </span>
                </span>
              </a>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── Sélection de voyages (filtres par continent) ───────────────────────── */
export function TripsShowcase({ cards, max = 9 }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const nf = useMoney();
  const { trackClick } = useEvents();
  const [tab, setTab] = useState("");

  // Onglets : les continents les plus représentés (au moins 2 pour filtrer).
  const tabs = useMemo(() => {
    const count = new Map();
    for (const c of cards) if (c.continent) count.set(c.continent, (count.get(c.continent) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  }, [cards]);

  if (!cards.length) return null;
  const shown = (tab ? cards.filter((c) => c.continent === tab) : cards).slice(0, max);

  const open = (p) => {
    trackClick({ category: "home", action: "trip", label: p.title, targetId: p.id });
    navigate(packagePath(p.id, p.title));
  };

  return (
    <section className="mk-section" id="trips">
      <div className="mk-wrap">
        <SectionHead
          eyebrow={t("trips_eyebrow")}
          title={<Lines text={t("trips_title")} />}
          intro={t("trips_intro")}
          aside={<ArrowLink onClick={() => navigate("/search")}>{t("trips_all")}</ArrowLink>}
        />
        {tabs.length > 1 && (
          <div className="mk-tabs" role="tablist">
            {["", ...tabs].map((k) => (
              <button key={k || "all"} role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>
                {k || t("trips_tab_all")}
              </button>
            ))}
          </div>
        )}
        <div className="mk-trips-grid">
          {shown.map((p, i) => (
            <Reveal as="article" key={p.id} delay={(i % 3) * 80} className="mk-trip" onClick={() => open(p)} style={{ cursor: "pointer" }}>
              <figure>
                {p.img ? (
                  <img src={p.img} alt={p.title} loading="lazy" />
                ) : (
                  <span className="mk-trip-fallback" aria-hidden="true">{(p.title || "—").charAt(0)}</span>
                )}
                <span className="mk-trip-shade" aria-hidden="true" />
                {p.featured && <span className="mk-trip-flag">{t("trips_featured")}</span>}
                <FavoriteButton id={p.id} label={p.title} />
                <h3>
                  <a href={packagePath(p.id, p.title)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(p); }}>{p.title}</a>
                </h3>
              </figure>
              <div className="mk-trip-meta">
                <span>{p.country || "—"}</span>
                <span>{p.duration}</span>
              </div>
              {p.next && (
                <p className="mk-trip-next">
                  {t("trips_next")} : <b>{dayLabel(p.next, locale, { day: "numeric", month: "long" })}</b>
                  <SeatChip remaining={p.remaining} guaranteed={p.guaranteed} quiet />
                </p>
              )}
              <div className="mk-trip-foot">
                <span className="mk-trip-price">
                  {t("trips_from")}<b>{nf.format(p.price || 0)}</b>DH
                </span>
                <QuickPrice pkgId={p.id} title={p.title} price={p.price} departureDates={p.departureDates} compact />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Comment ça marche ──────────────────────────────────────────────────── */
export function HowItWorks({ agency }) {
  const { t } = useLocale();
  const fill = (s) =>
    s.replace("{deposit}", String(Number(agency.depositPercent) || 30)).replace("{balance}", String(Number(agency.balanceDaysBeforeDeparture) || 30));
  const steps = [
    [t("how_1t"), t("how_1d")],
    [t("how_2t"), fill(t("how_2d"))],
    [t("how_3t"), fill(t("how_3d"))],
  ];
  return (
    <section className="mk-section mk-how" id="how">
      <div className="mk-wrap">
        <SectionHead eyebrow={t("how_eyebrow")} title={<Lines text={t("how_title")} />} />
        <ol className="mk-how-steps">
          {steps.map(([h, p], i) => (
            <Reveal as="li" key={h} delay={i * 90} className="mk-how-step">
              <i>{String(i + 1).padStart(2, "0")}</i>
              <h3>{h}</h3>
              <p>{p}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── Chiffres de l'agence (Paramètres → Agence ; vides = masqués) ───────── */
export function AgencyStats({ agency }) {
  const { t } = useLocale();
  const s = agencyStats(agency);
  const big = (v) => (v >= 1000 ? { to: Math.floor(v / 1000), suf: "k+" } : { to: v, suf: "" });
  const rows = [
    s.years && { to: s.years, suf: "", label: t("stats_years") },
    s.travelers && { ...big(s.travelers), label: t("stats_travelers") },
    s.destinations && { to: s.destinations, suf: "", label: t("stats_destinations") },
    s.rating && {
      to: s.rating,
      dec: 1,
      suf: "/5",
      label: `${t("stats_rating")}${s.reviews ? ` · ${s.reviews} ${t("stats_reviews")}` : ""}`,
      href: s.reviewsUrl,
    },
  ].filter(Boolean);
  if (!rows.length) return null;

  return (
    <section className="mk-section" style={{ paddingBlock: 0 }}>
      <div className="mk-wrap">
        <div className={`mk-stats mk-stats--${rows.length}`}>
          {rows.map((r) => {
            const body = (
              <>
                <b>
                  <CountUp to={r.to} decimals={r.dec || 0} />
                  {r.suf && <sup>{r.suf}</sup>}
                </b>
                <span>{r.label}</span>
              </>
            );
            return (
              <Reveal key={r.label} className="mk-stat">
                {r.href ? <a href={r.href} target="_blank" rel="noreferrer">{body}</a> : body}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Bandeau destinations ───────────────────────────────────────────────── */
export function DestinationsBand({ destinations, cards }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const chips = useMemo(() => {
    // Photo de la tuile : l'image de la destination (CMS), sinon celle d'un voyage du même pays.
    const photo = (name) => cards.find((c) => c.img && c.country && c.country.toLowerCase() === String(name).toLowerCase())?.img || "";
    const isUrl = (v) => typeof v === "string" && /^(https?:|\/)/.test(v);
    const published = (destinations || []).filter((d) => d.status !== "draft" && d.name);
    if (published.length) {
      return published.map((d) => ({
        key: d.$id,
        name: d.name,
        img: isUrl(d.emoji) ? d.emoji : photo(d.name),
        count: d.listing || "",
        to: `/search?dest=${encodeURIComponent(d.$id)}`,
      }));
    }
    const countries = [...new Set(cards.map((c) => c.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return countries.map((c) => ({ key: c, name: c, img: photo(c), count: "", to: `/search?country=${encodeURIComponent(c)}` }));
  }, [destinations, cards]);
  if (!chips.length) return null;

  return (
    <section className="mk-section mk-destband" id="destinations">
      <div className="mk-wrap">
        <Reveal as="span" className="mk-eyebrow">{t("dest_band")}</Reveal>
        <Reveal className="mk-destband-tiles" delay={80}>
          {chips.map((c) => (
            <a key={c.key} href={c.to} className="mk-desttile" onClick={(e) => { e.preventDefault(); navigate(c.to); }}>
              {c.img ? <img src={c.img} alt="" loading="lazy" /> : <span className="mk-desttile-fallback" aria-hidden="true">{c.name.charAt(0)}</span>}
              <span className="mk-desttile-txt">
                <b>{c.name}</b>
                {c.count && <span>{c.count}</span>}
              </span>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Voyage sur mesure / groupes ────────────────────────────────────────── */
const EMPTY = { name: "", email: "", phone: "", destination: "", period: "", travelers: "2", budget: "", message: "" };
// name/email absents = pas encore saisis : on affiche ceux du compte connecté.
const START = { ...EMPTY, name: undefined, email: undefined };

export function CustomTrip({ agency }) {
  const { t } = useLocale();
  const { trackLead } = useEvents();
  const { user } = useAuth();
  const [form, setForm] = useState(START);
  const val = (k) => form[k] ?? (k === "name" ? user?.name : k === "email" ? user?.email : "") ?? "";
  const [status, setStatus] = useState("idle"); // idle | sending | ok | error | invalid
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (status === "invalid" || status === "error") setStatus("idle");
  };
  const wa = whatsappLink(agency, "Bonjour, je souhaite un devis pour un voyage sur mesure.");

  const submit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String(val(k)).trim()]));
    if (!data.name || !/^\S+@\S+\.\S+$/.test(data.email)) {
      setStatus("invalid");
      return;
    }
    setStatus("sending");
    try {
      await submitLead({ source: "quote", ...data });
      trackLead({ action: "quote", label: data.destination || "sur mesure" });
      setStatus("ok");
      setForm(EMPTY);
    } catch {
      setStatus("error");
    }
  };

  const field = (k, label, props = {}) => (
    <label className="mk-ct-field">
      <span>{label}</span>
      <input value={val(k)} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <section className="mk-section mk-ct" id="custom-trip">
      <div className="mk-wrap">
      <div className="mk-ct-grid">
        <div>
          <Reveal as="span" className="mk-eyebrow">{t("ct_eyebrow")}</Reveal>
          <Reveal as="h2" delay={80} className="mk-h2" style={{ margin: "20px 0 24px" }}>
            <Lines text={t("ct_title")} />
          </Reveal>
          <Reveal as="p" delay={160} className="mk-lead">{t("ct_intro")}</Reveal>
          <Reveal as="ul" delay={220} className="mk-ct-points">
            <li>{t("ct_point_1")}</li>
            <li>{t("ct_point_2")}</li>
            <li>{t("ct_point_3")}</li>
          </Reveal>
          {wa && (
            <Reveal delay={260}>
              <a className="mk-alink" href={wa} target="_blank" rel="noreferrer">WhatsApp <Arrow /></a>
            </Reveal>
          )}
        </div>
        <Reveal as="form" delay={120} className="mk-ct-form" onSubmit={submit} noValidate>
          {status === "ok" ? (
            <p className="mk-ct-ok" role="status">{t("ct_ok")}</p>
          ) : (
            <>
              <div className="mk-ct-row">
                {field("name", t("ct_name"), { autoComplete: "name", required: true })}
                {field("email", t("ct_email"), { type: "email", autoComplete: "email", required: true })}
              </div>
              <div className="mk-ct-row">
                {field("phone", t("ct_phone"), { type: "tel", autoComplete: "tel" })}
                {field("destination", t("ct_dest"))}
              </div>
              <div className="mk-ct-row mk-ct-row--3">
                {field("period", t("ct_period"), { placeholder: t("ct_period_ph") })}
                {field("travelers", t("ct_travelers"), { type: "number", min: 1, max: 500 })}
                {field("budget", t("ct_budget"), { placeholder: "DH" })}
              </div>
              <label className="mk-ct-field">
                <span>{t("ct_message")}</span>
                <textarea rows={4} value={form.message} onChange={set("message")} />
              </label>
              {(status === "invalid" || status === "error") && (
                <p className="mk-ct-err" role="alert">{t(status === "invalid" ? "ct_invalid" : "ct_err")}</p>
              )}
              <button className="mk-btn" type="submit" disabled={status === "sending"}>
                {status === "sending" ? t("ct_sending") : t("ct_send")}
                <span className="mk-btn-arrow"><Arrow size={14} /></span>
              </button>
            </>
          )}
        </Reveal>
      </div>
      </div>
    </section>
  );
}
