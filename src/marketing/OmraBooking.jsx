import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useAuth } from "../context/AuthContext";
import { useReservation } from "../context/ReservationContext";
import { useEvents } from "../context/EventsContext";
import { useLocale } from "./i18n";

/**
 * Omra reservation — occupancy-based per-person pricing (quad/triple/double),
 * optional child fare. The payload sent to the Appwrite Function is the exact
 * legacy reservation contract (same keys as BookingFlow): the occupancy
 * selection is expressed as one synthetic "hotel" whose rooms are the
 * occupancy lines, so admin/profile UIs render it unchanged.
 */
export default function OmraBooking({ pkg, onClose }) {
  const { t, locale } = useLocale();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const { createReservation } = useReservation();
  const { trackPayment, trackAbandon } = useEvents();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const fmt = (n) => `${nf.format(n)} DH`;

  const dates = useMemo(() => (pkg.dates || []).filter((d) => d.from), [pkg]);
  const pricing = useMemo(
    () => (pkg.pricing || []).filter((p) => Number(p.price) > 0),
    [pkg]
  );
  const childPrice = Number(pkg.childPrice) || 0;

  const [dateIdx, setDateIdx] = useState(dates.length === 1 ? 0 : null);
  const [qty, setQty] = useState({}); // {occKey: persons}
  const [children, setChildren] = useState(0);
  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState([{}]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  // Funnel-abandon: fires once on unmount unless the reservation went through.
  const doneRef = useRef(false);
  useEffect(() => { doneRef.current = !!done; }, [done]);
  useEffect(() => {
    return () => {
      if (!doneRef.current) {
        trackAbandon({ targetId: pkg.$id, label: pkg.title, page: "/omra" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = pricing
    .map((p) => ({ ...p, n: qty[p.key || p.label] || 0, subtotal: (qty[p.key || p.label] || 0) * Number(p.price) }))
    .filter((l) => l.n > 0);
  const adultPax = lines.reduce((a, l) => a + l.n, 0);
  const childTotal = children * childPrice;
  const totalPax = adultPax + children;
  const grandTotal = lines.reduce((a, l) => a + l.subtotal, 0) + childTotal;
  const canContinue = dateIdx !== null && adultPax > 0;

  /* pilgrim rows derived from the pax count — state only stores what was typed */
  const pilgrims = Array.from({ length: Math.max(totalPax, 1) }, (_, i) => participants[i] || {});

  const bump = (key, delta) =>
    setQty((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) }));

  const setP = (i, field, value) =>
    setParticipants((prev) => {
      const next = Array.from({ length: Math.max(totalPax, 1) }, (_, j) => prev[j] || {});
      next[i] = { ...next[i], [field]: value };
      return next;
    });

  const leadValid = !!(pilgrims[0]?.fullName?.trim() && pilgrims[0]?.phone?.trim());

  const submit = async () => {
    if (!leadValid || sending) return;
    setSending(true);
    setError(null);
    try {
      const d = dates[dateIdx];
      const roomLines = lines.map((l) => ({ type: l.label, qty: l.n }));
      if (children > 0) roomLines.push({ type: t("om_pk_child"), qty: children });
      const packageTitle = pkg.title || `Omra ${pkg.year || ""}`.trim();
      // See the matching comment in BookingFlow.jsx's submit(): totalEstimate
      // (grandTotal) below is client-computed and forwarded as-is to Appwrite
      // Function '6a312ae3000737bbe2ac' — server-side price validation, if
      // any, lives entirely in that function's own source, outside this repo.
      const result = await createReservation({
        packageId: pkg.$id,
        packageTitle,
        category: "Omra",
        hotels: JSON.stringify([
          {
            name: [
              pkg.makkahHotel?.name && `Makkah — ${pkg.makkahHotel.name}`,
              pkg.madinahHotel?.name && `Madinah — ${pkg.madinahHotel.name}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Omra",
            rooms: roomLines,
            subtotal: grandTotal,
            pax: totalPax,
          },
        ]),
        dateFrom: d.from,
        dateTo: d.to,
        totalPax,
        participants: JSON.stringify(
          notes.trim()
            ? pilgrims.map((p, i) => (i === 0 ? { ...p, notes: notes.trim() } : p))
            : pilgrims
        ),
        supplements: [],
        totalEstimate: grandTotal,
        recaptchaToken: executeRecaptcha ? await executeRecaptcha("reservation") : null,
      });
      if (!result?.success) {
        setError(result?.message || t("bk_err"));
        return;
      }
      setDone(result.reservation || {});
      trackPayment({
        targetId: pkg.$id,
        label: packageTitle,
        data: { totalEstimate: grandTotal, totalPax },
      });
    } catch (err) {
      setError(err?.message === "AUTH_REQUIRED" ? t("bk_auth_t") : err?.message || t("bk_err"));
    } finally {
      setSending(false);
    }
  };

  /* ── shells ── */
  const shell = (children) => (
    <div className="om-bk-ov" onClick={onClose}>
      <div className="om om-bk" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="om-bk-head">
          <h3>
            {pkg.title}
            <em lang="ar">{pkg.titleAr || "عُمْرَة"}</em>
          </h3>
          <button className="om-bk-x" onClick={onClose} aria-label={t("bk_close")}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  /* auth gate */
  if (!authLoading && !user) {
    return shell(
      <div className="om-bk-center">
        <span className="om-word" lang="ar">أَهْلًا بِكُم</span>
        <h3>{t("bk_auth_t")}</h3>
        <p>{t("bk_auth_d")}</p>
        <button className="mk-btn" onClick={loginWithGoogle}>{t("bk_auth_google")}</button>
      </div>
    );
  }

  /* success */
  if (done) {
    return shell(
      <div className="om-bk-center">
        <span className="om-word" lang="ar">تَقَبَّلَ الله</span>
        <h3>{t("om_bk_ok_t")}</h3>
        {done.ref && <div className="om-bk-ref">{done.ref}</div>}
        <p>{t("bk_ok_d")}</p>
        <button className="mk-btn mk-btn--sm" onClick={onClose}>{t("bk_close")}</button>
      </div>
    );
  }

  const recap = (
    <aside className="om-bk-recap">
      <span className="om-bk-cap">{t("bk_recap")}</span>
      <div className="om-bk-recap-rows">
        <div>
          <span>{t("bk_date")}</span>
          <b>{dateIdx !== null ? `${dates[dateIdx].from} → ${dates[dateIdx].to}` : "—"}</b>
        </div>
        {lines.map((l) => (
          <div key={l.key || l.label}>
            <span>{l.n} × {l.label}</span>
            <b>{fmt(l.subtotal)}</b>
          </div>
        ))}
        {children > 0 && (
          <div>
            <span>{children} × {t("om_pk_child")}</span>
            <b>{fmt(childTotal)}</b>
          </div>
        )}
        <div>
          <span>{t("bk_travelers")}</span>
          <b>{totalPax}</b>
        </div>
      </div>
      <div className="om-bk-total">
        <span>{t("bk_total")}</span>
        <b>{fmt(grandTotal)}</b>
      </div>
      <div className="om-bk-actions">
        {step === 2 && (
          <button className="om-bk-ghost" onClick={() => setStep(1)}>{t("bk_back")}</button>
        )}
        {step === 1 ? (
          <button className="om-bk-next" disabled={!canContinue} onClick={() => setStep(2)}>
            {t("bk_continue")}
          </button>
        ) : (
          <button className="om-bk-next" disabled={!leadValid || sending} onClick={submit}>
            {sending ? t("bk_sending") : t("bk_submit")}
          </button>
        )}
      </div>
      {error && <p className="om-bk-err">{error}</p>}
      <p className="om-bk-hint">{t("om_bk_hint")}</p>
    </aside>
  );

  return shell(
    <div className="om-bk-body">
      <div className="om-bk-main">
        {step === 1 ? (
          <>
            <span className="om-bk-cap">{t("bk_date")}</span>
            {dates.length === 0 ? (
              <p style={{ color: "var(--ink-2)", fontSize: 14 }}>{t("bk_no_dates")}</p>
            ) : (
              <div className="om-bk-dates">
                {dates.map((d, i) => (
                  <button
                    key={i}
                    className={`om-bk-date ${i === dateIdx ? "is-on" : ""}`}
                    onClick={() => setDateIdx(i)}
                  >
                    <b>{d.from} → {d.to}</b>
                    {d.label && <span>{d.label}</span>}
                  </button>
                ))}
              </div>
            )}

            <span className="om-bk-cap">{t("om_bk_occ")}</span>
            <div className="om-bk-occ">
              {pricing.map((p) => {
                const k = p.key || p.label;
                return (
                  <div className="om-bk-occ-row" key={k}>
                    <div className="info">
                      <b>
                        {p.label} {p.labelAr && <em lang="ar">{p.labelAr}</em>}
                      </b>
                      <span>{fmt(Number(p.price))} / {t("om_pk_pp")}</span>
                    </div>
                    <div className="om-bk-step">
                      <button onClick={() => bump(k, -1)} disabled={!qty[k]} aria-label="−">−</button>
                      <b>{qty[k] || 0}</b>
                      <button onClick={() => bump(k, 1)} aria-label="+">+</button>
                    </div>
                  </div>
                );
              })}
              {childPrice > 0 && (
                <div className="om-bk-occ-row">
                  <div className="info">
                    <b>{t("om_pk_child")} <em lang="ar">طِفْل</em></b>
                    <span>{fmt(childPrice)} / {t("om_pk_pp")}</span>
                  </div>
                  <div className="om-bk-step">
                    <button onClick={() => setChildren((c) => Math.max(0, c - 1))} disabled={!children} aria-label="−">−</button>
                    <b>{children}</b>
                    <button onClick={() => setChildren((c) => c + 1)} aria-label="+">+</button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="om-bk-cap">{t("om_bk_pilgrims")}</span>
            {pilgrims.map((p, i) => (
              <div className="om-bk-pilgrim" key={i}>
                <span>
                  {i === 0 ? t("bk_lead") : `${t("bk_participant")} ${i + 1}`}
                </span>
                <div className="om-bk-grid">
                  <input
                    className="om-bk-input"
                    placeholder={`${t("bk_fullname")}${i === 0 ? " *" : ""}`}
                    value={p.fullName || ""}
                    onChange={(e) => setP(i, "fullName", e.target.value)}
                  />
                  {i === 0 ? (
                    <input
                      className="om-bk-input"
                      placeholder={`${t("bk_phone")} *`}
                      type="tel"
                      value={p.phone || ""}
                      onChange={(e) => setP(i, "phone", e.target.value)}
                    />
                  ) : (
                    <input
                      className="om-bk-input"
                      placeholder={t("bk_doc")}
                      value={p.docNumber || ""}
                      onChange={(e) => setP(i, "docNumber", e.target.value)}
                    />
                  )}
                  {i === 0 && (
                    <>
                      <input
                        className="om-bk-input"
                        placeholder={t("bk_email_opt")}
                        type="email"
                        value={p.email || ""}
                        onChange={(e) => setP(i, "email", e.target.value)}
                      />
                      <input
                        className="om-bk-input"
                        placeholder={t("bk_doc")}
                        value={p.docNumber || ""}
                        onChange={(e) => setP(i, "docNumber", e.target.value)}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
            <span className="om-bk-cap">{t("om_bk_notes")}</span>
            <textarea
              className="om-bk-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("om_bk_notes_ph")}
            />
          </>
        )}
      </div>
      {recap}
    </div>
  );
}
