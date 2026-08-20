import { useEffect, useMemo, useState } from "react";
import { useTravelData } from "../context/TravelDataContext";
import db, { Collections } from "../services/database";
import {
  EMAIL_TRIGGERS,
  emailSettingsFromPackages,
  emailSettingsDocumentAttrs,
  triggerConfig,
} from "../services/emailSettings";

const AUDIENCE_LABEL = { client: "Client", admin: "Agence" };

/** Dashboard — Notifications tab: which reservation events send a template email, and with which template. */
export default function EmailNotificationsManager() {
  const { packages, packageActions } = useTravelData();
  const existing = useMemo(() => emailSettingsFromPackages(packages), [packages]);

  const [triggers, setTriggers] = useState({});
  const [adminEmails, setAdminEmails] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Seed local state once the singleton doc is known — mirrors
  // ContactImagesManager's approach (useState(() => ...) can't be used here
  // since `existing` isn't known until the products fetch resolves).
  useEffect(() => {
    if (!existing) return;
    setTriggers(existing.triggers || {});
    setAdminEmails(existing.adminEmails || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.$id]);

  // Templates live outside TravelDataContext (a separate collection, and
  // MailProvider isn't mounted on this route) — fetched directly here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await db.listAll(Collections.EMAIL_TEMPLATES);
        if (!cancelled) setTemplates(res.documents ?? res);
      } catch (e) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setTrigger = (key, patch) =>
    setTriggers((prev) => ({ ...prev, [key]: { ...triggerConfig({ triggers: prev }, key), ...patch } }));

  const save = async () => {
    const incomplete = EMAIL_TRIGGERS.filter((t) => triggers[t.key]?.enabled && !triggers[t.key]?.templateId);
    if (incomplete.length > 0) {
      setErr(`Choisissez un template pour : ${incomplete.map((t) => t.label).join(", ")}`);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const attrs = emailSettingsDocumentAttrs({ triggers, adminEmails });
      if (existing?.$id) await packageActions.update(existing.$id, attrs);
      else await packageActions.create(attrs);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const hasAdminTrigger = EMAIL_TRIGGERS.some((t) => t.audience === "admin");

  return (
    <div className="cms-table-card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Notifications email</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
          Choisissez, pour chaque événement, s'il déclenche un envoi automatique et quel template Mail Manager utiliser.
        </div>
      </div>

      {hasAdminTrigger && (
        <div className="em-field" style={{ maxWidth: 420, marginBottom: 20 }}>
          <label className="em-field-label" htmlFor="notif-admin-emails">
            Email(s) de l'agence
            <span className="em-field-hint">Destinataires des notifications "Agence" — séparés par des virgules</span>
          </label>
          <input
            id="notif-admin-emails"
            className="em-input"
            value={adminEmails}
            onChange={(e) => setAdminEmails(e.target.value)}
            placeholder="reservations@followmetravel.ma"
          />
        </div>
      )}

      <div className="cms-notif-list">
        {EMAIL_TRIGGERS.map((trig) => {
          const cfg = triggerConfig({ triggers }, trig.key);
          return (
            <div key={trig.key} className="cms-notif-row">
              <label className="cms-notif-toggle">
                <input
                  type="checkbox"
                  checked={!!cfg.enabled}
                  onChange={(e) => setTrigger(trig.key, { enabled: e.target.checked })}
                />
                <span className="cms-notif-switch" aria-hidden="true" />
              </label>

              <div className="cms-notif-info">
                <div className="cms-notif-title">
                  {trig.label}
                  <span className={`cms-notif-audience ${trig.audience}`}>{AUDIENCE_LABEL[trig.audience]}</span>
                </div>
                <div className="cms-notif-hint">{trig.hint}</div>
              </div>

              <select
                className="em-select"
                style={{ width: 240 }}
                value={cfg.templateId || ""}
                disabled={!cfg.enabled || loadingTemplates}
                onChange={(e) => setTrigger(trig.key, { templateId: e.target.value })}
              >
                <option value="">{loadingTemplates ? "Chargement…" : "— Choisir un template —"}</option>
                {templates.map((tpl) => (
                  <option key={tpl.$id} value={tpl.$id}>{tpl.name || "Sans nom"}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {!loadingTemplates && templates.length === 0 && (
        <p className="cms-status-bar" style={{ marginTop: 14, color: "#94a3b8" }}>
          Aucun template disponible — créez-en un dans Mail Manager avant d'activer une notification.
        </p>
      )}

      {err && <p className="cms-status-bar error" style={{ marginTop: 14 }}>⚠ {err}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button className="em-primary-btn" onClick={save} disabled={saving}>
          {saving ? "⏳ Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
