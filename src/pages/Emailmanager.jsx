import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Mail, Search, Plus, Eye, Edit3, Trash2, X, Save,
  Send, Code, FileText, Monitor, Tablet, Smartphone,
  Info, CheckCircle, AlertCircle, Tag,
  Inbox, Sparkles, Copy as CopyIcon, RefreshCw,
  Bold, Italic, Underline, Link2, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Eraser, Type
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { useMail } from "../context/MailContext";
import { EMAIL_VARIABLE_GROUPS, EMAIL_VARIABLE_INDEX } from "../services/emailVariables";
import { sendTestEmail } from "../services/emailSender";

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

// Stable reference: @uiw/react-codemirror recreates the editor state whenever
// the `extensions` array identity changes, which would reset the cursor/undo
// history on every render if this were declared inline.
const HTML_CODE_EXTENSIONS = [htmlLang()];

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

/**
 * Inserts `text` at the current caret position of an <input>/<textarea>,
 * replacing any selection, then restores focus with the caret right after
 * the inserted text — so clicking a variable chip repeatedly builds up the
 * field instead of always appending at the end or requiring a manual paste.
 */
function insertAtCursor(ref, value, onChange, text) {
  const el = ref.current;
  if (!el) { onChange((value || "") + text); return; }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + text + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

/**
 * Replaces every {{key}} found in `text` — scans the text itself rather than
 * iterating a declared list, so a variable inserted twice (subject *and*
 * body, say) or typed by hand still resolves. Precedence: this template's
 * own override (`variables`) > the catalog's preview value > `[key]` so an
 * unrecognized variable still reads as a placeholder instead of vanishing.
 */
function applyVariables(text, variables) {
  const overrides = new Map((variables || []).map((v) => [v.key, v.default]));
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const override = overrides.get(key);
    if (override) return override;
    const catalogPreview = EMAIL_VARIABLE_INDEX[key]?.preview;
    return catalogPreview || `[${key}]`;
  });
}

