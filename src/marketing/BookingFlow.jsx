import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useAuth } from "../context/AuthContext";
import { useReservation } from "../context/ReservationContext";
import { useEvents } from "../context/EventsContext";
import { useLocale } from "./i18n";
import { upcomingDepartures } from "./dates";
import { roomTypesFor } from "../services/roomTypes";
import db, { Collections } from "../services/database";
import { parseBookedSnapshot } from "../context/HotelsContext";
import { getAvailability } from "../services/operations";
import { CIVILITIES, passportExpiryIssue } from "../services/travelers";
import { formuleMode } from "../services/formules";
import { useAgency } from "../services/useAgency";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { Footer } from "./Sections";
import { Arrow } from "./ui";

const parsePrice = (str) => parseFloat(String(str ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

/* ─── Wizard ─────────────────────────────────────────────────────────────── */
/* Page de réservation (route /reserver/:id ; sur place dans l'aperçu de l'éditeur).
   onClose : retour à la fiche du voyage. */
export default function BookingFlow({ pkg, onClose, prefill, initialDateIdx = null, preview = false }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const { createReservation } = useReservation();
  const { trackPayment, trackAbandon, trackBookingStep } = useEvents();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const fmt = (n) => `${nf.format(n)} DH`;

  /* Two pricing modes:
     - room-based, when the editor's hotelCategories carry priced rooms
     - per-person on basePrice otherwise (the legacy flat pkg.hotels field is
       untouched editor-template data on old documents — never trusted here) */
  const categories = useMemo(() => pkg.hotelCategories ?? [], [pkg]);

  // Room columns are whatever the formule actually prices — including custom
  // ones the admin added in the editor ("Baby 1-2") — never a fixed four.
  const hasPricedRooms = useMemo(
    () =>
      categories.some((c) => {
        const types = roomTypesFor(c);
        return (c.hotels || []).some((h) => types.some((rt) => parsePrice(h.cols?.[rt.colIdx]) > 0));
      }),
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

  // Formule choisie sur la fiche (?formule=n), sinon la première.
  const [catIdx, setCatIdx] = useState(() => {
    const n = Number(prefill?.formule);
    return Number.isInteger(n) && n >= 0 && n < categories.length ? n : 0;
  });
  const [dateIdx, setDateIdx] = useState(initialDateIdx);
  // Une seule configuration de chambres : pour l'hôtel choisi (séjour) ou
  // pour chaque étape du circuit (le même groupe passe par tous les hôtels).
  const [rooms, setRooms] = useState({}); // {roomKey: qty}
  const [hotelIdx, setHotelIdx] = useState(0); // séjour : hôtel choisi parmi les alternatives
  const [pax, setPax] = useState(() => Math.max(1, Number(prefill?.adults) || 2)); // per-person mode
  const [supp, setSupp] = useState({}); // {key: nombre de voyageurs}
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
  const hotels = useMemo(() => category?.hotels || [], [category]);
  const mode = formuleMode(category);
  const stayHotels = useMemo(
    () => (mode === "circuit" ? hotels : hotels[hotelIdx] ? [hotels[hotelIdx]] : []),
    [mode, hotels, hotelIdx]
  );
  // Price columns of the selected formule, labelled from its own headers.
  const roomTypes = useMemo(() => roomTypesFor(category), [category]);
  const dates = useMemo(() => upcomingDepartures(pkg.departureDates), [pkg.departureDates]);
  const [availability, setAvailability] = useState([]);
  useEffect(() => {
    if (preview || !pkg.$id) return;
    let alive = true;
    getAvailability(pkg.$id).then((a) => alive && setAvailability(a.departures)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [pkg.$id, preview]);
  const availOf = (d) => (d ? availability.find((a) => a.from === d.from && (!d.to || a.to === d.to)) || null : null);
  // Seulement les suppléments du package : plus de liste par défaut (elle
  // proposait les excursions d'Istanbul sur tous les voyages). Même règle côté API.
  const suppList = (pkg.suppliments || []).map((s) => ({ key: s.key || s.label, label: s.label, pricePerPax: Number(s.pricePerPax) || 0 }));

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

  useEffect(() => { setRooms({}); setHotelIdx(0); }, [catIdx]);

  /* pricing — prix du type de chambre × voyageurs, sur l'hôtel choisi (séjour)
     ou sur chaque étape (circuit) ; voyageurs comptés une seule fois */
  const { breakdown, baseTotal, totalPax } = useMemo(() => {
    if (perPerson) {
      return { breakdown: [], baseTotal: ppPrice * pax, totalPax: pax };
    }
    const roomPax = roomTypes.reduce((a, rt) => a + (rooms[rt.key] || 0) * rt.paxPerRoom, 0);
    if (!roomPax) return { breakdown: [], baseTotal: 0, totalPax: 0 };
    let baseTotal = 0;
    const breakdown = stayHotels.map((hotel) => {
      const lines = [];
      let hTotal = 0;
      roomTypes.forEach((rt) => {
        const qty = rooms[rt.key] || 0;
        if (qty <= 0) return;
        const subtotal = parsePrice(hotel.cols?.[rt.colIdx]) * qty * rt.paxPerRoom;
        hTotal += subtotal;
        lines.push({ label: rt.label, qty, subtotal });
      });
      baseTotal += hTotal;
      return { name: hotel.name, hotelId: hotel.hotelId || null, lines, total: hTotal, pax: roomPax };
    });
    return { breakdown, baseTotal, totalPax: roomPax };
  }, [rooms, stayHotels, roomTypes, perPerson, ppPrice, pax]);

  // Suppléments : chacun pour le nombre de voyageurs choisi (plafonné au total).
  const suppQty = (key) => Math.min(supp[key] || 0, totalPax);
  const suppTotal = suppList.reduce((a, s) => a + s.pricePerPax * suppQty(s.key), 0);
  const selected = dateIdx !== null ? dates[dateIdx] : null;
  const departureSupp = Number(selected?.supplement) || 0;
  const departureSuppTotal = departureSupp * totalPax;
  const grandTotal = baseTotal + suppTotal + departureSuppTotal;
  const selectedAvail = availOf(selected);
  const seatsShort = !!selectedAvail && (selectedAvail.closed || (selectedAvail.remaining !== null && selectedAvail.remaining < totalPax));
  const canContinue =
    dateIdx !== null && totalPax > 0 && !seatsShort && (perPerson ? ppPrice > 0 || true : !!category && breakdown.length > 0);

  useEffect(() => {
    setParticipants((prev) => {
      const target = Math.max(totalPax, 1);
      if (prev.length === target) return prev;
      return prev.length < target
        ? [...prev, ...Array.from({ length: target - prev.length }, () => ({}))]
        : prev.slice(0, target);
    });
  }, [totalPax]);

  const setQty = (key, delta) => setRooms((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) }));

  const setP = (i, field, value) =>
    setParticipants((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));

  // Voyageur 1 (contact principal) : nom et email du compte connecté par défaut,
  // la saisie du client reste prioritaire.
  const people = participants.map((p, i) =>
    i === 0 && user ? { fullName: user.name || "", email: user.email || "", ...p } : p
  );
  const leadValid = !!(people[0]?.fullName?.trim() && people[0]?.phone?.trim());

  // Passeports : valables au moins N mois après le retour (Paramètres → Agence).
  const agency = useAgency();
  const passportMonths = Number(agency.passportValidityMonths) || 0;
  const travelEnd = useMemo(() => {
    const d = dateIdx !== null ? dates[dateIdx] : null;
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(d?.to ?? "").trim());
    if (!d?.when || !m) return null;
    let end = new Date(d.when.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (end < d.when) end = new Date(d.when.getFullYear() + 1, Number(m[2]) - 1, Number(m[1]));
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  }, [dates, dateIdx]);
  const passportErrors = people.map((p) => passportExpiryIssue(p.passportExpiry, travelEnd, passportMonths));
  const passportsOk = passportErrors.every((e) => !e);

  const submit = async () => {
    if (!leadValid || !passportsOk || sending) return;
    if (preview) { setError(t("bk_preview")); return; }
    setSending(true);
    setError(null);
    trackBookingStep({ targetId: pkg.$id, label: pkg.title || pkg.destination, step: "submit", data: { totalPax } });
    try {
      const selectedDate = dates[dateIdx];
      const packageTitle = `${pkg.destination ?? ""}${pkg.destinationAccent ?? ""}` || pkg.title || "";
      // TRUST BOUNDARY: totalEstimate below (`grandTotal`) is computed
      // entirely client-side from prices already visible in the page's own
      // HTML/JS — nothing stops a visitor from editing it in devtools before
      // this call fires. createReservation (ReservationContext.jsx) posts it
      // to POST /v1/reservations, which recomputes the price from the
      // package's catalog data (api/src/reservations/pricing.ts) and only
      // keeps totalEstimate as `clientEstimate` for comparison.
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
        participants: JSON.stringify(people),
        supplements: suppList.filter((s) => suppQty(s.key) > 0).map((s) => ({ key: s.key, qty: suppQty(s.key) })),
        totalEstimate: grandTotal,
        recaptchaToken: executeRecaptcha ? await executeRecaptcha("reservation") : null,
      });
      if (!result?.success) {
        setError(result?.message || t("bk_err"));
        trackBookingStep({ targetId: pkg.$id, label: pkg.title || pkg.destination, step: "error", data: { message: result?.message || "" } });
        return;
      }
      setDone(result.reservation || {});
      trackBookingStep({ targetId: pkg.$id, label: pkg.title || pkg.destination, step: "success", data: { totalEstimate: grandTotal, totalPax } });
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
      // Erreurs de réservation (complet, captcha, session…) : visibles dans Analytics.
      trackBookingStep({ targetId: pkg.$id, label: pkg.title || pkg.destination, step: "error", data: { message: err?.message || "" } });
    } finally {
      setSending(false);
    }
  };

  /* ── recap panel ── */
  const recap = (
    <aside className="mk-bk-recap">
        <div className="mk-bk-trip">
          {pkg.heroBg ? <img src={pkg.heroBg} alt="" /> : <span aria-hidden="true" />}
          <div>
            <b>{pkg.title || `${pkg.destination ?? ""}${pkg.destinationAccent ?? ""}`}</b>
            <small>{[pkg.country, pkg.durationLabel].filter(Boolean).join(" · ")}</small>
          </div>
        </div>
      <h4>{t("bk_recap")}</h4>
      <div className="mk-bk-recap-rows">
        {!perPerson && <div><span>{t("bk_formule")}</span><b>{category?.label ?? "—"}</b></div>}
        <div><span>{t("bk_date")}</span><b>{dateIdx !== null ? `${dates[dateIdx].from} → ${dates[dateIdx].to}` : "—"}</b></div>
        {perPerson && (
          <div><span>{t("bk_pp_price")} × {totalPax}</span><b>{fmt(baseTotal)}</b></div>
        )}
        {mode === "circuit" && breakdown.length > 1 ? (
          <div className="mk-bk-recap-hotel">
            <span>{t("bk_circuit_short")}</span>
            <b>{fmt(baseTotal)}</b>
            <em>{breakdown.map((h) => h.name).join(" → ")} · {breakdown[0].lines.map((l) => `${l.qty}× ${l.label}`).join(" · ")} — {totalPax} {t("bk_travelers")}</em>
          </div>
        ) : (
          breakdown.map((h) => (
            <div key={h.name} className="mk-bk-recap-hotel">
              <span>{h.name}</span>
              <b>{fmt(h.total)}</b>
              <em>{h.lines.map((l) => `${l.qty}× ${l.label}`).join(" · ")} — {h.pax} {t("bk_travelers")}</em>
            </div>
          ))
        )}
        {suppList.filter((s) => suppQty(s.key) > 0).map((s) => (
          <div key={s.key}><span>{s.label} × {suppQty(s.key)}</span><b>{fmt(s.pricePerPax * suppQty(s.key))}</b></div>
        ))}
        {departureSupp !== 0 && (
          <div><span>{departureSupp > 0 ? "Supplément" : "Réduction"} départ ({fmt(Math.abs(departureSupp))} × {totalPax})</span><b>{departureSupp < 0 ? "−" : ""}{fmt(Math.abs(departureSuppTotal))}</b></div>
        )}
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
        <div className="mk-bk-done-actions">
          <button className="mk-btn" onClick={() => navigate("/profil#reservations")}>{t("nav_bookings")}</button>
          <button className="mk-btn mk-btn--ghost" onClick={onClose}>{t("bk_back")}</button>
        </div>
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
                {dates.map((d, i) => {
                  const a = availOf(d);
                  const full = !!a?.closed;
                  const supplement = Number(d.supplement) || 0;
                  return (
                    <button key={d.id ?? i} className={i === dateIdx ? "is-active" : ""} disabled={full} onClick={() => setDateIdx(i)} title={full ? "Complet" : undefined}>
                      {d.from} → {d.to}
                      {(full || supplement !== 0 || (a && a.remaining !== null && a.remaining <= 6) || a?.guaranteed) && (
                        <small style={{ display: "block", fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                          {full ? "Complet" : [
                            supplement ? `${supplement > 0 ? "+" : "−"}${nf.format(Math.abs(supplement))} DH/pers.` : "",
                            a && a.remaining !== null && a.remaining <= 6 ? `${a.remaining} place${a.remaining > 1 ? "s" : ""}` : "",
                            a?.guaranteed ? "garanti" : "",
                          ].filter(Boolean).join(" · ")}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {seatsShort && selectedAvail && !selectedAvail.closed && (
              <p className="mk-bk-error">⚠ Plus que {selectedAvail.remaining} place(s) sur ce départ : réduisez le nombre de voyageurs ou choisissez une autre date.</p>
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
              {mode === "circuit" ? (
                <>
                  <h4>{t("bk_circuit")}</h4>
                  <ol className="mk-bk-itinerary">
                    {hotels.map((h, i) => (
                      <li key={h.id ?? i}>
                        <b>{h.city || `${t("bk_step")} ${i + 1}`}</b>
                        <span>
                          {/* DISPLAY ONLY — the payload still carries the raw h.name */}
                          {h.name}{h.stars ? ` · ${h.stars}★` : ""}
                          {h.nights ? ` · ${h.nights} ${Number(h.nights) > 1 ? t("cal_nights") : t("cal_night")}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <>
                  <h4>{hotels.length > 1 ? t("bk_choose_hotel") : t("bk_hotels")}</h4>
                  <div className="mk-bk-hotelpick" role="radiogroup">
                    {hotels.map((h, i) => {
                      const prices = roomTypes.map((rt) => parsePrice(h.cols?.[rt.colIdx])).filter((n) => n > 0);
                      return (
                        <button
                          key={h.id ?? i}
                          role="radio"
                          aria-checked={i === hotelIdx}
                          className={i === hotelIdx ? "is-active" : ""}
                          onClick={() => setHotelIdx(i)}
                        >
                          <i aria-hidden="true" />
                          <span>
                            <b>{h.name}</b>
                            <small>
                              {h.city ? `${h.city} · ` : ""}{h.stars ? `${h.stars}★` : ""}
                              {h.nights ? ` · ${h.nights} ${Number(h.nights) > 1 ? t("cal_nights") : t("cal_night")}` : ""}
                            </small>
                          </span>
                          {prices.length > 0 && <em>{t("trips_from")} {fmt(Math.min(...prices))}</em>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <h4 style={{ marginTop: 18 }}>{t("bk_rooms")}</h4>
              <div className="mk-bk-roomgrid mk-bk-roomgrid--solo">
                {roomTypes.map((rt) => {
                  // Circuit : prix du type = somme des étapes.
                  const price = stayHotels.reduce((a, h) => a + parsePrice(h.cols?.[rt.colIdx]), 0);
                  if (!price) return null;
                  const qty = rooms[rt.key] || 0;
                  const full = stayHotels.some((h) => roomBlocked(h, rt, qty + 1));
                  return (
                    <div key={rt.key} className="mk-bk-room">
                      <div>
                        {/* DISPLAY ONLY — rooms[].type stays rt.label verbatim */}
                        <b>{t("bk_room_label")} {rt.label}</b>
                        <span>{fmt(price)} {t("bk_per_pax")} · {rt.paxPerRoom} {t("bk_room_per")}</span>
                        {full && qty === 0 && <em className="mk-bk-full">{t("bk_room_full")}</em>}
                      </div>
                      <div className="mk-bk-stepper">
                        <button aria-label="−" disabled={qty === 0} onClick={() => setQty(rt.key, -1)}>−</button>
                        <b>{qty}</b>
                        <button aria-label="+" disabled={full} title={full ? t("bk_room_full") : undefined} onClick={() => setQty(rt.key, 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {suppList.length > 0 && (
            <section>
              <h4>{t("bk_supplements")}</h4>
              <p className="mk-bk-muted" style={{ marginTop: -4 }}>{t("bk_supp_hint")}</p>
              <div className="mk-bk-suppqty">
                {suppList.map((s) => {
                  const q = suppQty(s.key);
                  return (
                    <div key={s.key} className={`mk-bk-supp ${q ? "is-active" : ""}`}>
                      <div>
                        <b>{s.label}</b>
                        <span>+{fmt(s.pricePerPax)} {t("bk_per_pax")}{q ? ` · ${q} ${t("bk_travelers")}` : ""}</span>
                      </div>
                      <div className="mk-bk-stepper">
                        <button aria-label="−" disabled={!q} onClick={() => setSupp((p) => ({ ...p, [s.key]: Math.max(0, q - 1) }))}>−</button>
                        <b>{q}</b>
                        <button aria-label="+" disabled={!totalPax || q >= totalPax} onClick={() => setSupp((p) => ({ ...p, [s.key]: Math.min(totalPax, q + 1) }))}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!canContinue && <p className="mk-bk-muted">{t(perPerson ? "bk_hint_pp" : "bk_hint")}</p>}
          <button className="mk-btn mk-bk-next" disabled={!canContinue} onClick={() => { setStep(2); trackBookingStep({ targetId: pkg.$id, label: pkg.title || pkg.destination, step: "travelers", data: { totalPax, departure: selected?.from } }); }}>
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
            <p className="mk-bk-muted" style={{ marginTop: -4 }}>
              {passportMonths ? t("bk_passport_rule").replace("{months}", passportMonths) : t("bk_passport_later")}
            </p>
            <div className="mk-bk-people">
              {people.map((p, i) => (
                <fieldset key={i} className="mk-bk-person">
                  <legend>
                    {t("bk_participant")} {i + 1}
                    {i === 0 && <em> — {t("bk_lead")}</em>}
                  </legend>
                  <div className="mk-bk-fields">
                    <select value={p.civility || ""} onChange={(e) => setP(i, "civility", e.target.value)} aria-label="Civilité">
                      <option value="">Civilité</option>
                      {CIVILITIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <input placeholder={`${t("bk_fullname")}${i === 0 ? " *" : ""}`} value={p.fullName || ""} onChange={(e) => setP(i, "fullName", e.target.value)} />
                    <input placeholder={`${t("bk_phone")}${i === 0 ? " *" : ""}`} type="tel" value={p.phone || ""} onChange={(e) => setP(i, "phone", e.target.value)} />
                    {i === 0 && (
                      <input placeholder={t("bk_email_opt")} type="email" value={p.email || ""} onChange={(e) => setP(i, "email", e.target.value)} />
                    )}
                    <label className="mk-bk-datefield">Date de naissance<input type="date" value={p.birthDate || ""} onChange={(e) => setP(i, "birthDate", e.target.value)} /></label>
                    <input placeholder={t("bk_doc")} value={p.passportNumber || ""} onChange={(e) => setP(i, "passportNumber", e.target.value)} />
                    <label className="mk-bk-datefield">Expiration du passeport<input type="date" aria-invalid={!!passportErrors[i]} value={p.passportExpiry || ""} onChange={(e) => setP(i, "passportExpiry", e.target.value)} /></label>
                  </div>
                  {passportErrors[i] && <p className="mk-bk-error" role="alert" style={{ margin: "8px 0 0" }}>⚠ {t("bk_passport_refused")} : {passportErrors[i]}.</p>}
                </fieldset>
              ))}
            </div>
          </section>

          {error && <p className="mk-bk-error">⚠ {error}</p>}

          <div className="mk-bk-nav">
            <button className="mk-btn mk-btn--ghost mk-btn--sm" onClick={() => setStep(1)}>{t("bk_back")}</button>
            <button className="mk-btn" disabled={!leadValid || !passportsOk || sending} onClick={submit}>
              {sending ? t("bk_sending") : t("bk_submit")}
            </button>
          </div>
        </div>
        {recap}
      </div>
    );
  }

  const steps = !done && (
    <div className="mk-bk-steps">
      <b className={step === 1 ? "is-on" : ""}>1 · {t("bk_step1")}</b>
      <i />
      <b className={step === 2 ? "is-on" : ""}>2 · {t("bk_step2")}</b>
    </div>
  );

  return (
      <div className="mk mk-bk-page">
        {!preview && <Header />}
        <main className="mk-wrap mk-bk-pagein">
          <button className="mk-bk-back" onClick={onClose}>
            <span aria-hidden="true"><Arrow size={13} /></span>
            {pkg.title || pkg.destination}
          </button>
          <div className="mk-bk-pagehead">
            <div>
              <span className="mk-eyebrow">{t("pk_book")}</span>
              <h1 className="mk-h2">{pkg.destination}{pkg.destinationAccent}</h1>
            </div>
            {steps}
          </div>
          {body}
        </main>
        {!preview && <Footer />}
      </div>
  );
}
