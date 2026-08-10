import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Mail, Search, Plus, Eye, Edit3, Trash2, X, Save,
  Send, Code, FileText, Monitor, Tablet, Smartphone,
  Info, CheckCircle, AlertCircle, Tag,
  Inbox, Sparkles, Copy as CopyIcon, RefreshCw
} from "lucide-react";
import { useMail } from "../context/MailContext";

// ─── Global CSS ─────────────────────────────────────────────────────────────
const EMAIL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; }


`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("em-global-styles")) return;
    const el = document.createElement("style");
    el.id = "em-global-styles";
    el.textContent = EMAIL_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = ["Tous", "Onboarding", "Transactionnel", "Marketing", "Relance", "Support"];

const categoryClass = (cat) => cat.toLowerCase().replace(/\s+/g, "");

const emptyTemplate = () => ({
  id: "tpl_" + Math.random().toString(36).slice(2, 9),
  name: "",
  category: "Onboarding",
  subject: "",
  preheader: "",
  fromName: "Follow Me Travel",
  fromEmail: "hello@followmetravel.ma",
  replyTo: "",
  ccEmails: "",
  bccEmails: "",
  html: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <h1 style="color: #1e293b;">Titre du mail</h1>
  <p style="color: #475569;">Bonjour {{first_name}},</p>
  <p style="color: #475569;">Votre contenu ici...</p>
</div>`,
  variables: [{ key: "first_name", default: "Client" }],
  tags: [],
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
});

// ─── Utilities ──────────────────────────────────────────────────────────────
function applyVariables(html, variables) {
  let result = html;
  variables.forEach(({ key, default: val }) => {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), val || `[${key}]`);
  });
  return result;
}

function cloneTemplate(tpl) {
  return {
    ...tpl,
    id: "tpl_" + Math.random().toString(36).slice(2, 9),
    name: tpl.name + " (copie)",
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    variables: tpl.variables.map((v) => ({ ...v })),
    tags: [...tpl.tags],
  };
}

