import { useRef, useState } from "react";
import { Modal } from "../components/UI";
import { usePackages } from "../context/PackagesContext";
import { useTravelData } from "../context/TravelDataContext";
import { toast } from "react-toastify";
import {
  pdfIngestConfigured,
  extractPdfContent,
  analyzePdf,
  buildPackageData,
  diffTaxonomy,
  taxonomyCreatePayload,
} from "../services/pdfIngest";

// ── Constants ─────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon", bg: "#fef9c3", text: "#854d0e", dot: "#ca8a04" },
  { value: "published", label: "Publié", bg: "#dcfce7", text: "#166534", dot: "#16a34a" },
  { value: "active", label: "Actif", bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  { value: "archived", label: "Archivé", bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
];

const CATEGORY_OPTIONS = [
  { value: "destinations", label: "Destinations", icon: "ti-map-pin" },
  { value: "tours", label: "Tours", icon: "ti-route" },
  { value: "adventures", label: "Adventures", icon: "ti-mountain" },
];

const COUNTRY_OPTIONS = [
  "Maroc", "France", "Espagne", "Italie", "Turquie",
  "Égypte", "Thaïlande", "Émirats Arabes Unis", "Portugal", "Grèce",
  "Maldives", "Japon", "Indonésie", "Mexique", "États-Unis",
];

const CONTINENTS = ["Europe", "Asie", "Afrique", "Amériques", "Océanie"];


const defaultPackage = {
  id: 1,
  agency1: "Asfari Voyage", agency1Sub: "Agence de voyage et tourisme",
  agency2: "Follow Me Travel", agency2Sub: "www.followmetravel.ma",
  durationLabel: "Séjour de luxe · 08 Jours / 07 Nuits",
  destination: "ISTAN", destinationAccent: "BUL",
  subtitleItalic: "Summer Holiday",
  tagline: "L'expérience signature de la Turquie",
  periodLabel: "MAI – JUIN 2026",
  basePrice: "7690", currency: "DH", priceFromLabel: "À partir de",
  heroBg: null,
  gallery: [],

  // ── Dynamic sections (replaces includes/options) ──
  sections: [
    {
      id: 1,
      title: "Offre comprend",
      icon: "🧳",
      items: [
        { id: 1, icon: "✈️", text: "Billet A/R avec Royal Air Maroc" },
        { id: 2, icon: "🛏️", text: "Logement 08J/07N en petit déjeuner" },
        { id: 3, icon: "🚗", text: "Transfert Aéroport – Hôtel – Aéroport" },
        { id: 4, icon: "🏔️", text: "Excursions Shila Agva" },
        { id: 5, icon: "🌲", text: "Excursions Sapanca" },
        { id: 6, icon: "🎧", text: "Assistance durant le voyage" },
      ],
    },
    {
      id: 2,
      title: "En option",
      icon: "⭐",
      badge: "Pack Excursions : 800 DH / pers.",
      items: [
        { id: 1, icon: "🚢", text: "Îles des Princes – Büyükada avec déjeuner" },
        { id: 2, icon: "🚌", text: "Excursion Bursa" },
        { id: 3, icon: "🛍️", text: "City Tour & Shopping Day" },
      ],
    },
  ],

  tabs: [
    { id: "itinerary", label: "Itinéraire" },
    { id: "gallery", label: "Galerie" },
    { id: "hotels", label: "Hôtels & Tarifs" },
    { id: "dates", label: "Dates" },
  ],
  itineraryTitle: "Istanbul & Bursa",
  days: [
    { id: 1, num: "01", title: "Casablanca → Istanbul", badge: "", theme: "Arrivée & Installation", image: null, activities: [{ id: 1, label: "Vol de Casablanca", optional: false }, { id: 2, label: "Accueil à l'aéroport", optional: false }, { id: 3, label: "Transfert hôtel", optional: false }] },
    { id: 2, num: "02", title: "Sapanca & Maşukiye", badge: "Incluse", theme: "Nature & Expériences", image: null, activities: [{ id: 1, label: "Lac Sapanca", optional: false }, { id: 2, label: "Cascades Maşukiye", optional: false }, { id: 3, label: "Quad / Tyrolienne", optional: true }] },
    { id: 3, num: "03", title: "Îles des Princes", badge: "Optionnelle", theme: "Évasion & Calme", image: null, activities: [{ id: 1, label: "Croisière Büyükada", optional: true }, { id: 2, label: "Maisons historiques", optional: false }] },
    { id: 4, num: "04", title: "Bursa", badge: "Optionnelle", theme: "Histoire & Montagne", image: null, activities: [{ id: 1, label: "Traversée du Bosphore", optional: false }, { id: 2, label: "Téléphérique Uludağ", optional: true }] },
    { id: 5, num: "05", title: "Istanbul Libre", badge: "", theme: "Exploration à votre rythme", image: null, activities: [{ id: 1, label: "Shopping centres", optional: false }, { id: 2, label: "Visites culturelles", optional: false }] },
    { id: 6, num: "06", title: "Bosphore by Night", badge: "Optionnelle", theme: "Dîner & Spectacle", image: null, activities: [{ id: 1, label: "Croisière dîner", optional: true }, { id: 2, label: "Vue nocturne", optional: false }] },
    { id: 7, num: "07", title: "Journée libre", badge: "", theme: "Détente & Plaisir", image: null, activities: [{ id: 1, label: "Shopping libre", optional: false }] },
    { id: 8, num: "08", title: "Istanbul → Casablanca", badge: "", theme: "Fin du séjour", image: null, activities: [{ id: 1, label: "Transfert aéroport", optional: false }, { id: 2, label: "Vol retour", optional: false }] },
  ],
  // Empty on purpose — the old shape here (a flat "hotels" list of real-
  // looking Istanbul hotels/prices) shipped as placeholder content on every
  // new package, and stuck around silently on any package whose admin never
  // opened the Hôtels & Formules tab. hotelCategories is the shape the
  // current package editor actually reads/writes (see HotelsEditor in
  // PackageeditorPage.jsx) — one entry per formule, added from the editor.
  hotelCategories: [],
  departureDates: [
    { id: 1, from: "30/05", to: "06/06" }, { id: 2, from: "03/06", to: "10/06" },
    { id: 3, from: "06/06", to: "13/06" }, { id: 4, from: "10/06", to: "17/06" },
    { id: 5, from: "14/06", to: "21/06" }, { id: 6, from: "17/06", to: "24/06" },
  ],
  ctaLabel: "Réserver maintenant", phone1: "0664 586 425", phone2: "0608 800 854", website: "www.followmetravel.ma",
};

const EMPTY_FORM = {
  title: "",
  status: "draft",
  category: "destinations",
  country: "",
  continent : "",
  destinations: "",
  tours: "",
  adventures: "",
  basePrice: "",
  data: JSON.stringify(defaultPackage)
};

// ── PDF import (Track 1b) ─────────────────────────────────────────────
const IMPORT_STAGES = [
  { key: "extract", label: "Extraction du texte…" },
  { key: "analyze", label: "Analyse par IA…" },
  { key: "apply", label: "Préparation du package…" },
];

function PdfImportSection({ importer }) {
  const inputRef = useRef(null);
  const { state, startImport, approveItem, applyImport, reset } = importer;

  if (!pdfIngestConfigured()) return null;

  const stageIdx = IMPORT_STAGES.findIndex(s => s.key === state.stage);
  const pendingCount = state.missing.filter(m => !m.approved).length;

  return (
    <div style={SI.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) startImport(file);
          e.target.value = "";
        }}
      />

      {state.stage === "idle" && (
        <button style={SI.importBtn} onClick={() => inputRef.current?.click()}>
          <i className="ti ti-file-type-pdf" style={{ fontSize: 16 }} />
          Importer depuis un PDF
          <span style={SI.importHint}>Le formulaire sera pré-rempli automatiquement</span>
        </button>
      )}

      {(state.stage === "extract" || state.stage === "analyze" || state.stage === "apply") && (
        <div style={SI.progressBox}>
          <div style={SI.fileName}>
            <i className="ti ti-file-type-pdf" style={{ fontSize: 14, color: C.orange }} />
            {state.fileName}
          </div>
          {IMPORT_STAGES.map((s, i) => (
            <div key={s.key} style={{ ...SI.stageRow, opacity: i > stageIdx ? 0.4 : 1 }}>
              {i < stageIdx ? (
                <i className="ti ti-circle-check" style={{ fontSize: 14, color: "#16a34a" }} />
              ) : i === stageIdx ? (
                <span style={SI.spinner} />
              ) : (
                <i className="ti ti-circle" style={{ fontSize: 14, color: "var(--color-text-tertiary)" }} />
              )}
              <span style={{ fontSize: 12 }}>{s.label}</span>
              {i === stageIdx && s.key === "analyze" && (
                <span style={SI.stageNote}>
                  {state.scanned ? "brochure scannée — lecture des pages…" : "une seule requête IA"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {state.stage === "checklist" && (
        <div style={SI.progressBox}>
          <div style={SI.checklistTitle}>
            <i className="ti ti-list-check" style={{ fontSize: 14, color: C.orange }} />
            Nouveaux éléments à créer
          </div>
          <div style={SI.checklistHint}>
            Ces valeurs du PDF n'existent pas encore. Approuvez-les pour les créer,
            ou ignorez-les.
          </div>
          {state.missing.map((m, i) => (
            <div key={`${m.type}-${m.name}`} style={SI.checkRow}>
              <span style={{ fontSize: 12, flex: 1 }}>
                <strong>{m.typeLabel}</strong> : {m.name}
              </span>
              {m.approved ? (
                <span style={SI.approvedTag}>
                  <i className="ti ti-check" style={{ fontSize: 12 }} /> {m.created ? "Créé" : "Approuvé"}
                </span>
              ) : m.creating ? (
                <span style={{ ...SI.approvedTag, color: "var(--color-text-tertiary)" }}>Création…</span>
              ) : (
                <button style={SI.approveBtn} onClick={() => approveItem(i)}>Approuver</button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={SI.cancelSmall} onClick={reset}>Annuler l'import</button>
            <button style={SI.applyBtn} onClick={applyImport}>
              {pendingCount > 0 ? `Continuer sans les ${pendingCount} restant(s)` : "Continuer"}
            </button>
          </div>
        </div>
      )}

      {state.stage === "done" && (
        <div style={{ ...SI.progressBox, borderColor: "rgba(22,163,74,.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
            <i className="ti ti-circle-check" style={{ fontSize: 15 }} />
            PDF importé — vérifiez les champs puis cliquez sur Enregistrer.
          </div>
          <div style={SI.doneStats}>{state.summary}</div>
          <button style={SI.cancelSmall} onClick={reset}>Annuler l'import</button>
        </div>
      )}

      {state.stage === "error" && (
        <div style={{ ...SI.progressBox, borderColor: "rgba(239,68,68,.4)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#dc2626" }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 15, marginTop: 1 }} />
            <span>{state.error}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>
            Vous pouvez réessayer ou continuer la création manuelle ci-dessous.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={SI.approveBtn} onClick={() => inputRef.current?.click()}>Réessayer</button>
            <button style={SI.cancelSmall} onClick={reset}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function CreatePackageModal({ pkg, onClose, onCreated }) {
  const { createPackage, updatePackage } = usePackages();
  const [form, setForm] = useState(pkg || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const travelData = useTravelData();
  const { tours, adventures, destinations } = travelData;

  // ── PDF import state ──
  const [importState, setImportState] = useState({ stage: "idle", missing: [] });
  const [importedData, setImportedData] = useState(null); // full editor blob from the PDF
  const [extraOptions, setExtraOptions] = useState({ country: [], continent: [] });
  const importRef = useRef({});

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: false }));
  };

  const patchImport = (patch) => setImportState(s => ({ ...s, ...patch }));

  const startImport = async (file) => {
    setImportedData(null);
    setImportState({ stage: "extract", missing: [], fileName: file.name, scanned: false });
    try {
      const content = await extractPdfContent(file);
      patchImport({ stage: "analyze", scanned: content.images.length > 0 });
      const llm = await analyzePdf(content);
      patchImport({ stage: "apply" });
      const data = buildPackageData(llm, { title: llm.basic?.title });
      const { matches, missing } = diffTaxonomy(llm.basic || {}, {
        countryOptions: COUNTRY_OPTIONS,
        continents: CONTINENTS,
        destinations, tours, adventures,
      });
      importRef.current = { llm, data, matches };
      if (missing.length) {
        patchImport({ stage: "checklist", missing: missing.map(m => ({ ...m })) });
      } else {
        finishImport([]);
      }
    } catch (err) {
      console.error("[pdfImport]", err);
      patchImport({ stage: "error", error: err?.message || "Erreur lors de l'import du PDF." });
    }
  };

  // Approve one checklist item: create the taxonomy doc via the existing
  // context actions (country/continent have no collection — approval simply
  // accepts the new value into the select options).
  const approveItem = async (idx) => {
    const item = importState.missing[idx];
    if (!item || item.approved || item.creating) return;
    const mark = (patch) =>
      setImportState(s => ({
        ...s,
        missing: s.missing.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
      }));
    if (item.type === "country" || item.type === "continent") {
      setExtraOptions(o => ({ ...o, [item.type]: [...o[item.type], item.name] }));
      importRef.current.matches[item.type] = item.name;
      mark({ approved: true });
      return;
    }
    const actions = {
      destinations: travelData.destinationActions,
      tours: travelData.tourActions,
      adventures: travelData.adventureActions,
    }[item.type];
    try {
      mark({ creating: true });
      const doc = await actions.create(taxonomyCreatePayload(item.type, item.name));
      const idKey = { destinations: "destinationId", tours: "tourId", adventures: "adventureId" }[item.type];
      if (!importRef.current.matches[idKey]) importRef.current.matches[idKey] = doc.$id;
      mark({ approved: true, creating: false, created: true });
    } catch (err) {
      console.error("[pdfImport] création taxonomie", err);
      mark({ creating: false });
      toast.error(`Création impossible (${item.typeLabel} : ${item.name}) — ${err.message}`);
    }
  };

  // Prefill the form from the import result — creation then goes through the
  // exact same handleSave/createPackage path as a manual package.
  const finishImport = () => {
    const { llm, data, matches } = importRef.current;
    const basic = llm.basic || {};
    setImportedData(data);
    setForm(f => ({
      ...f,
      title: basic.title || f.title,
      country: matches.country || f.country,
      continent: matches.continent || f.continent,
      destinations: matches.destinationId || f.destinations,
      tours: matches.tourId || f.tours,
      adventures: matches.adventureId || f.adventures,
      basePrice: basic.basePrice != null ? String(basic.basePrice) : f.basePrice,
    }));
    setErrors({});
    setImportState(s => ({
      ...s,
      stage: "done",
      summary:
        `${data.sections.length} section(s) · ${data.days.length} jour(s) · ` +
        `${data.hotelCategories.length} formule(s) hôtel · ` +
        `${data.departureDates.length} date(s) · ${data.suppliments.length} supplément(s)`,
    }));
    toast.success("PDF analysé — formulaire pré-rempli.");
  };

  const importer = {
    state: importState,
    startImport,
    approveItem,
    applyImport: finishImport,
    reset: () => {
      setImportState({ stage: "idle", missing: [] });
      setImportedData(null);
    },
  };

  // ── Validation ──
  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = true;
    if (!form.country) e.country = true;
    if (!form.continent) e.continent = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      defaultPackage.destination = form.title.trim();
      defaultPackage.destinationAccent = "";
      defaultPackage.basePrice = parseFloat(form.basePrice) || 0;
      // PDF import: same creation path, only the data blob is prefilled
      const dataBlob = importedData
        ? {
            ...importedData,
            destination: importedData.destination || form.title.trim().toUpperCase(),
            basePrice: parseFloat(form.basePrice) || importedData.basePrice || 0,
          }
        : defaultPackage;
      const payload = {
        title: form.title.trim(),
        category: form.category,
        status: form.status,
        country: form.country,
        continent: form.continent,
        tags: [],
        destinations: form.destinations,
        tours: form.tours,
        adventures: form.adventures,
        basePrice: parseFloat(form.basePrice) || 0,
        data: JSON.stringify(dataBlob),
      };
      if (pkg?.$id) {
        const result = await updatePackage(pkg.$id, {
          //...pkg,
          title: form.title.trim(),
          category: form.category,
          status: form.status,
          country: form.country,
          continent: form.continent,
          tags: [],
          destinations: form.destinations,
          tours: form.tours,
          adventures: form.adventures,
          basePrice: parseFloat(form.basePrice) || 0,
          data: undefined, // on ne met pas à jour la data lors de l'édition rapide, pour éviter d'écraser les changements faits dans l'éditeur complet
        });
        toast.success("Package mis à jour avec succès.");
        onCreated?.(result);
        onClose();
      } else {
        const result = await createPackage(payload);
        toast.success("Package créé avec succès.");
        onCreated?.(result);
        onClose();
      }

    } catch (err) {
      toast.error(err.message || "Une erreur est survenue lors de la création du package.");
      console.error("Erreur création:", err);
    } finally {
      setSaving(false);
    }
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === form.status) || STATUS_OPTIONS[0];

  return (
    <Modal onClose={onClose} width="560px">
      <div style={S.root}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.headerIcon}>
              <i className={`ti ${CATEGORY_OPTIONS.find(c => c.value === form.category)?.icon || "ti-package"}`}
                style={{ fontSize: 16, color: C.orange }} />
            </div>
            <div>
              <h2 style={S.headerTitle}>{pkg ? "Modifier" : "Créer"} package</h2>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>
            <i className="ti ti-x" style={{ fontSize: 15 }} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>

          {/* Import PDF (création uniquement) */}
          {!pkg && <PdfImportSection importer={importer} />}

          {/* Title */}
          <Field label="Titre *" error={errors.title} hint={errors.title ? "Ce champ est obligatoire" : null}>
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="ex: Séjour luxe à Istanbul 8J/7N"
              style={{ ...S.input, ...(errors.title ? S.inputError : {}) }}
            />
          </Field>
 {/* ── Prix de base ── */}
          <div style={S.row2}>
            <Field label="Statut">
              <div style={{ position: "relative" }}>
                <select
                  value={form.status}
                  onChange={e => set("status", e.target.value)}
                  style={{ ...S.input, paddingLeft: 30, appearance: "none", cursor: "pointer" }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: currentStatus.dot, pointerEvents: "none" }} />
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>
            <Field label="Prix de base (DH)">
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.basePrice}
                  onChange={e => set("basePrice", e.target.value)}
                  placeholder="ex: 7690"
                  style={{ ...S.input, paddingRight: 36 }}
                />
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, fontWeight: 600, color: "var(--color-text-tertiary)",
                  pointerEvents: "none",
                }}>DH</span>
              </div>
            </Field>
          </div>


          {/* Status + Country side by side */}
          <div style={S.row2}>


            <Field label="Continent *" error={errors.continent} hint={errors.continent ? "Obligatoire" : null}>
              <div style={{ position: "relative" }}>
                <select
                  value={form.continent}
                  onChange={e => set("continent", e.target.value)}
                  style={{ ...S.input, appearance: "none", paddingRight: 28, cursor: "pointer", ...(errors.continent ? S.inputError : {}) }}
                >
                  <option value="">Sélectionner…</option>
                  {[...CONTINENTS, ...extraOptions.continent].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>

            <Field label="Pays *" error={errors.country} hint={errors.country ? "Obligatoire" : null}>
              <div style={{ position: "relative" }}>
                <select
                  value={form.country}
                  onChange={e => set("country", e.target.value)}
                  style={{ ...S.input, appearance: "none", paddingRight: 28, cursor: "pointer", ...(errors.country ? S.inputError : {}) }}
                >
                  <option value="">Sélectionner…</option>
                  {[...COUNTRY_OPTIONS, ...extraOptions.country].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>

          </div>

          {/* ── 3 Selects : Destinations / Tours / Adventures ── */}
          <div style={S.row3}>

            <Field label="Destinations">
              <div style={{ position: "relative" }}>
                <select
                  value={form.destinations}
                  onChange={e => set("destinations", e.target.value)}
                  style={{ ...S.input, appearance: "none", paddingRight: 28, cursor: "pointer" }}
                >
                  <option value="">Sélectionner…</option>
                  {destinations.map(o => (
                    <option key={o.$id} value={o.$id}>{o.name}</option>
                  ))}
                </select>
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>

            <Field label="Tours">
              <div style={{ position: "relative" }}>
                <select
                  value={form.tours}
                  onChange={e => set("tours", e.target.value)}
                  style={{ ...S.input, appearance: "none", paddingRight: 28, cursor: "pointer" }}
                >
                  <option key={'empty'} value={""}>Sélectionner un tour...</option>
                  {tours.map(o => (
                    <option key={o.$id} value={o.$id}>{o.name}</option>
                  ))}
                </select>
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>

            <Field label="Adventures">
              <div style={{ position: "relative" }}>
                <select
                  value={form.adventures}
                  onChange={e => set("adventures", e.target.value)}
                  style={{ ...S.input, appearance: "none", paddingRight: 28, cursor: "pointer" }}
                >
                  <option value="">Sélectionner…</option>
                  {adventures.map(o => (
                    <option key={o.$id} value={o.$id}>{o.name}</option>
                  ))}
                </select>
                <i className="ti ti-chevron-down" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-tertiary)", pointerEvents: "none" }} />
              </div>
            </Field>

          </div>

         
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <span style={S.footerHint}>
            <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
            Les champs <span style={{ color: "#ef4444" }}>*</span> sont obligatoires
          </span>
          <button onClick={onClose} style={S.btnCancel}>Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...S.btnSave, opacity: saving ? 0.7 : 1 }}
          >
            <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

      </div>
    </Modal>
  );
}

// ── Field Wrapper ─────────────────────────────────────────────────────
function Field({ label, children, error, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: error ? "#ef4444" : "var(--color-text-secondary)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: error ? "#ef4444" : "var(--color-text-tertiary)", margin: 0 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Design Tokens ─────────────────────────────────────────────────────
const C = {
  orange: "rgb(255 117 14)",
  dark: "#1a1a2e",
  border: "var(--color-border-tertiary)",
  bgSec: "var(--color-background-secondary)",
  radius: "var(--border-radius-md)",
};

// ── PDF import styles ─────────────────────────────────────────────────
const SI = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 },
  importBtn: {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "10px 12px",
    borderRadius: C.radius,
    border: `1px dashed rgb(255 117 14 / 0.5)`,
    background: "rgb(255 117 14 / 0.05)",
    color: C.orange, fontSize: 13, fontWeight: 600,
    cursor: "pointer",
  },
  importHint: {
    marginLeft: "auto", fontSize: 11, fontWeight: 400,
    color: "var(--color-text-tertiary)",
  },
  progressBox: {
    display: "flex", flexDirection: "column", gap: 7,
    padding: "12px 14px",
    borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: C.bgSec,
  },
  fileName: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)",
    marginBottom: 2,
  },
  stageRow: { display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-secondary)" },
  stageNote: { fontSize: 10, color: "var(--color-text-tertiary)", fontStyle: "italic" },
  spinner: {
    width: 12, height: 12, borderRadius: "50%",
    border: `2px solid rgb(255 117 14 / 0.25)`,
    borderTopColor: C.orange,
    animation: "cpm-spin 0.8s linear infinite",
    display: "inline-block",
  },
  checklistTitle: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
  },
  checklistHint: { fontSize: 11, color: "var(--color-text-tertiary)" },
  checkRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 10px",
    borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: "var(--color-background-primary)",
  },
  approveBtn: {
    padding: "4px 12px", borderRadius: C.radius,
    border: "none", background: C.orange, color: "#fff",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
  },
  approvedTag: {
    display: "flex", alignItems: "center", gap: 3,
    fontSize: 11, fontWeight: 600, color: "#16a34a",
  },
  applyBtn: {
    flex: 1, padding: "7px 12px", borderRadius: C.radius,
    border: "none", background: C.orange, color: "#fff",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  cancelSmall: {
    padding: "7px 12px", borderRadius: C.radius,
    border: `0.5px solid ${C.border}`, background: "transparent",
    fontSize: 12, color: "var(--color-text-secondary)", cursor: "pointer",
  },
  doneStats: { fontSize: 11, color: "var(--color-text-secondary)" },
};

// spinner keyframes (injected once — inline styles can't declare @keyframes)
if (typeof document !== "undefined" && !document.getElementById("cpm-spin-style")) {
  const style = document.createElement("style");
  style.id = "cpm-spin-style";
  style.textContent = "@keyframes cpm-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
}

// ── Styles ────────────────────────────────────────────────────────────
const S = {
  root: {
    background: "var(--color-background-primary)",
    borderRadius: "var(--border-radius-lg)",
    overflow: "hidden",
    fontFamily: "DM Sans, sans-serif",
  },

  // Header
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: `0.5px solid ${C.border}`,
    background: C.bgSec,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 36, height: 36, borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: "var(--color-background-primary)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" },
  headerSub: { margin: "2px 0 0", fontSize: 12, color: "var(--color-text-tertiary)" },
  closeBtn: {
    width: 30, height: 30, borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: "transparent", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--color-text-tertiary)",
  },

  // Body
  body: { padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 },

  // Row 2-col
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },

  // Row 3-col
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

  // Input
  input: {
    width: "100%", boxSizing: "border-box",
    height: 36, borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    padding: "0 10px", fontSize: 13,
    background: C.bgSec,
    color: "var(--color-text-primary)",
    outline: "none",
  },
  inputError: { borderColor: "#fca5a5", background: "#fff1f2" },

  // Category buttons
  catRow: { display: "flex", gap: 8 },
  catBtn: {
    flex: 1, height: 36, borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: C.bgSec,
    cursor: "pointer", fontSize: 12, fontWeight: 500,
    color: "var(--color-text-secondary)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all 0.15s",
  },
  catBtnActive: {
    background: "rgb(255 117 14 / 0.08)",
    border: `0.5px solid rgb(255 117 14 / 0.5)`,
    color: C.orange,
  },

  // Footer
  footer: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "14px 20px",
    borderTop: `0.5px solid ${C.border}`,
    background: C.bgSec,
  },
  footerHint: {
    flex: 1, fontSize: 11,
    color: "var(--color-text-tertiary)",
    display: "flex", alignItems: "center", gap: 5,
  },
  btnCancel: {
    padding: "8px 16px", borderRadius: C.radius,
    border: `0.5px solid ${C.border}`,
    background: "transparent", fontSize: 13,
    cursor: "pointer", color: "var(--color-text-secondary)",
  },
  btnSave: {
    padding: "8px 16px", borderRadius: C.radius,
    border: "none",
    background: C.orange,
    color: "#fff", fontSize: 13, fontWeight: 500,
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
    transition: "opacity 0.15s",
  },
};