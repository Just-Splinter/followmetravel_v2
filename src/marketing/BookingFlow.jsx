import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useAuth } from "../context/AuthContext";
import { useReservation } from "../context/ReservationContext";
import { useEvents } from "../context/EventsContext";
import { useLocale } from "./i18n";
import { upcomingDepartures } from "./dates";
import { ROOM_TYPES } from "../services/roomTypes";
import db, { Collections } from "../services/database";
import { parseBookedSnapshot } from "../context/HotelsContext";

/* ─── Business contract (identical to the legacy modal / admin manager) ───── */
const DEFAULT_SUPPLEMENTS = [
  { key: "excursions", label: "Pack Excursions", pricePerPax: 800 },
  { key: "princes", label: "Îles des Princes + déjeuner", pricePerPax: 350 },
  { key: "bursa", label: "Excursion Bursa", pricePerPax: 250 },
  { key: "shopping", label: "City Tour & Shopping Day", pricePerPax: 200 },
  { key: "bosphore", label: "Croisière Bosphore by Night", pricePerPax: 300 },
];
const parsePrice = (str) => parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

/* ─── Wizard ─────────────────────────────────────────────────────────────── */
export default function BookingFlow({ pkg, onClose, prefill, initialDateIdx = null, preview = false }) {
  const { t, locale } = useLocale();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const { createReservation } = useReservation();
  const { trackPayment, trackAbandon } = useEvents();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const fmt = (n) => `${nf.format(n)} DH`;

  /* Two pricing modes:
     - room-based, when the editor's hotelCategories carry priced rooms
     - per-person on basePrice otherwise (the legacy flat pkg.hotels field is
       untouched editor-template data on old documents — never trusted here) */
  const categories = useMemo(() => pkg.hotelCategories ?? [], [pkg]);

  const hasPricedRooms = useMemo(
    () =>
      categories.some((c) =>
        (c.hotels || []).some((h) => ROOM_TYPES.some((rt) => parsePrice(h.cols?.[rt.colIdx]) > 0))
      ),
    [categories]
  );
  const perPerson = !hasPricedRooms;
  const ppPrice = Number(pkg.basePrice) || 0;

  // Availability snapshot, keyed by hotelId — fetched by document id only
  // (never a scan of the reservations collection), so this can safely run
  // for an anonymous/logged-out visitor without exposing anyone else's
  // booking. See HotelsContext.refreshAvailability() for how the snapshot
  // itself gets kept current.
  const [hotelDocs, setHotelDocs] = useState({});
  useEffect(() => {
    const ids = [...new Set(
      categories.flatMap((c) => (c.hotels || []).map((h) => h.hotelId)).filter(Boolean)
    )];
    if (!ids.length) return;
    let alive = true;
    Promise.allSettled(ids.map((id) => db.get(Collections.HOTELS, id))).then((results) => {
      if (!alive) return;
      const map = {};
      results.forEach((r) => { if (r.status === "fulfilled") map[r.value.$id] = r.value; });
      setHotelDocs(map);
    });
    return () => { alive = false; };
  }, [categories]);

  // Capacity and the block flag are per-package (set in the package editor,
  // on this hotel row) — the shared hotel catalog document only supplies
  // the live booked count via its public bookedSnapshot.
  const roomRemaining = (hotel, rt) => {
    const total = Number(hotel.allotment?.[rt.colIdx]) || 0;
    if (!total) return Infinity; // no allotment configured = not tracked
    const doc = hotelDocs[hotel.hotelId];
    const booked = doc
      ? (parseBookedSnapshot(doc.bookedSnapshot)[pkg.$id] || []).find((r) => r.type === rt.label)?.booked || 0
      : 0;
    return total - booked;
  };
  const roomBlocked = (hotel, rt, nextQty) =>
    !!hotel.blockWhenFull && nextQty > roomRemaining(hotel, rt);

  const [catIdx, setCatIdx] = useState(0);
  const [dateIdx, setDateIdx] = useState(initialDateIdx);
  const [rooms, setRooms] = useState({}); // {hotelIdx: {roomKey: qty}}
  const [pax, setPax] = useState(() => Math.max(1, Number(prefill?.adults) || 2)); // per-person mode
  const [supp, setSupp] = useState({});
  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState([{}]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // reservation result

  // Funnel-abandon: fires once on unmount (close button, Escape, or the
  // caller stops rendering us) unless the reservation went through.
  const doneRef = useRef(false);
  useEffect(() => { doneRef.current = !!done; }, [done]);
  useEffect(() => {
    return () => {
      if (!doneRef.current) {
        trackAbandon({ targetId: pkg.$id, label: pkg.title || pkg.destination, page: window.location.pathname });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const category = categories[catIdx] || null;
  const hotels = category?.hotels || [];
  const dates = useMemo(() => upcomingDepartures(pkg.departureDates), [pkg.departureDates]);
  const suppList = pkg.suppliments?.length
    ? pkg.suppliments.map((s) => ({ key: s.key || s.label, label: s.label, pricePerPax: Number(s.pricePerPax) || 0 }))
    : DEFAULT_SUPPLEMENTS;

  /* Preselect the departure nearest to the date requested in the hero form */
  useEffect(() => {
    if (initialDateIdx !== null || !prefill?.date || !dates.length) return;
    const wanted = new Date(prefill.date);
    if (isNaN(wanted)) return;
    let best = 0, bestGap = Infinity;
    dates.forEach((d, i) => {
      const gap = Math.abs(d.when - wanted);
      if (gap < bestGap) { bestGap = gap; best = i; }
    });
    setDateIdx(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setRooms({}); }, [catIdx]);
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

  /* pricing — same math as the legacy modal (room mode) */
  const { breakdown, baseTotal, totalPax } = useMemo(() => {
    if (perPerson) {
      return { breakdown: [], baseTotal: ppPrice * pax, totalPax: pax };
    }
    let baseTotal = 0, totalPax = 0;
    const breakdown = [];
    Object.entries(rooms).forEach(([hIdx, r]) => {
      const hotel = hotels[Number(hIdx)];
      if (!hotel) return;
      const lines = [];
      let hTotal = 0, hPax = 0;
      ROOM_TYPES.forEach((rt) => {
        const qty = r[rt.key] || 0;
        if (qty <= 0) return;
        const price = parsePrice(hotel.cols?.[rt.colIdx]);
        const pax = qty * rt.paxPerRoom;
        hTotal += price * pax;
        hPax += pax;
        lines.push({ label: rt.label, qty, subtotal: price * pax });
      });
      if (hPax > 0) {
        baseTotal += hTotal; totalPax += hPax;
        breakdown.push({ name: hotel.name, hotelId: hotel.hotelId || null, lines, total: hTotal, pax: hPax });
      }
    });
    return { breakdown, baseTotal, totalPax };
  }, [rooms, hotels, perPerson, ppPrice, pax]);

  const suppTotal = suppList.reduce((a, s) => (supp[s.key] ? a + s.pricePerPax * totalPax : a), 0);
  const grandTotal = baseTotal + suppTotal;
  const canContinue =
    dateIdx !== null && totalPax > 0 && (perPerson ? ppPrice > 0 || true : !!category && breakdown.length > 0);

  useEffect(() => {
    setParticipants((prev) => {
      const target = Math.max(totalPax, 1);
      if (prev.length === target) return prev;
      return prev.length < target
        ? [...prev, ...Array.from({ length: target - prev.length }, () => ({}))]
        : prev.slice(0, target);
    });
  }, [totalPax]);

  const setQty = (hIdx, key, delta) =>
    setRooms((prev) => {
      const h = { ...(prev[hIdx] || {}) };
      h[key] = Math.max(0, (h[key] || 0) + delta);
      return { ...prev, [hIdx]: h };
    });

  const setP = (i, field, value) =>
    setParticipants((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  const leadValid = !!(participants[0]?.fullName?.trim() && participants[0]?.phone?.trim());

  const submit = async () => {
    if (!leadValid || sending) return;
    if (preview) { setError(t("bk_preview")); return; }
    setSending(true);
    setError(null);
    try {
      const selectedDate = dates[dateIdx];
      const packageTitle = `${pkg.destination ?? ""}${pkg.destinationAccent ?? ""}` || pkg.title || "";
      // TRUST BOUNDARY: totalEstimate below (`grandTotal`) is computed
      // entirely client-side from prices already visible in the page's own
      // HTML/JS — nothing stops a visitor from editing it in devtools before
      // this call fires. createReservation (ReservationContext.jsx) forwards
      // this payload verbatim to Appwrite Function '6a312ae3000737bbe2ac',
      // whose source lives outside this repo. That function MUST recompute
      // the price server-side from packageId/category/hotels/dates and
      // ignore/validate totalEstimate, or a booking's charged amount can be
      // manipulated. Not something this repo can verify or fix — check the
      // function's own source.
      const result = await createReservation({
        packageId: pkg.$id ?? pkg.id,
        packageTitle,
        category: perPerson ? null : category?.label ?? null,
        hotels: JSON.stringify(
          perPerson
            ? []
            : breakdown.map((h) => ({
                name: h.name,
                hotelId: h.hotelId,
                rooms: h.lines.map((l) => ({ type: l.label, qty: l.qty })),
                subtotal: h.total,
                pax: h.pax,
              }))
        ),
        dateFrom: selectedDate.from,
        dateTo: selectedDate.to,
        totalPax,
        participants: JSON.stringify(participants),
        supplements: suppList.filter((s) => supp[s.key]).map((s) => s.key),
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
      // Best-effort: bump the public snapshot so the very next visitor sees
      // this booking without waiting for an admin to reopen the hotels page.
      // Not atomic (read-then-write) — a rare concurrent double-booking on
      // the last room just means the admin's next refresh corrects it.
      // Scoped by pkg.$id: this package's booking must not touch another
      // package's pool on the same hotel.
      breakdown.forEach((h) => {
        if (!h.hotelId) return;
        const doc = hotelDocs[h.hotelId];
        if (!doc) return;
        const snapshot = parseBookedSnapshot(doc.bookedSnapshot);
        const rows = snapshot[pkg.$id] || [];
        h.lines.forEach((l) => {
          const row = rows.find((s) => s.type === l.label);
          if (row) row.booked = (row.booked || 0) + l.qty;
          else rows.push({ type: l.label, booked: l.qty });
        });
        snapshot[pkg.$id] = rows;
        db.update(Collections.HOTELS, h.hotelId, { bookedSnapshot: JSON.stringify(snapshot) }).catch(() => {});
      });
    } catch (err) {
      setError(err?.message === "AUTH_REQUIRED" ? t("bk_auth_t") : err?.message || t("bk_err"));
    } finally {
      setSending(false);
    }
  };

  /* ── recap panel ── */
  const recap = (
    <aside className="mk-bk-recap">
      <h4>{t("bk_recap")}</h4>
      <div className="mk-bk-recap-rows">
        {!perPerson && <div><span>{t("bk_formule")}</span><b>{category?.label ?? "—"}</b></div>}
        <div><span>{t("bk_date")}</span><b>{dateIdx !== null ? `${dates[dateIdx].from} → ${dates[dateIdx].to}` : "—"}</b></div>
        {perPerson && (
          <div><span>{t("bk_pp_price")} × {totalPax}</span><b>{fmt(baseTotal)}</b></div>
        )}
        {breakdown.map((h) => (
          <div key={h.name} className="mk-bk-recap-hotel">
            <span>{h.name}</span>
            <b>{fmt(h.total)}</b>
            <em>{h.lines.map((l) => `${l.qty}× ${l.label}`).join(" · ")} — {h.pax} {t("bk_travelers")}</em>
          </div>
        ))}
        {suppList.filter((s) => supp[s.key]).map((s) => (
          <div key={s.key}><span>{s.label}</span><b>{fmt(s.pricePerPax * totalPax)}</b></div>
        ))}
      </div>
      <div className="mk-bk-total">
        <span>{t("bk_total")}</span>
        <b>{fmt(grandTotal)}</b>
      </div>
      <p className="mk-bk-note">{totalPax} {t("bk_travelers")} · {t("sr_night_note")}</p>
    </aside>
  );

  /* ── states ── */
  let body;

  if (done) {
    body = (
      <div className="mk-bk-done">
        <span className="mk-eyebrow">{t("bk_ok_t")}</span>
        {done.ref && (
          <div className="mk-bk-ref">
            <em>{t("bk_ok_ref")}</em>
            <b>{done.ref}</b>
          </div>
        )}
        <p>{t("bk_ok_d")}</p>
        <button className="mk-btn" onClick={onClose}>{t("bk_close")}</button>
      </div>
    );
  } else if (!preview && !authLoading && !user) {
    body = (
      <div className="mk-bk-auth">
        <h3>{t("bk_auth_t")}</h3>
        <p>{t("bk_auth_d")}</p>
        <button className="mk-btn" onClick={loginWithGoogle}>
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.4 38 47 31.9 47 24.6z"/>
            <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          {t("bk_auth_google")}
        </button>
        <div className="mk-bk-auth-side">{recap}</div>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div className="mk-bk-grid">
        <div className="mk-bk-form">
          {!perPerson && categories.length > 1 && (
            <section>
              <h4>{t("bk_formule")}</h4>
              <div className="mk-bk-pills">
                {categories.map((c, i) => (
                  <button key={c.id ?? i} className={i === catIdx ? "is-active" : ""} onClick={() => setCatIdx(i)}>
                    {c.label}
                    {c.basePrice && <em>{fmt(parsePrice(c.basePrice))}</em>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4>{t("bk_date")}</h4>
            {dates.length === 0 ? (
              <p className="mk-bk-muted">{t("bk_no_dates")}</p>
            ) : (
              <div className="mk-bk-pills mk-bk-pills--dates">
                {dates.map((d, i) => (
                  <button key={d.id ?? i} className={i === dateIdx ? "is-active" : ""} onClick={() => setDateIdx(i)}>
                    {d.from} → {d.to}
                  </button>
                ))}
              </div>
            )}
          </section>

          {perPerson && (
            <section>
              <h4>{t("bk_pax_label")}</h4>
              <div className="mk-bk-room" style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: "12px 16px", background: "#fff" }}>
                <div>
                  <b>{t("bk_travelers")}</b>
                  <span>{ppPrice > 0 ? `${fmt(ppPrice)} ${t("bk_per_pax")}` : t("sr_night_note")}</span>
                </div>
                <div className="mk-bk-stepper">
                  <button aria-label="−" disabled={pax <= 1} onClick={() => setPax((p) => Math.max(1, p - 1))}>−</button>
                  <b>{pax}</b>
                  <button aria-label="+" onClick={() => setPax((p) => Math.min(20, p + 1))}>+</button>
                </div>
              </div>
            </section>
          )}

          {!perPerson && (
          <section>
            <h4>{t("bk_hotels")}</h4>
            <div className="mk-bk-hotels">
              {hotels.map((h, hIdx) => {
                const sel = rooms[hIdx] || {};
                const active = Object.values(sel).some((q) => q > 0);
                return (
                  <details key={h.id ?? hIdx} className={`mk-bk-hotel ${active ? "is-active" : ""}`} open={active}>
                    <summary>
                      <div>
                        <b>{h.name}</b>
                        <span>
                          {h.city ? `${h.city} · ` : ""}{h.stars ? `${h.stars}★` : ""}
                          {h.nights ? ` · ${h.nights} ${Number(h.nights) > 1 ? t("cal_nights") : t("cal_night")}` : ""}
                        </span>
                      </div>
                      <i>{fmt(parsePrice(h.cols?.[0]))} <u>{t("bk_per_pax")}</u></i>
                    </summary>
                    <div className="mk-bk-roomgrid">
                      {ROOM_TYPES.map((rt) => {
                        const price = parsePrice(h.cols?.[rt.colIdx]);
                        if (!price) return null;
                        const qty = sel[rt.key] || 0;
                        const full = roomBlocked(h, rt, qty + 1);
                        return (
                          <div key={rt.key} className="mk-bk-room">
                            <div>
                              <b>{rt.label}</b>
                              <span>{fmt(price)} {t("bk_per_pax")} · {rt.paxPerRoom} {t("bk_room_per")}</span>
                              {full && qty === 0 && <em className="mk-bk-full">{t("bk_room_full")}</em>}
                            </div>
                            <div className="mk-bk-stepper">
                              <button aria-label="−" disabled={qty === 0} onClick={() => setQty(hIdx, rt.key, -1)}>−</button>
                              <b>{qty}</b>
                              <button aria-label="+" disabled={full} title={full ? t("bk_room_full") : undefined} onClick={() => setQty(hIdx, rt.key, 1)}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
          )}

          {suppList.length > 0 && (
            <section>
              <h4>{t("bk_supplements")}</h4>
              <div className="mk-bk-supps">
                {suppList.map((s) => (
                  <button
                    key={s.key}
                    className={supp[s.key] ? "is-active" : ""}
                    onClick={() => setSupp((p) => ({ ...p, [s.key]: !p[s.key] }))}
                  >
                    <i />
                    <span>{s.label}</span>
                    <b>+{fmt(s.pricePerPax)} {t("bk_per_pax")}</b>
                  </button>
                ))}
              </div>
            </section>
          )}

          {!canContinue && <p className="mk-bk-muted">{t(perPerson ? "bk_hint_pp" : "bk_hint")}</p>}
          <button className="mk-btn mk-bk-next" disabled={!canContinue} onClick={() => setStep(2)}>
            {t("bk_continue")} — {totalPax} {t("bk_travelers")}
          </button>
        </div>
        {recap}
      </div>
    );
  } else {
    body = (
      <div className="mk-bk-grid">
        <div className="mk-bk-form">
          <section>
            <h4>{t("bk_step2")}</h4>
            <div className="mk-bk-people">
              {participants.map((p, i) => (
                <fieldset key={i} className="mk-bk-person">
                  <legend>
                    {t("bk_participant")} {i + 1}
                    {i === 0 && <em> — {t("bk_lead")}</em>}
                  </legend>
                  <div className="mk-bk-fields">
                    <input placeholder={`${t("bk_fullname")}${i === 0 ? " *" : ""}`} value={p.fullName || ""} onChange={(e) => setP(i, "fullName", e.target.value)} />
                    <input placeholder={`${t("bk_phone")}${i === 0 ? " *" : ""}`} type="tel" value={p.phone || ""} onChange={(e) => setP(i, "phone", e.target.value)} />
                    {i === 0 && (
                      <input placeholder={t("bk_email_opt")} type="email" value={p.email || ""} onChange={(e) => setP(i, "email", e.target.value)} />
                    )}
                    <input placeholder={t("bk_doc")} value={p.docNumber || ""} onChange={(e) => setP(i, "docNumber", e.target.value)} />
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          {error && <p className="mk-bk-error">⚠ {error}</p>}

          <div className="mk-bk-nav">
            <button className="mk-btn mk-btn--ghost mk-btn--sm" onClick={() => setStep(1)}>{t("bk_back")}</button>
            <button className="mk-btn" disabled={!leadValid || sending} onClick={submit}>
              {sending ? t("bk_sending") : t("bk_submit")}
            </button>
          </div>
        </div>
        {recap}
      </div>
    );
  }

  return (
    <div className="mk mk-bk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mk-bk-panel" role="dialog" aria-modal="true">
        <div className="mk-bk-head">
          <div>
            <span className="mk-eyebrow">{pkg.destination}{pkg.destinationAccent}</span>
            {!done && (
              <div className="mk-bk-steps">
                <b className={step === 1 ? "is-on" : ""}>1 · {t("bk_step1")}</b>
                <i />
                <b className={step === 2 ? "is-on" : ""}>2 · {t("bk_step2")}</b>
              </div>
            )}
          </div>
          <button className="mk-bk-close" onClick={onClose} aria-label={t("bk_close")}>✕</button>
        </div>
        {body}
      </div>
    </div>
  );
}