// ─── Subcomponents ──────────────────────────────────────────────────────────
function Badge({ category }) {
  return (
    <span className={`em-badge ${categoryClass(category)}`}>
      {category}
    </span>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const Icon = toast.type === "error" ? AlertCircle : toast.type === "info" ? Info : CheckCircle;

  return (
    <div className={`em-toast ${toast.type}`}>
      <Icon size={18} />
      <span>{toast.msg}</span>
    </div>
  );
}

// ─── Template Card ──────────────────────────────────────────────────────────
function TemplateCard({ tpl, index, onEdit, onPreview, onDuplicate, onDelete }) {
  return (
    <div
      className="em-card"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
      onClick={() => onEdit(tpl)}
    >
      <div className="em-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="em-card-title">{tpl.name || "Sans nom"}</p>
          <p className="em-card-date">Modifié le {tpl.updatedAt}</p>
        </div>
        <Badge category={tpl.category} />
      </div>

      <div className="em-card-info">
        <p className="em-card-info-row">
          <span className="em-card-info-label">Objet :</span>
          <span className="em-card-info-value">{tpl.subject || "—"}</span>
        </p>
        <p className="em-card-info-row">
          <span className="em-card-info-label">De :</span>
          <span style={{ color: "#475569" }}>{tpl.fromName} &lt;{tpl.fromEmail}&gt;</span>
        </p>
      </div>

      <div className="em-card-tags">
        {tpl.tags.slice(0, 3).map((t) => (
          <span key={t} className="em-tag">#{t}</span>
        ))}
        {tpl.tags.length > 3 && (
          <span className="em-tag">+{tpl.tags.length - 3}</span>
        )}
        <span className="em-card-vars">
          <Code size={11} />
          {tpl.variables.length} var.
        </span>
      </div>

      <div className="em-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="em-action-btn" onClick={() => onPreview(tpl)} title="Aperçu">
          <Eye size={14} /> Aperçu
        </button>
        <button className="em-action-btn primary" onClick={() => onEdit(tpl)} title="Éditer">
          <Edit3 size={14} /> Éditer
        </button>
        <button className="em-action-btn" onClick={() => onDuplicate(tpl)} title="Dupliquer">
          <CopyIcon size={14} />
        </button>
        <button className="em-action-btn danger" onClick={() => onDelete(tpl)} title="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────
function PreviewModal({ tpl, onClose, onEdit }) {
  const [device, setDevice] = useState("desktop");
  const rendered = applyVariables(tpl.html, tpl.variables);

  const frameWidths = { desktop: "100%", tablet: 600, mobile: 375 };

  return (
    <div className="em-modal-backdrop" onClick={onClose}>
      <div className="em-modal" style={{ maxWidth: 960 }} onClick={(e) => e.stopPropagation()}>
        <div className="em-modal-header">
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1e293b" }}>{tpl.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Aperçu avec les valeurs d'exemple</p>
          </div>

          <div className="em-device-switcher">
            {[
              { id: "desktop", icon: Monitor, label: "Desktop" },
              { id: "tablet", icon: Tablet, label: "Tablet" },
              { id: "mobile", icon: Smartphone, label: "Mobile" },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`em-device-btn ${device === id ? "active" : ""}`}
                onClick={() => setDevice(id)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button className="em-action-btn primary" onClick={onEdit}>
            <Edit3 size={14} /> Éditer
          </button>
          <button className="em-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="em-email-client">
          <div className="em-email-meta">
            <div className="em-email-meta-row">
              <span className="em-email-meta-label">De :</span>
              <span>{tpl.fromName} &lt;{tpl.fromEmail}&gt;</span>
            </div>
            <div className="em-email-meta-row">
              <span className="em-email-meta-label">Répondre à :</span>
              <span>{tpl.replyTo || tpl.fromEmail}</span>
            </div>
            {tpl.ccEmails && (
              <div className="em-email-meta-row">
                <span className="em-email-meta-label">CC :</span>
                <span>{tpl.ccEmails}</span>
              </div>
            )}
            <div className="em-email-meta-row em-email-meta-divider">
              <span className="em-email-meta-label">Objet :</span>
              <span className="em-email-subject">{applyVariables(tpl.subject, tpl.variables)}</span>
            </div>
            {tpl.preheader && (
              <div className="em-email-meta-row">
                <span className="em-email-meta-label">Préheader :</span>
                <span className="em-email-preheader">{applyVariables(tpl.preheader, tpl.variables)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="em-preview-frame-wrap">
          <div className="em-preview-frame" style={{ width: frameWidths[device], maxWidth: "100%" }}>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"/></head><body style="margin:0;padding:0;">${rendered}</body></html>`}
              style={{ width: "100%", minHeight: 520, border: "none", display: "block" }}
              title="Email preview"
              onLoad={(e) => {
                try {
                  const h = e.target.contentDocument?.documentElement?.scrollHeight;
                  if (h) e.target.style.height = h + "px";
                } catch {
                  // cross-origin iframe, can't measure content height
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editor Modal ───────────────────────────────────────────────────────────
function EditorModal({ tpl: initialTpl, onClose, onSave, loading }) {
  const [tpl, setTpl] = useState(() => ({
    ...initialTpl,
    variables: initialTpl.variables.map((v) => ({ ...v })),
    tags: [...initialTpl.tags],
  }));
  const [tab, setTab] = useState("content");
  const [htmlTab, setHtmlTab] = useState("edit");

  const set = (field, value) => setTpl((t) => ({ ...t, [field]: value }));

  const setVar = (idx, v) =>
    setTpl((t) => {
      const vars = [...t.variables];
      vars[idx] = v;
      return { ...t, variables: vars };
    });

  const removeVar = (idx) =>
    setTpl((t) => ({ ...t, variables: t.variables.filter((_, i) => i !== idx) }));

  const addVar = () =>
    setTpl((t) => ({ ...t, variables: [...t.variables, { key: "nouvelle_variable", default: "" }] }));

  const rendered = applyVariables(tpl.html, tpl.variables);

  const tabs = [
    { id: "content", label: "Contenu & Objet", icon: FileText },
    { id: "reply", label: "Informations d'envoi", icon: Send },
    { id: "variables", label: `Variables (${tpl.variables.length})`, icon: Code },
    { id: "preview", label: "Aperçu", icon: Eye },
  ];

  return (
    <div className="em-modal-backdrop" onClick={onClose}>
      <div className="em-modal" onClick={(e) => e.stopPropagation()}>
        <div className="em-modal-header">
          <input
            className="em-modal-title-input"
            value={tpl.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nom du template"
          />
          <select
            className="em-select"
            style={{ width: "auto", minWidth: 160 }}
            value={tpl.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.filter((c) => c !== "Tous").map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            className="em-primary-btn"
            onClick={() => onSave(tpl)}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={14} style={{ animation: "emSpin 1s linear infinite" }} />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={14} />
                Enregistrer
              </>
            )}
          </button>
          <button className="em-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="em-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`em-tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="em-modal-body">
          {/* Tab: Content */}
          {tab === "content" && (
            <div style={{ animation: "emFadeIn 0.3s ease" }}>
              <div className="em-field-row">
                <div className="em-field">
                  <label className="em-field-label">
                    Objet de l'email
                    <span className="em-field-hint">Supporte les variables {"{{...}}"}</span>
                  </label>
                  <input
                    className="em-input"
                    value={tpl.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    placeholder="Objet de votre email..."
                  />
                </div>
                <div className="em-field">
                  <label className="em-field-label">
                    Préheader
                    <span className="em-field-hint">Texte affiché après l'objet</span>
                  </label>
                  <input
                    className="em-input"
                    value={tpl.preheader}
                    onChange={(e) => set("preheader", e.target.value)}
                    placeholder="Courte description..."
                  />
                </div>
              </div>

              <div className="em-field">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label className="em-field-label" style={{ margin: 0 }}>HTML du template</label>
                  <div className="em-html-tabs">
                    <button className={`em-html-tab ${htmlTab === "edit" ? "active" : ""}`} onClick={() => setHtmlTab("edit")}>
                      Éditeur
                    </button>
                    <button className={`em-html-tab ${htmlTab === "split" ? "active" : ""}`} onClick={() => setHtmlTab("split")}>
                      Split view
                    </button>
                  </div>
                </div>

                {htmlTab === "edit" ? (
                  <textarea
                    className="em-textarea"
                    value={tpl.html}
                    onChange={(e) => set("html", e.target.value)}
                    style={{ height: 400 }}
                  />
                ) : (
                  <div className="em-split-view">
                    <textarea
                      className="em-textarea"
                      value={tpl.html}
                      onChange={(e) => set("html", e.target.value)}
                      style={{ height: 440, resize: "none" }}
                    />
                    <div className="em-split-preview">
                      <div className="em-split-preview-header">
                        <span className="live-dot" />
                        Aperçu en direct
                      </div>
                      <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;">${rendered}</body></html>`}
                        style={{ width: "100%", height: 410, border: "none", display: "block" }}
                        title="Live preview"
                      />
                    </div>
                  </div>
                )}

                <div className="em-var-palette">
                  <p className="em-var-palette-label">
                    <Sparkles size={12} />
                    Cliquez pour copier une variable :
                  </p>
                  <div className="em-var-chips">
                    {tpl.variables.map(({ key }) => (
                      <button
                        key={key}
                        className="em-var-chip"
                        onClick={() => {
                          navigator.clipboard?.writeText(`{{${key}}}`);
                        }}
                        title="Copier dans le presse-papiers"
                      >
                        {`{{${key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Reply Info */}
          {tab === "reply" && (
            <div style={{ maxWidth: 680, animation: "emFadeIn 0.3s ease" }}>
              <div className="em-info-box blue">
                <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Ces informations définissent comment votre email apparaît dans le client de messagerie.</span>
              </div>

              <div className="em-field-row">
                <div className="em-field">
                  <label className="em-field-label">Nom de l'expéditeur</label>
                  <input className="em-input" value={tpl.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Follow Me Travel" />
                </div>
                <div className="em-field">
                  <label className="em-field-label">Adresse d'envoi</label>
                  <input className="em-input" type="email" value={tpl.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="hello@votredomaine.com" />
                </div>
              </div>

              <div className="em-field">
                <label className="em-field-label">
                  Répondre à (Reply-To)
                  <span className="em-field-hint">Laissez vide pour utiliser l'adresse d'envoi</span>
                </label>
                <input className="em-input" type="email" value={tpl.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="support@votredomaine.com" />
              </div>

              <div className="em-field">
                <label className="em-field-label">
                  CC
                  <span className="em-field-hint">Séparés par des virgules</span>
                </label>
                <input className="em-input" value={tpl.ccEmails} onChange={(e) => set("ccEmails", e.target.value)} placeholder="cc1@example.com, cc2@example.com" />
              </div>

              <div className="em-field">
                <label className="em-field-label">
                  BCC (Copie cachée)
                  <span className="em-field-hint">Séparés par des virgules</span>
                </label>
                <input className="em-input" value={tpl.bccEmails} onChange={(e) => set("bccEmails", e.target.value)} placeholder="archive@votredomaine.com" />
              </div>

              <div className="em-field">
                <label className="em-field-label">
                  <Tag size={12} /> Tags
                  <span className="em-field-hint">Séparés par des virgules</span>
                </label>
                <input
                  className="em-input"
                  value={tpl.tags.join(", ")}
                  onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                  placeholder="newsletter, promo, onboarding"
                />
              </div>
            </div>
          )}

          {/* Tab: Variables */}
          {tab === "variables" && (
            <div style={{ animation: "emFadeIn 0.3s ease" }}>
              <div className="em-info-box green">
                <Code size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Les variables s'utilisent dans l'objet et le HTML avec la syntaxe <code>{"{{nom_variable}}"}</code>
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, padding: "0 8px 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Nom de la variable</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Valeur d'exemple</span>
                <span />
              </div>

              {tpl.variables.map((v, i) => (
                <div key={i} className="em-var-row">
                  <input
                    className="em-var-input mono"
                    value={v.key}
                    onChange={(e) => setVar(i, { ...v, key: e.target.value.replace(/\s/g, "_") })}
                    placeholder="nom_variable"
                  />
                  <input
                    className="em-var-input"
                    value={v.default}
                    onChange={(e) => setVar(i, { ...v, default: e.target.value })}
                    placeholder="Valeur exemple"
                  />
                  <button className="em-var-remove" onClick={() => removeVar(i)}>
                    <X size={14} />
                  </button>
                </div>
              ))}

              <button className="em-action-btn" onClick={addVar} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                <Plus size={14} /> Ajouter une variable
              </button>
            </div>
          )}

          {/* Tab: Preview */}
          {tab === "preview" && (
            <div style={{ animation: "emFadeIn 0.3s ease" }}>
              <div className="em-email-meta" style={{ marginBottom: 18 }}>
                <div className="em-email-meta-row">
                  <span className="em-email-meta-label">De :</span>
                  <span>{tpl.fromName} &lt;{tpl.fromEmail}&gt;</span>
                </div>
                <div className="em-email-meta-row">
                  <span className="em-email-meta-label">Répondre à :</span>
                  <span>{tpl.replyTo || tpl.fromEmail}</span>
                </div>
                {tpl.ccEmails && (
                  <div className="em-email-meta-row">
                    <span className="em-email-meta-label">CC :</span>
                    <span>{tpl.ccEmails}</span>
                  </div>
                )}
                <div className="em-email-meta-row em-email-meta-divider">
                  <span className="em-email-meta-label">Objet :</span>
                  <span className="em-email-subject">{applyVariables(tpl.subject, tpl.variables)}</span>
                </div>
              </div>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;">${rendered}</body></html>`}
                style={{ width: "100%", minHeight: 480, border: "1px solid #e2e8f0", borderRadius: 10, display: "block" }}
                title="Full preview"
                onLoad={(e) => {
                  try {
                    const h = e.target.contentDocument?.documentElement?.scrollHeight;
                    if (h) e.target.style.height = h + "px";
                  } catch {
                    // cross-origin iframe, can't measure content height
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ─────────────────────────────────────────────────────────
function DeleteConfirm({ tpl, onClose, onConfirm }) {
  return (
    <div className="em-modal-backdrop" onClick={onClose}>
      <div className="em-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="em-confirm-icon">
          <Trash2 size={24} />
        </div>
        <p className="em-confirm-title">Supprimer ce template ?</p>
        <p className="em-confirm-text">
          <strong>«{tpl.name}»</strong> sera supprimé définitivement. Cette action est irréversible.
        </p>
        <div className="em-confirm-actions">
          <button className="em-btn-secondary" onClick={onClose}>Annuler</button>
          <button className="em-btn-danger" onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function EmailManager() {
  useInjectStyles();
  const {
    loading,
    findTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    Query,
  } = useMail();

  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tous");
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load templates from database
  const loadTemplates = useCallback(async () => {
    try {
      const result = await findTemplates([Query.orderDesc("$updatedAt")]);
      const parsed = (result.documents || []).map((doc) => ({
        ...doc,
        variables: typeof doc.variables === "string" ? JSON.parse(doc.variables || "[]") : (doc.variables || []),
        tags: typeof doc.tags === "string" ? JSON.parse(doc.tags || "[]") : (doc.tags || []),
      }));
      setTemplates(parsed);
    } catch (err) {
      console.error(err);
      setToast({ msg: "Erreur de chargement des templates", type: "error" });
    }
  }, [findTemplates, Query]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === "Tous" || t.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [templates, search, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: templates.length,
      onboarding: templates.filter((t) => t.category === "Onboarding").length,
      transactionnel: templates.filter((t) => t.category === "Transactionnel").length,
      marketing: templates.filter((t) => t.category === "Marketing").length,
    };
  }, [templates]);

  const handleSave = async (tpl) => {
    setSaving(true);
    try {
      const exists = templates.find((t) => t.$id === tpl.id || t.id === tpl.id);
      const payload = {
        ...tpl,
        updatedAt: new Date().toISOString().slice(0, 10),
      };

      if (exists) {
        await updateTemplate(exists.$id, payload);
        showToast(`Template «${tpl.name}» mis à jour`);
      } else {
        await createTemplate({
          ...payload,
          createdAt: new Date().toISOString().slice(0, 10),
        });
        showToast(`Template «${tpl.name}» créé`);
      }
      setEditing(null);
      await loadTemplates();
    } catch {
      showToast("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (tpl) => {
    try {
      const cloned = cloneTemplate(tpl);
      await createTemplate({
        ...cloned,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      });
      showToast(`Template dupliqué : «${cloned.name}»`, "info");
      await loadTemplates();
    } catch {
      showToast("Erreur lors de la duplication", "error");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTemplate(deleting.$id);
      showToast(`Template «${deleting.name}» supprimé`, "error");
      setDeleting(null);
      await loadTemplates();
    } catch {
      showToast("Erreur lors de la suppression", "error");
    }
  };

  return (
    <div className="em-root">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="em-header">
        <div className="em-header-inner">
          <div className="em-brand">
            <div className="em-brand-icon">
              <Mail size={20} />
            </div>
            <div>
              <p className="em-brand-title">Email Templates</p>
              <p className="em-brand-subtitle">{templates.length} template{templates.length > 1 ? "s" : ""}</p>
            </div>
          </div>

          <div className="em-search-wrap">
            <div className="em-search">
              <Search size={16} className="em-search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un template, sujet, tag..."
              />
              {search && (
                <button className="em-search-clear" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <button className="em-primary-btn" onClick={() => setEditing(emptyTemplate())}>
            <Plus size={16} />
            <span>Nouveau template</span>
          </button>
        </div>

        <div className="em-categories">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`em-category-tab ${categoryFilter === c ? "active" : ""}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
              {c !== "Tous" && (
                <span className="em-category-count">
                  {templates.filter((t) => t.category === c).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="em-main">
        {/* Stats */}
        <div className="em-stats-bar">
          <div className="em-stat-card">
            <div className="em-stat-icon orange"><Inbox size={20} /></div>
            <div>
              <div className="em-stat-value">{stats.total}</div>
              <div className="em-stat-label">Total templates</div>
            </div>
          </div>
          <div className="em-stat-card">
            <div className="em-stat-icon teal"><CheckCircle size={20} /></div>
            <div>
              <div className="em-stat-value">{stats.onboarding}</div>
              <div className="em-stat-label">Onboarding</div>
            </div>
          </div>
          <div className="em-stat-card">
            <div className="em-stat-icon blue"><Send size={20} /></div>
            <div>
              <div className="em-stat-value">{stats.transactionnel}</div>
              <div className="em-stat-label">Transactionnels</div>
            </div>
          </div>
          <div className="em-stat-card">
            <div className="em-stat-icon purple"><Sparkles size={20} /></div>
            <div>
              <div className="em-stat-value">{stats.marketing}</div>
              <div className="em-stat-label">Marketing</div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="em-loading">
            <div className="em-spinner" />
            <span>Chargement des templates...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="em-empty">
            <div className="em-empty-icon">
              <Inbox size={36} />
            </div>
            <p className="em-empty-title">Aucun template trouvé</p>
            <p className="em-empty-text">
              {search || categoryFilter !== "Tous"
                ? "Essayez d'autres termes ou filtres."
                : "Commencez par créer votre premier template d'email."}
            </p>
            <button className="em-primary-btn" onClick={() => setEditing(emptyTemplate())}>
              <Plus size={16} />
              Créer un template
            </button>
          </div>
        ) : (
          <div className="em-grid">
            {filtered.map((tpl, i) => (
              <TemplateCard
                key={tpl.$id || tpl.id}
                tpl={tpl}
                index={i}
                onEdit={() => setEditing(tpl)}
                onPreview={() => setPreviewing(tpl)}
                onDuplicate={() => handleDuplicate(tpl)}
                onDelete={() => setDeleting(tpl)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {previewing && (
        <PreviewModal
          tpl={previewing}
          onClose={() => setPreviewing(null)}
          onEdit={() => {
            setEditing(previewing);
            setPreviewing(null);
          }}
        />
      )}
      {editing && (
        <EditorModal
          tpl={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          loading={saving}
        />
      )}
      {deleting && (
        <DeleteConfirm
          tpl={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}