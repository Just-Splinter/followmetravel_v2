import { useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import { DEFAULT_AGENCY, agencyDocumentAttrs, agencyFromPackages, agencyStats, cancellationLines, whatsappLink } from "../services/agency";

const inputStyle = {
  width: "100%", padding: "9px 11px", border: "1px solid #e2e8f0",
  borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff",
};
const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "#475569" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
const sectionTitle = { fontWeight: 700, fontSize: 14, margin: "26px 0 4px", color: "#0f172a" };
const hint = { fontSize: 12.5, color: "#64748b", margin: "0 0 12px" };

function Field({ label, children, wide }) {
  return <label style={{ ...labelStyle, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>{label}{children}</label>;
}

function StatsPreview({ stats }) {
  const items = [
    stats.years && `${stats.years} ans d'activité`,
    stats.travelers && `${stats.travelers.toLocaleString("fr-FR")} voyageurs accompagnés`,
    stats.destinations && `${stats.destinations} destinations`,
    stats.rating && `${stats.rating.toLocaleString("fr-FR")}/5 sur Google${stats.reviews ? ` (${stats.reviews} avis)` : ""}`,
  ].filter(Boolean);
  return (
    <p style={{ ...hint, marginTop: 10 }}>
      Aperçu : {items.length ? items.join(" · ") : "aucun chiffre — le bandeau est masqué sur le site."}
    </p>
  );
}

/**
 * Dashboard — Paramètres → Agence : coordonnées, mentions légales (factures,
 * contrats), WhatsApp, politique de paiement / relances, annulation, CGV.
 */
export default function AgencySettingsManager() {
  const { packages, packageActions } = useTravelData();
  const existing = useMemo(() => agencyFromPackages(packages), [packages]);
  const [form, setForm] = useState(() => ({ ...DEFAULT_AGENCY, ...existing }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const text = (key, props = {}) => <input style={inputStyle} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} {...props} />;
  const num = (key, props = {}) => (
    <input style={inputStyle} type="number" min="0" value={form[key] ?? ""} onChange={(e) => set(key, e.target.value === "" ? "" : Number(e.target.value))} {...props} />
  );

  const tiers = form.cancellationPolicy?.length ? form.cancellationPolicy : DEFAULT_AGENCY.cancellationPolicy;
  const setTier = (i, key, value) => set("cancellationPolicy", tiers.map((t, n) => (n === i ? { ...t, [key]: Number(value) || 0 } : t)));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const $id = form.$id;
      const info = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "$id" && k !== "kind"));
      const attrs = agencyDocumentAttrs({
        ...info,
        phones: (Array.isArray(info.phones) ? info.phones : String(info.phones || "").split(",")).map((p) => p.trim()).filter(Boolean),
        trustBadges: (Array.isArray(info.trustBadges) ? info.trustBadges : String(info.trustBadges || "").split("\n")).map((b) => b.trim()).filter(Boolean),
      });
      if ($id) await packageActions.update($id, attrs);
      else await packageActions.create(attrs);
      setSaved(true);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const wa = whatsappLink(form, "Bonjour, test du lien WhatsApp du site.");

  return (
    <div className="cms-table-card" style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Fiche agence</div>
      <p style={hint}>
        Utilisée partout : bouton WhatsApp et pied de page du site, page CGV, en-têtes et mentions légales des devis, contrats, factures et vouchers, échéanciers et relances de paiement.
      </p>

      <div style={sectionTitle}>Lancement du site</div>
      <p style={hint}>
        Avant l'ouverture : les visiteurs ne voient qu'une page « Bientôt en ligne » (compte à rebours, inscription pour être prévenu, contacts).
        L'équipe connectée voit le site complet ; pour le montrer à un testeur sans compte, ajoutez <code>?apercu</code> à l'adresse du site.
      </p>
      <div style={grid}>
        <Field label="Page « Bientôt en ligne »">
          <select style={inputStyle} value={form.comingSoon ? "1" : "0"} onChange={(e) => set("comingSoon", e.target.value === "1")}>
            <option value="0">Désactivée — site ouvert au public</option>
            <option value="1">Activée — les visiteurs voient la page d'attente</option>
          </select>
        </Field>
        <Field label="Date de lancement (compte à rebours, optionnel)">{text("launchDate", { type: "date" })}</Field>
        <Field label="Titre (vide : « Le voyage commence bientôt. »)" wide>{text("comingSoonTitle", { placeholder: "Le voyage commence bientôt." })}</Field>
        <Field label="Message (vide : texte par défaut, traduit EN / AR)" wide>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.comingSoonMessage || ""} onChange={(e) => set("comingSoonMessage", e.target.value)} />
        </Field>
      </div>
      <p className={`cms-status-bar ${form.comingSoon ? "" : "info"}`} style={{ marginTop: 10 }}>
        {form.comingSoon ? "⚠ Le site public est fermé aux visiteurs tant que cette option est activée. " : ""}
        <a href="/?attente" target="_blank" rel="noreferrer">Aperçu de la page d'attente</a>
        {" · "}
        <a href="/?apercu" target="_blank" rel="noreferrer">Revenir au site complet</a>
      </p>

      <div style={sectionTitle}>Coordonnées</div>
      <div style={grid}>
        <Field label="Nom commercial">{text("tradeName")}</Field>
        <Field label="Raison sociale">{text("legalName", { placeholder: "FOLLOW ME TRAVEL SARL" })}</Field>
        <Field label="Adresse">{text("address")}</Field>
        <Field label="Ville">{text("city")}</Field>
        <Field label="Téléphones (séparés par des virgules)">
          <input style={inputStyle} value={Array.isArray(form.phones) ? form.phones.join(", ") : form.phones || ""} onChange={(e) => set("phones", e.target.value)} />
        </Field>
        <Field label="WhatsApp (avec indicatif)">
          {text("whatsapp", { placeholder: "+212 6 64 58 64 25" })}
          {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 500 }}>Tester le lien WhatsApp</a>}
        </Field>
        <Field label="Email">{text("email")}</Field>
        <Field label="Site web">{text("website")}</Field>
      </div>

      <div style={sectionTitle}>Mentions légales</div>
      <p style={hint}>Obligatoires sur les factures et contrats. Elles apparaissent en pied de page de chaque document PDF.</p>
      <div style={grid}>
        <Field label="N° de licence d'agence de voyages">{text("licenceNumber")}</Field>
        <Field label="ICE">{text("ice")}</Field>
        <Field label="Registre de commerce (RC)">{text("rc")}</Field>
        <Field label="Identifiant fiscal (IF)">{text("taxId")}</Field>
        <Field label="Patente">{text("patente")}</Field>
        <Field label="Capital social">{text("capital", { placeholder: "100 000 DH" })}</Field>
        <Field label="Banque">{text("bankName")}</Field>
        <Field label="RIB (virements clients)">{text("rib")}</Field>
        <Field label="Mention fiscale en bas de facture" wide>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.invoiceMention || ""} onChange={(e) => set("invoiceMention", e.target.value)} placeholder="À faire valider par votre comptable" />
        </Field>
      </div>

      <div style={sectionTitle}>Paiement & relances</div>
      <p style={hint}>
        Échéancier par défaut de chaque dossier : acompte {form.depositPercent || 0} % sous {form.depositDueDays || 0} jours, solde {form.balanceDaysBeforeDeparture || 0} jours avant le départ (modifiable dossier par dossier).
        Rappel automatique {form.reminderDaysBefore || 0} jours avant chaque échéance, puis en cas de retard tous les {form.overdueReminderEveryDays || 0} jours ({form.maxOverdueReminders || 0} relances au plus).
      </p>
      <div style={grid}>
        <Field label="Acompte (%)">{num("depositPercent", { max: 100 })}</Field>
        <Field label="Acompte à régler sous (jours)">{num("depositDueDays")}</Field>
        <Field label="Solde exigé avant le départ (jours)">{num("balanceDaysBeforeDeparture")}</Field>
        <Field label="Rappel avant échéance (jours)">{num("reminderDaysBefore")}</Field>
        <Field label="Relance en retard tous les (jours)">{num("overdueReminderEveryDays", { min: 1 })}</Field>
        <Field label="Nombre max. de relances de retard">{num("maxOverdueReminders")}</Field>
      </div>

      <div style={sectionTitle}>Conditions d'annulation (par défaut)</div>
      <p style={hint}>Frais retenus selon le délai avant le départ. Un package peut avoir ses propres conditions (éditeur de package).</p>
      {tiers.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, width: 70 }}>À partir de</span>
          <input style={{ ...inputStyle, width: 90 }} type="number" min="0" value={t.daysBefore} onChange={(e) => setTier(i, "daysBefore", e.target.value)} />
          <span style={{ fontSize: 13 }}>jours avant : frais de</span>
          <input style={{ ...inputStyle, width: 90 }} type="number" min="0" max="100" value={t.feePercent} onChange={(e) => setTier(i, "feePercent", e.target.value)} />
          <span style={{ fontSize: 13 }}>%</span>
          <button className="em-btn-secondary" onClick={() => set("cancellationPolicy", tiers.filter((_, n) => n !== i))}>Retirer</button>
        </div>
      ))}
      <button className="em-btn-secondary" onClick={() => set("cancellationPolicy", [...tiers, { daysBefore: 0, feePercent: 100 }])}>+ Ajouter un palier</button>
      <ul style={{ fontSize: 12.5, color: "#475569", marginTop: 10 }}>
        {cancellationLines(tiers).map((l) => <li key={l}>{l}</li>)}
      </ul>

      <div style={sectionTitle}>Voyageurs & fiche de réservation</div>
      <p style={hint}>
        Contrôle des passeports à la réservation (site et dashboard) et valeurs par défaut de la fiche de réservation envoyée au client — modifiables dossier par dossier.
      </p>
      <div style={grid}>
        <Field label="Passeport valable au moins (mois après le retour, 0 = pas de contrôle)">{num("passportValidityMonths", { max: 24 })}</Field>
        <Field label="Réservation remboursable (par défaut)">
          <select style={inputStyle} value={form.refundable ? "1" : "0"} onChange={(e) => set("refundable", e.target.value === "1")}>
            <option value="0">Non</option>
            <option value="1">Oui, selon les conditions d'annulation</option>
          </select>
        </Field>
        <Field label="Réservation modifiable (par défaut)">
          <select style={inputStyle} value={form.modifiable ? "1" : "0"} onChange={(e) => set("modifiable", e.target.value === "1")}>
            <option value="0">Non</option>
            <option value="1">Oui</option>
          </select>
        </Field>
        <Field label="Mention « N.B. » en bas de la fiche de réservation" wide>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.reservationNote || ""} onChange={(e) => set("reservationNote", e.target.value)} />
        </Field>
      </div>

      <div style={sectionTitle}>Chiffres affichés sur le site</div>
      <p style={hint}>
        Bandeau de chiffres de la page d'accueil. Ne renseignez que des chiffres vérifiables : un champ vide n'est pas affiché.
      </p>
      <div style={grid}>
        <Field label="Année de création (→ années d'activité)">{num("foundedYear", { min: 1950, max: new Date().getFullYear(), placeholder: "2014" })}</Field>
        <Field label="Voyageurs accompagnés">{num("travelersCount", { placeholder: "18000" })}</Field>
        <Field label="Destinations proposées">{num("destinationsCount", { placeholder: "40" })}</Field>
        <Field label="Note Google (sur 5)">{num("googleRating", { step: "0.1", max: 5, placeholder: "4.8" })}</Field>
        <Field label="Nombre d'avis Google">{num("googleReviewsCount", { placeholder: "350" })}</Field>
        <Field label="Lien vers les avis Google">{text("googleReviewsUrl", { placeholder: "https://g.page/r/…" })}</Field>
      </div>
      <StatsPreview stats={agencyStats(form)} />

      <div style={sectionTitle}>Confiance & CGV</div>
      <div style={grid}>
        <Field label="Badges de confiance (un par ligne, affichés sur les fiches voyage)" wide>
          <textarea
            style={{ ...inputStyle, minHeight: 90 }}
            value={Array.isArray(form.trustBadges) ? form.trustBadges.join("\n") : form.trustBadges || ""}
            onChange={(e) => set("trustBadges", e.target.value)}
          />
        </Field>
        <Field label="Conditions générales de vente (Markdown) — vide : texte par défaut du site" wide>
          <textarea style={{ ...inputStyle, minHeight: 200, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }} value={form.cgvText || ""} onChange={(e) => set("cgvText", e.target.value)} placeholder={"## 1. Objet\nLes présentes conditions…"} />
        </Field>
      </div>

      {err && <p className="cms-status-bar error" style={{ marginTop: 14 }}>⚠ {err}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 18 }}>
        {saved && <span style={{ fontSize: 13, color: "#16a34a" }}>✓ Fiche agence enregistrée</span>}
        <button className="em-primary-btn" onClick={save} disabled={saving}>
          {saving ? "⏳ Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
