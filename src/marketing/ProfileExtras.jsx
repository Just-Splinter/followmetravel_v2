// Espace client — pour une réservation : validation de la fiche (ou
// annulation), échéancier, voyageurs (le client complète ses passeports) et
// documents PDF : fiche de réservation, facture, conditions de vente.
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import db, { Collections } from "../services/database";
import { documentUrl, getReservationFinance, validateReservation } from "../services/operations";
import { CIVILITIES, parseTravelers, passportIssue } from "../services/travelers";
import { useAgency } from "../services/useAgency";
import { useLocale } from "./i18n";

const frDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

/** Documents du client (mêmes règles que l'API) : fiche, facture, conditions de vente (+ vouchers une fois payé). */
function documentsFor(r, t) {
  const settled = ["paid", "completed"].includes(r.status);
  return [
    { type: "reservation", label: t("pf_doc_fiche") },
    { type: "facture", label: r.invoiceNumber ? `${t("pf_doc_facture")} ${r.invoiceNumber}` : t("pf_doc_facture") },
    { type: "cgv", label: t("pf_doc_cgv") },
    settled && { type: "voucher", label: "Vouchers hôtel" },
  ].filter(Boolean);
}

/** Validation de la fiche par le client (acceptation des conditions), ou rappel pour annuler. */
function Validation({ r, onUpdated }) {
  const { t } = useLocale();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  if (r.clientValidatedAt) {
    return (
      <div className="mk-pf-block mk-pf-ok">
        <em>✓ {t("pf_validated")} {frDate(String(r.clientValidatedAt).slice(0, 10))}</em>
      </div>
    );
  }
  if (!["pending", "confirmed"].includes(r.status)) return null;
  const validate = async () => {
    setBusy(true);
    try {
      const res = await validateReservation(r.$id);
      onUpdated({ ...r, clientValidatedAt: res.clientValidatedAt });
      toast.success(t("pf_validated"));
    } catch (e) {
      toast.error(e.message || t("pf_validate_err"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mk-pf-block mk-pf-validate">
      <em>{t("pf_validate_title")}</em>
      <p>{t("pf_validate_text")}</p>
      <div className="mk-pf-tags">
        <a href={documentUrl(r.$id, "reservation")} target="_blank" rel="noreferrer">📄 {t("pf_doc_fiche")}</a>
        <a href={documentUrl(r.$id, "cgv")} target="_blank" rel="noreferrer">📄 {t("pf_doc_cgv")}</a>
      </div>
      <label className="mk-pf-check">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{t("pf_validate_accept")}</span>
      </label>
      <button className="mk-btn mk-btn--sm" disabled={!accepted || busy} onClick={validate}>
        {busy ? "…" : t("pf_validate_btn")}
      </button>
    </div>
  );
}

function Travelers({ r, onUpdated }) {
  const months = Number(useAgency().passportValidityMonths) || 0;
  const pax = Number(r.totalPax) || 1;
  const travelers = parseTravelers(r.participants);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const open = ["pending", "confirmed"].includes(r.status);
  const issues = travelers.map((t) => passportIssue(t, r.travelEnd, months)).filter(Boolean).length + Math.max(0, pax - travelers.filter((t) => t.fullName).length);

  const start = () => {
    const list = travelers.map((t) => ({ ...t }));
    while (list.length < pax) list.push({});
    setDraft(list.slice(0, pax));
    setEditing(true);
  };
  const set = (i, k, v) => setDraft((d) => d.map((t, n) => (n === i ? { ...t, [k]: v } : t)));
  const save = async () => {
    setSaving(true);
    try {
      const updated = await db.update(Collections.RESERVATIONS, r.$id, { participants: JSON.stringify(draft) });
      onUpdated(updated);
      setEditing(false);
      toast.success("Voyageurs enregistrés.");
    } catch (e) {
      toast.error(e.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mk-pf-block">
      <em>Voyageurs {issues > 0 && open && <span className="mk-pf-warn">· {issues} information(s) à compléter</span>}</em>
      {!editing ? (
        <>
          <div className="mk-pf-tags">
            {travelers.filter((t) => t.fullName).map((t, i) => {
              const issue = passportIssue(t, r.travelEnd, months);
              return <span key={i} title={issue || "Passeport OK"}>{issue ? "⚠ " : "✓ "}{[t.civility, t.fullName].filter(Boolean).join(" ")}</span>;
            })}
          </div>
          {open && <button type="button" className="mk-pf-link-btn" onClick={start}>Compléter / modifier les voyageurs et passeports</button>}
        </>
      ) : (
        <div className="mk-pf-travelers">
          {draft.map((t, i) => (
            <fieldset key={i} className="mk-bk-person">
              <legend>Voyageur {i + 1}</legend>
              <div className="mk-bk-fields">
                <select value={t.civility || ""} onChange={(e) => set(i, "civility", e.target.value)} aria-label="Civilité">
                  <option value="">Civilité</option>
                  {CIVILITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input placeholder="Nom complet (comme sur le passeport)" value={t.fullName || ""} onChange={(e) => set(i, "fullName", e.target.value)} />
                <label className="mk-bk-datefield">Date de naissance<input type="date" value={t.birthDate || ""} onChange={(e) => set(i, "birthDate", e.target.value)} /></label>
                <input placeholder="Nationalité" value={t.nationality || ""} onChange={(e) => set(i, "nationality", e.target.value)} />
                <input placeholder="N° de passeport" value={t.passportNumber || t.docNumber || ""} onChange={(e) => set(i, "passportNumber", e.target.value)} />
                <label className="mk-bk-datefield">Expiration du passeport<input type="date" value={t.passportExpiry || ""} onChange={(e) => set(i, "passportExpiry", e.target.value)} /></label>
              </div>
              {passportIssue(t, r.travelEnd, months) && t.passportNumber && <p className="mk-pf-warn">⚠ {passportIssue(t, r.travelEnd, months)}</p>}
            </fieldset>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="mk-btn mk-btn--sm" disabled={saving} onClick={save}>{saving ? "…" : "Enregistrer"}</button>
            <button type="button" className="mk-pf-link-btn" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservationExtras({ r, onUpdated }) {
  const { t } = useLocale();
  const [finance, setFinance] = useState(null);
  useEffect(() => {
    if (r.status === "cancelled") return;
    let alive = true;
    getReservationFinance(r.$id).then((f) => alive && setFinance(f)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [r.$id, r.status, r.payments]);

  const nf = new Intl.NumberFormat("fr-MA");
  return (
    <>
      <Validation r={r} onUpdated={onUpdated} />
      {finance && finance.remaining > 0 && (
        <div className="mk-pf-block">
          <em>Échéancier</em>
          {finance.installments.filter((i) => i.remaining > 0).map((i) => (
            <div key={i.id} className="mk-pf-line">
              <span>{i.label} — avant le {frDate(i.dueDate)}{i.status === "overdue" && <b className="mk-pf-warn"> (en retard)</b>}</span>
              <b>{nf.format(i.remaining)} DH</b>
            </div>
          ))}
        </div>
      )}
      <Travelers r={r} onUpdated={onUpdated} />
      <div className="mk-pf-block">
        <em>{t("pf_docs")}</em>
        <div className="mk-pf-tags">
          {documentsFor(r, t).map((d) => (
            <a key={d.type} href={documentUrl(r.$id, d.type)} target="_blank" rel="noreferrer">📄 {d.label}</a>
          ))}
        </div>
      </div>
    </>
  );
}