/** Distinct {{key}} names found across one or more text fields, in first-seen order. */
function extractVariableKeys(...texts) {
  const seen = new Set();
  const re = /\{\{(\w+)\}\}/g;
  texts.forEach((text) => {
    let m;
    while ((m = re.exec(String(text || "")))) seen.add(m[1]);
  });
  return [...seen];
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

/**
 * WYSIWYG mode for the HTML field — a contentEditable surface with a
 * formatting toolbar, for admins who'd rather not hand-write markup. Kept
 * deliberately uncontrolled: `initialHtml` only seeds the DOM once on mount
 * (this component is remounted, via the `key="rich"` on its call site,
 * whenever the admin switches back into this tab, which is what picks up
 * edits made meanwhile in the Code tab). If React re-set innerHTML from
 * state on every keystroke instead, the caret would jump on every render.
 */
function RichHtmlEditor({ editorRef, initialHtml, onChange, onFocus }) {
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, arg) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(editorRef.current?.innerHTML || "");
  };

  const insertLink = () => {
    const url = window.prompt("URL du lien :", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  const toolBtn = (cmd, arg, Icon, label) => (
    <button
      type="button"
      className="em-rich-tool"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(cmd, arg)}
    >
      <Icon size={14} />
    </button>
  );

  const headingBtn = (tag, label) => (
    <button
      key={tag}
      type="button"
      className="em-rich-tool text"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec("formatBlock", tag)}
    >
      {label}
    </button>
  );

  return (
    <div className="em-rich-editor-wrap">
      <div className="em-rich-toolbar">
        {headingBtn("<p>", "P")}
        {headingBtn("<h1>", "H1")}
        {headingBtn("<h2>", "H2")}
        {headingBtn("<h3>", "H3")}
        <span className="em-rich-sep" />
        {toolBtn("bold", null, Bold, "Gras")}
        {toolBtn("italic", null, Italic, "Italique")}
        {toolBtn("underline", null, Underline, "Souligné")}
        <span className="em-rich-sep" />
        <button
          type="button"
          className="em-rich-tool"
          title="Lien"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
        >
          <Link2 size={14} />
        </button>
        {toolBtn("insertUnorderedList", null, List, "Liste à puces")}
        {toolBtn("insertOrderedList", null, ListOrdered, "Liste numérotée")}
        <span className="em-rich-sep" />
        {toolBtn("justifyLeft", null, AlignLeft, "Aligner à gauche")}
        {toolBtn("justifyCenter", null, AlignCenter, "Centrer")}
        {toolBtn("justifyRight", null, AlignRight, "Aligner à droite")}
        <span className="em-rich-sep" />
        {toolBtn("removeFormat", null, Eraser, "Effacer la mise en forme")}
      </div>
      <div
        ref={editorRef}
        className="em-rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onFocus={onFocus}
      />
    </div>
  );
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
function EditorModal({ tpl: initialTpl, onClose, onSave, loading, showToast }) {
  const [tpl, setTpl] = useState(() => ({
    ...initialTpl,
    variables: initialTpl.variables.map((v) => ({ ...v })),
    tags: [...initialTpl.tags],
  }));
  const [tab, setTab] = useState("content");
  // "rich" = WYSIWYG contentEditable (the easy path for non-technical admins),
  // "code" = raw HTML in CodeMirror, "split" = code + live preview side by side.
  const [htmlTab, setHtmlTab] = useState("rich");
  const [customVarKey, setCustomVarKey] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  // Which field a variable chip inserts into — whichever of subject/
  // preheader/html the admin last focused, defaulting to the HTML body.
  const [activeField, setActiveField] = useState("html");
  const subjectRef = useRef(null);
  const preheaderRef = useRef(null);
  // Holds the CodeMirror EditorView instance (not a DOM node — the HTML
  // field is a real code editor now, which has its own selection API).
  const htmlViewRef = useRef(null);
  // Holds the contentEditable DOM node for the WYSIWYG "rich" mode.
  const richEditorRef = useRef(null);
  const fieldRefs = { subject: subjectRef, preheader: preheaderRef };

  const set = (field, value) => setTpl((t) => ({ ...t, [field]: value }));

  // Inserting is the only way variables get into a template now — a chip is
  // never "used up", so the same {{key}} can go into the subject and the
  // body (or twice in the body) just by clicking it again in each field.
  const insertVariable = (key) => {
    const text = `{{${key}}}`;
    if (activeField === "html" && htmlTab === "rich") {
      const el = richEditorRef.current;
      if (!el) { set("html", (tpl.html || "") + text); return; }
      el.focus();
      document.execCommand("insertText", false, text);
      set("html", el.innerHTML);
      return;
    }
    if (activeField === "html") {
      const view = htmlViewRef.current;
      if (!view) { set("html", (tpl.html || "") + text); return; }
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      view.focus();
      return;
    }
    insertAtCursor(fieldRefs[activeField], tpl[activeField] || "", (v) => set(activeField, v), text);
  };

  const insertCustomVariable = () => {
    const key = customVarKey.trim().replace(/\s+/g, "_");
    if (!key) return;
    insertVariable(key);
    setCustomVarKey("");
  };

  // Which {{key}}s actually appear in this template right now — the
  // Variables tab lists these, not a manually-curated array. Removing a
  // variable means deleting its {{...}} from the content, not "un-adding"
  // it from a list.
  const usedKeys = useMemo(
    () => extractVariableKeys(tpl.subject, tpl.preheader, tpl.html),
    [tpl.subject, tpl.preheader, tpl.html]
  );

  /** Preview override for one variable — falls back to the catalog's preview value. */
  const varDefault = (key) => tpl.variables.find((v) => v.key === key)?.default ?? EMAIL_VARIABLE_INDEX[key]?.preview ?? "";

  const setVarDefault = (key, val) =>
    setTpl((t) => {
      const exists = t.variables.some((v) => v.key === key);
      return {
        ...t,
        variables: exists
          ? t.variables.map((v) => (v.key === key ? { ...v, default: val } : v))
          : [...t.variables, { key, default: val }],
      };
    });

  const rendered = applyVariables(tpl.html, tpl.variables);

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    try {
      await sendTestEmail(tpl.$id, testEmail.trim());
      showToast?.(`Test envoyé à ${testEmail.trim()}`);
    } catch (err) {
      showToast?.(err?.message || "Échec de l'envoi du test", "error");
    } finally {
      setTestSending(false);
    }
  };

  const tabs = [
    { id: "content", label: "Contenu & Objet", icon: FileText },
    { id: "reply", label: "Informations d'envoi", icon: Send },
    { id: "variables", label: `Variables (${usedKeys.length})`, icon: Code },
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
            <div className="em-var-tab-layout" style={{ animation: "emFadeIn 0.3s ease" }}>
              <div className="em-var-tab-main">
                <div className="em-field-row">
                  <div className="em-field">
                    <label className="em-field-label">
                      Objet de l'email
                      <span className="em-field-hint">Supporte les variables {"{{...}}"}</span>
                    </label>
                    <input
                      ref={subjectRef}
                      className="em-input"
                      value={tpl.subject}
                      onChange={(e) => set("subject", e.target.value)}
                      onFocus={() => setActiveField("subject")}
                      placeholder="Objet de votre email..."
                    />
                  </div>
                  <div className="em-field">
                    <label className="em-field-label">
                      Préheader
                      <span className="em-field-hint">Texte affiché après l'objet</span>
                    </label>
                    <input
                      ref={preheaderRef}
                      className="em-input"
                      value={tpl.preheader}
                      onChange={(e) => set("preheader", e.target.value)}
                      onFocus={() => setActiveField("preheader")}
                      placeholder="Courte description..."
                    />
                  </div>
                </div>

                <div className="em-field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <label className="em-field-label" style={{ margin: 0 }}>HTML du template</label>
                    <div className="em-html-tabs">
                      <button className={`em-html-tab ${htmlTab === "rich" ? "active" : ""}`} onClick={() => setHtmlTab("rich")}>
                        <Type size={12} /> Texte
                      </button>
                      <button className={`em-html-tab ${htmlTab === "code" ? "active" : ""}`} onClick={() => setHtmlTab("code")}>
                        <Code size={12} /> Code
                      </button>
                      <button className={`em-html-tab ${htmlTab === "split" ? "active" : ""}`} onClick={() => setHtmlTab("split")}>
                        Split view
                      </button>
                    </div>
                  </div>

                  {htmlTab === "rich" ? (
                    <RichHtmlEditor
                      key="rich"
                      editorRef={richEditorRef}
                      initialHtml={tpl.html}
                      onChange={(value) => set("html", value)}
                      onFocus={() => setActiveField("html")}
                    />
                  ) : htmlTab === "code" ? (
                    <div className="em-code-editor" onFocus={() => setActiveField("html")}>
                      <CodeMirror
                        value={tpl.html}
                        height="400px"
                        extensions={HTML_CODE_EXTENSIONS}
                        onChange={(value) => set("html", value)}
                        onCreateEditor={(view) => { htmlViewRef.current = view; }}
                      />
                    </div>
                  ) : (
                    <div className="em-split-view">
                      <div className="em-code-editor" onFocus={() => setActiveField("html")}>
                        <CodeMirror
                          value={tpl.html}
                          height="440px"
                          extensions={HTML_CODE_EXTENSIONS}
                          onChange={(value) => set("html", value)}
                          onCreateEditor={(view) => { htmlViewRef.current = view; }}
                        />
                      </div>
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
                </div>
              </div>

              <aside className="em-var-tab-sidebar">
                <div className="em-var-catalog">
                  <p className="em-var-catalog-title">
                    <Sparkles size={12} style={{ verticalAlign: -1, marginInlineEnd: 4 }} />
                    Insérer dans {activeField === "subject" ? "l'objet" : activeField === "preheader" ? "le préheader" : "le HTML"}
                  </p>
                  <p className="em-var-palette-empty" style={{ margin: "-6px 0 4px" }}>
                    Une variable peut être insérée plusieurs fois, dans plusieurs champs.
                  </p>

                  <div className="em-var-catalog-scroll">
                    {EMAIL_VARIABLE_GROUPS.map((group) => (
                      <div key={group.label} className="em-var-catalog-group">
                        <p className="em-var-catalog-group-label">{group.label}</p>
                        <div className="em-var-chips">
                          {group.variables.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              className="em-var-chip catalog"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insertVariable(v.key)}
                              title={v.description}
                            >
                              {`{{${v.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="em-var-catalog-group">
                      <p className="em-var-catalog-group-label">Variable personnalisée</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="em-var-input mono"
                          style={{ fontSize: 12 }}
                          value={customVarKey}
                          onChange={(e) => setCustomVarKey(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertCustomVariable(); } }}
                          placeholder="nom_variable"
                        />
                        <button
                          type="button"
                          className="em-action-btn"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={insertCustomVariable}
                          title="Insérer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
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
                  Cette liste se construit automatiquement à partir des <code>{"{{variables}}"}</code> présentes
                  dans l'objet, le pré-en-tête et le contenu HTML (onglet <strong>Contenu</strong>, où se trouve
                  le catalogue à insérer). Une variable peut être utilisée plusieurs fois — définissez ici la
                  valeur d'exemple utilisée pour l'aperçu.
                </span>
              </div>

              {usedKeys.length === 0 ? (
                <p className="em-var-catalog-title" style={{ marginTop: 18 }}>
                  Aucune variable dans ce template. Passez à l'onglet Contenu et cliquez sur une variable du
                  catalogue pour l'insérer.
                </p>
              ) : (
                <>
                  <p className="em-var-catalog-title" style={{ marginTop: 18 }}>
                    Variables utilisées ({usedKeys.length})
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 8px 10px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Nom de la variable</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Valeur d'exemple</span>
                  </div>

                  {usedKeys.map((key) => (
                    <div key={key} className="em-var-row" title={EMAIL_VARIABLE_INDEX[key]?.description}>
                      <span className="em-var-input mono" style={{ display: "flex", alignItems: "center" }}>
                        {`{{${key}}}`}
                      </span>
                      <input
                        className="em-var-input"
                        value={varDefault(key)}
                        onChange={(e) => setVarDefault(key, e.target.value)}
                        placeholder="Valeur exemple"
                      />
                    </div>
                  ))}
                </>
              )}
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

              <div className="em-info-box" style={{ marginBottom: 18, alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Send size={16} style={{ flexShrink: 0 }} />
                {tpl.$id ? (
                  <>
                    <span style={{ flexShrink: 0 }}>Envoyer un test à :</span>
                    <input
                      className="em-input"
                      type="email"
                      style={{ maxWidth: 240 }}
                      placeholder="vous@followmetravel.ma"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <button
                      className="em-action-btn"
                      onClick={handleSendTest}
                      disabled={testSending || !testEmail.trim()}
                    >
                      {testSending ? "Envoi…" : "Envoyer le test"}
                    </button>
                  </>
                ) : (
                  <span>Enregistrez ce template pour pouvoir envoyer un test.</span>
                )}
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
          showToast={showToast}
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