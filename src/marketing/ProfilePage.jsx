import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useReservation } from "../context/ReservationContext";
import { useLocale } from "./i18n";
import Header from "./Header";
import { Footer } from "./Sections";
import { Reveal } from "./ui";
import "./marketing.css";

const jparse = (v, fb) => { try { return JSON.parse(v) ?? fb; } catch { return fb; } };

const STATUS = {
  pending: { key: "st_pending", cls: "is-pending" },
  confirmed: { key: "st_confirmed", cls: "is-ok" },
  paid: { key: "st_paid", cls: "is-ok" },
  completed: { key: "st_completed", cls: "is-done" },
  cancelled: { key: "st_cancelled", cls: "is-bad" },
};

function ReservationCard({ r, t, nf, dateFmt }) {
  const [open, setOpen] = useState(false);
  const hotels = jparse(r.hotels, []);
  const participants = jparse(r.participants, []).filter((p) => p?.fullName);
  const payments = jparse(r.payments, []);
  const paid = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const st = STATUS[r.status] || STATUS.pending;

  return (
    <article className={`mk-pf-card ${open ? "is-open" : ""}`}>
      <button className="mk-pf-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="mk-pf-card-main">
          <h3>{r.packageTitle || "—"}</h3>
          <div className="mk-pf-card-meta">
            {r.ref && <span className="mk-pf-ref">{r.ref}</span>}
            <span>{r.dateFrom} → {r.dateTo}</span>
            <span>{r.totalPax} {t("bk_travelers")}</span>
            {r.$createdAt && <span>{t("pf_booked_on")} {dateFmt.format(new Date(r.$createdAt))}</span>}
          </div>
        </div>
        <div className="mk-pf-card-side">
          <b className="mk-pf-total">{nf.format(r.totalEstimate || 0)} DH</b>
          <span className={`mk-pf-badge ${st.cls}`}>{t(st.key)}</span>
        </div>
        <svg className="mk-pf-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div className="mk-pf-card-body">
          {hotels.length > 0 && (
            <div className="mk-pf-block">
              <em>{t("pf_hotels")}</em>
              {hotels.map((h, i) => (
                <div key={i} className="mk-pf-line">
                  <span>{h.name} — {(h.rooms || []).map((rm) => `${rm.qty}× ${rm.type}`).join(" · ")}</span>
                  <b>{nf.format(h.subtotal || 0)} DH</b>
                </div>
              ))}
            </div>
          )}
          {participants.length > 0 && (
            <div className="mk-pf-block">
              <em>{t("pf_participants")}</em>
              <div className="mk-pf-tags">
                {participants.map((p, i) => <span key={i}>{p.fullName}</span>)}
              </div>
            </div>
          )}
          {Array.isArray(r.supplements) && r.supplements.length > 0 && (
            <div className="mk-pf-block">
              <em>{t("pf_supplements")}</em>
              <div className="mk-pf-tags">
                {r.supplements.map((s2, i) => <span key={i}>{typeof s2 === "string" ? s2 : s2.label}</span>)}
              </div>
            </div>
          )}
          {payments.length > 0 && (
            <div className="mk-pf-block">
              <em>{t("pf_payments")}</em>
              <div className="mk-pf-line">
                <span>{nf.format(paid)} DH {t("pf_paid")}</span>
                <b>{nf.format(Math.max(0, (r.totalEstimate || 0) - paid))} DH {t("pf_remaining")}</b>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading, loginWithGoogle, logout } = useAuth();
  const { reservations, fetchMyReservations, loading } = useReservation();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => (window.location.hash === "#profil" ? "profile" : "res"));

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA");
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    [locale]
  );

  useEffect(() => {
    if (user) fetchMyReservations().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const firstName = (user?.name || user?.email || "").split(/[ @]/)[0];

  return (
    <div className="mk">
      <Header />
      <main style={{ minHeight: "72vh" }}>
        <div className="mk-wrap mk-page-head" style={{ paddingBottom: 34 }}>
          <Reveal as="span" className="mk-eyebrow">{t("pf_eyebrow")}</Reveal>
          <h1 className="mk-h2" style={{ marginTop: 16 }}>
            {user ? `${t("pf_title")}, ${firstName}` : t("bk_auth_t")}
          </h1>
        </div>

        <div className="mk-wrap" style={{ paddingBottom: 110 }}>
          {authLoading ? null : !user ? (
            <div className="mk-pf-gate">
              <p className="mk-lead">{t("bk_auth_d")}</p>
              <button className="mk-btn" onClick={loginWithGoogle}>{t("bk_auth_google")}</button>
            </div>
          ) : (
            <>
              <div className="mk-pf-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "res"} className={tab === "res" ? "is-active" : ""} onClick={() => setTab("res")}>
                  {t("pf_tab_res")}{reservations.length ? ` (${reservations.length})` : ""}
                </button>
                <button role="tab" aria-selected={tab === "profile"} className={tab === "profile" ? "is-active" : ""} onClick={() => setTab("profile")}>
                  {t("pf_tab_profile")}
                </button>
              </div>

              {tab === "res" ? (
                loading && !reservations.length ? (
                  <p className="mk-bk-muted">…</p>
                ) : reservations.length === 0 ? (
                  <div className="mk-sr-empty">
                    <p className="mk-quote" style={{ fontSize: 26 }}>{t("pf_empty_t")}</p>
                    <p style={{ color: "var(--ink-2)", margin: "10px 0 22px" }}>{t("pf_empty_d")}</p>
                    <button className="mk-btn mk-btn--sm" onClick={() => navigate("/search")}>{t("pf_browse")}</button>
                  </div>
                ) : (
                  <div className="mk-pf-list">
                    {reservations.map((r) => (
                      <ReservationCard key={r.$id} r={r} t={t} nf={nf} dateFmt={dateFmt} />
                    ))}
                  </div>
                )
              ) : (
                <div className="mk-pf-profile">
                  <div className="mk-pf-idrow">
                    <span className="mk-pf-avatar">{firstName.charAt(0).toUpperCase()}</span>
                    <div>
                      <b>{user?.name || "—"}</b>
                      <span>{user?.email}</span>
                    </div>
                  </div>
                  <dl className="mk-pf-facts">
                    <div><dt>{t("pf_name")}</dt><dd>{user?.name || "—"}</dd></div>
                    <div><dt>{t("pf_email")}</dt><dd>{user?.email}</dd></div>
                    {user?.$createdAt && (
                      <div><dt>{t("pf_member_since")}</dt><dd>{dateFmt.format(new Date(user.$createdAt))}</dd></div>
                    )}
                  </dl>
                  <div className="mk-pf-actions">
                    <button className="mk-btn mk-btn--sm mk-btn--ghost" onClick={() => logout().then(() => { window.location.href = "/"; })}>
                      {t("pf_signout")}
                    </button>
                    <a className="mk-alink" href="/contact" onClick={(e) => { e.preventDefault(); navigate("/contact"); }}>
                      {t("pf_help")}
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
