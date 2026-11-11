// Onglets ajoutés au détail d'une réservation (ReservationsManager) :
// voyageurs (passeports), échéancier, documents PDF, coûts & marge,
// historique / notes, et l'attribution à un conseiller.
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Download, ExternalLink, FileText, History, MessageSquarePlus,
  Plus, Receipt, RotateCcw, Save, Send, Trash2, TrendingUp, UserCheck, Users, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import db, { Collections } from "../../services/database";
import { canIssueInvoice } from "../../services/roles";
import {
  DOCUMENTS, OTHER_DOCUMENTS, ROLE_LABELS, addNote, documentUrl, getReservationFinance, issueInvoice, listAudit,
  sendClientMessage, sendReservationDocuments,
} from "../../services/operations";
import { CIVILITIES, TRAVELER_FIELDS, parseTravelers, passportIssue } from "../../services/travelers";
import { Badge } from "../ops/OpsUI";
import { dateFr, money, useOpsStyles, useTeam } from "../../services/opsFormat";

const parse = (raw) => {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function Header({ icon: Icon, title, children }) {
  return (
    <div className="res-tab-header">
      <div className="res-tab-header-title"><Icon size={16} />{title}</div>
      <div className="res-tab-header-actions">{children}</div>
    </div>
  );
}

/** Sélecteur du conseiller en charge du dossier. */
export function AssigneeSelect({ res, onSave, notify }) {
  const team = useTeam().filter((u) => u.status);
  const [saving, setSaving] = useState(false);
  const change = async (assignedTo) => {
    setSaving(true);
    try {
      await onSave({ ...res, assignedTo });
      notify("Dossier attribué ✓");
    } catch {
      notify("Attribution impossible", "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
      <UserCheck size={14} /> Conseiller :
      <select className="res-select" value={res.assignedTo || ""} disabled={saving} onChange={(e) => change(e.target.value)} style={{ padding: "4px 8px", fontSize: 12 }}>
        <option value="">— non attribué —</option>
        {team.map((u) => (
          <option key={u.$id} value={u.$id}>{u.name || u.email} ({u.roles.map((r) => ROLE_LABELS[r]).join(", ")})</option>
        ))}
      </select>
    </label>
  );
}

// ── Voyageurs ──────────────────────────────────────────────────────
export function TravelersTab({ res, onSave, notify }) {
  useOpsStyles();
  const travelers = parseTravelers(res.participants);
  const pax = Number(res.totalPax) || travelers.length;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const list = [...travelers];
    while (list.length < pax) list.push({});
    setDraft(list.map((t) => ({ ...t })));
    setEditing(true);
  };
  const set = (i, key, value) => setDraft((d) => d.map((t, n) => (n === i ? { ...t, [key]: value } : t)));
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...res, participants: JSON.stringify(draft.filter((t) => Object.values(t).some(Boolean))) });
      notify("Voyageurs enregistrés ✓");
      setEditing(false);
    } catch (e) {
      notify(e?.message || "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const filled = travelers.filter((t) => t?.fullName).length;
  const problems = travelers.map((t) => passportIssue(t, res.travelEnd)).filter(Boolean).length;

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>
      <Header icon={Users} title={`Voyageurs (${filled} / ${pax})`}>
        {editing ? (
          <>
            <button className="res-btn ghost small" onClick={() => setEditing(false)}><X size={13} /> Annuler</button>
            <button className="res-btn primary small" onClick={save} disabled={saving}><Save size={13} /> Enregistrer</button>
          </>
        ) : (
          <button className="res-btn ghost small" onClick={startEdit}>Modifier</button>
        )}
      </Header>

      {!editing && (filled < pax || problems > 0) && (
        <div className="ops-alert warn">
          <AlertTriangle size={16} />
          <div>
            {filled < pax && <div>{pax - filled} voyageur(s) à renseigner.</div>}
            {problems > 0 && <div>{problems} passeport(s) à vérifier (manquant, ou valide moins de 6 mois après le retour{res.travelEnd ? ` du ${dateFr(res.travelEnd)}` : ""}).</div>}
            <div className="ops-muted" style={{ color: "inherit", opacity: 0.8 }}>Le client peut aussi compléter depuis son espace « Mon profil ».</div>
          </div>
        </div>
      )}

      {editing ? (
        draft.map((t, i) => (
          <div key={i} className="ops-card" style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontWeight: 800, fontSize: 12, color: "#64748b" }}>
              VOYAGEUR {i + 1}{i === 0 ? " — CONTACT PRINCIPAL" : ""}
              <button className="res-icon-btn danger" title="Retirer" onClick={() => setDraft((d) => d.filter((_, n) => n !== i))}><Trash2 size={14} /></button>
            </div>
            <div className="ops-form">
              {TRAVELER_FIELDS.map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.key === "civility" ? (
                    <select value={t.civility || ""} onChange={(e) => set(i, f.key, e.target.value)}>
                      <option value="">—</option>
                      {CIVILITIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type={f.type || "text"} value={t[f.key] || ""} onChange={(e) => set(i, f.key, e.target.value)} />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))
      ) : travelers.length === 0 ? (
        <div className="res-participant-empty">Aucun voyageur renseigné.</div>
      ) : (
        <div className="res-table-scroll">
          <table className="res-table">
            <thead>
              <tr><th>#</th><th>Voyageur</th><th>Naissance</th><th>Passeport</th><th>Expiration</th><th>Contact</th></tr>
            </thead>
            <tbody>
              {travelers.map((t, i) => {
                const issue = passportIssue(t, res.travelEnd);
                return (
                  <tr key={i} className="res-row">
                    <td>{i + 1}</td>
                    <td><strong>{[t.civility, t.fullName].filter(Boolean).join(" ") || "—"}</strong><div className="ops-muted">{t.nationality}</div></td>
                    <td>{dateFr(t.birthDate)}</td>
                    <td>{t.passportNumber || "—"}</td>
                    <td>{issue ? <Badge cls="warn" title={issue}>{t.passportExpiry ? dateFr(t.passportExpiry) : "à renseigner"}</Badge> : <Badge cls="ok">{dateFr(t.passportExpiry)}</Badge>}</td>
                    <td className="ops-muted">{[t.phone, t.email].filter(Boolean).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Échéancier ─────────────────────────────────────────────────────
const INST_STATUS = {
  paid: ["ok", "Réglée"], partial: ["info", "Partielle"], overdue: ["danger", "En retard"], due: ["warn", "Aujourd'hui"], upcoming: ["muted", "À venir"],
};

export function ScheduleTab({ res, onSave, notify }) {
  useOpsStyles();
  const [finance, setFinance] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getReservationFinance(res.$id)
      .then((f) => {
        setError(null);
        setFinance(f);
      })
      .catch(setError);
  }, [res.$id]);
  useEffect(load, [load, res.$updatedAt, res.payments, res.schedule, res.totalEstimate]);

  const startEdit = () => {
    setDraft((finance?.installments || []).map(({ id, label, dueDate, amount }) => ({ id, label, dueDate, amount })));
    setEditing(true);
  };
  const save = async (schedule) => {
    setSaving(true);
    try {
      await onSave({ ...res, schedule });
      notify(schedule ? "Échéancier enregistré ✓" : "Échéancier par défaut rétabli ✓");
      setEditing(false);
    } catch {
      notify("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };
  const draftTotal = draft.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const reminders = parse(res.remindersSent);

  if (error) return <div className="ops-alert danger">{error.message}</div>;
  if (!finance) return <div className="res-empty"><span className="res-spinner" /></div>;

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>
      <Header icon={CalendarClock} title="Échéancier de paiement">
        {editing ? (
          <>
            <button className="res-btn ghost small" onClick={() => setEditing(false)}><X size={13} /> Annuler</button>
            <button className="res-btn primary small" disabled={saving || Math.round(draftTotal) !== Math.round(finance.total)} onClick={() => save(JSON.stringify(draft.map((i) => ({ ...i, amount: Number(i.amount) || 0 }))))}>
              <Save size={13} /> Enregistrer
            </button>
          </>
        ) : (
          <>
            {finance.custom && <button className="res-btn ghost small" disabled={saving} onClick={() => save("")}><RotateCcw size={13} /> Par défaut</button>}
            <button className="res-btn ghost small" onClick={startEdit}>Personnaliser</button>
            <a className="res-btn ghost small" href={documentUrl(res.$id, "echeancier")} target="_blank" rel="noreferrer"><FileText size={13} /> PDF</a>
          </>
        )}
      </Header>

      <div className="res-pay-dashboard" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[["Total", finance.total], ["Réglé", finance.paid], ["Reste", finance.remaining], ["En retard", finance.overdue]].map(([l, v]) => (
          <div key={l} className="ops-card" style={{ padding: 12 }}>
            <div className="res-kpi-label">{l}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: l === "En retard" && v > 0 ? "#dc2626" : "#0f172a" }}>{money(v)}</div>
          </div>
        ))}
      </div>

      {finance.mismatch && !editing && (
        <div className="ops-alert warn"><AlertTriangle size={16} />Le prix du dossier a changé : la somme des échéances ne correspond plus au total. Rétablissez l'échéancier par défaut ou ajustez-le.</div>
      )}
      {!finance.travel && <div className="ops-alert info">Dates de voyage non reconnues : l'échéancier par défaut se limite à un règlement unique.</div>}

      {editing ? (
        <>
          {draft.map((i, n) => (
            <div key={i.id || n} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 6 }}>
              <input className="res-input" value={i.label} placeholder="Libellé" onChange={(e) => setDraft((d) => d.map((x, k) => (k === n ? { ...x, label: e.target.value } : x)))} />
              <input className="res-input" type="date" value={i.dueDate} onChange={(e) => setDraft((d) => d.map((x, k) => (k === n ? { ...x, dueDate: e.target.value } : x)))} />
              <input className="res-input" type="number" min="0" step="100" value={i.amount} onChange={(e) => setDraft((d) => d.map((x, k) => (k === n ? { ...x, amount: e.target.value } : x)))} />
              <button className="res-icon-btn danger" onClick={() => setDraft((d) => d.filter((_, k) => k !== n))}><X size={14} /></button>
            </div>
          ))}
          <button className="res-btn ghost small" onClick={() => setDraft((d) => [...d, { id: uid(), label: `Échéance ${d.length + 1}`, dueDate: new Date().toISOString().slice(0, 10), amount: Math.max(0, finance.total - draftTotal) }])}>
            <Plus size={13} /> Ajouter une échéance
          </button>
          <p className="ops-muted" style={{ marginTop: 10 }}>
            Somme : <strong style={{ color: Math.round(draftTotal) === Math.round(finance.total) ? "#16a34a" : "#dc2626" }}>{money(draftTotal)}</strong> / {money(finance.total)} — elle doit égaler le total du dossier.
          </p>
        </>
      ) : (
        <table className="res-table">
          <thead><tr><th>Échéance</th><th>Date limite</th><th>Montant</th><th>Réglé</th><th>Reste</th><th>Statut</th></tr></thead>
          <tbody>
            {finance.installments.map((i) => (
              <tr key={i.id} className="res-row">
                <td><strong>{i.label}</strong></td>
                <td>{dateFr(i.dueDate)}<div className="ops-muted">{i.remaining > 0 ? (i.daysToDue < 0 ? `${-i.daysToDue} j de retard` : i.daysToDue === 0 ? "aujourd'hui" : `dans ${i.daysToDue} j`) : ""}</div></td>
                <td>{money(i.amount)}</td>
                <td>{money(i.paid)}</td>
                <td><strong>{money(i.remaining)}</strong></td>
                <td><Badge cls={INST_STATUS[i.status][0]}>{INST_STATUS[i.status][1]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="ops-muted" style={{ marginTop: 14 }}>
        {finance.custom ? "Échéancier personnalisé." : "Échéancier par défaut (Paramètres → Agence)."} Les paiements de l'onglet « Paiements » sont affectés aux échéances par date.
        {reminders.length > 0 && ` Relances envoyées : ${reminders.map((r) => dateFr(r.at)).join(", ")}.`}
      </p>
    </div>
  );
}

// ── Documents ──────────────────────────────────────────────────────
function DocRow({ label, sub, href, extra }) {
  return (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 8, background: "#fff" }}>
    <FileText size={18} style={{ color: "#ff750e" }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
      {sub && <div className="ops-muted">{sub}</div>}
    </div>
    {extra}
    {href && (
      <>
        <a className="res-btn ghost small" href={href} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Ouvrir</a>
        <a className="res-btn ghost small" href={`${href}${href.includes("?") ? "&" : "?"}download=1`}><Download size={13} /></a>
      </>
    )}
  </div>
  );
}

const TRI = [
  { value: "", label: "Par défaut (Paramètres)" },
  { value: "true", label: "Oui" },
  { value: "false", label: "Non" },
];

/* Message libre au client : boîte de réception de son espace + email si configuré. */
function ClientMessage({ res, notify }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    try {
      const r = await sendClientMessage(res.$id, subject.trim(), message.trim());
      notify(r.emailed ? `Message envoyé à ${r.to} et dans son espace client ✓` : "Message déposé dans l'espace client ✓");
      setSubject("");
      setMessage("");
      setOpen(false);
    } catch (e) {
      notify(e.message || "Envoi impossible", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="res-btn small" style={{ marginBottom: 12 }} onClick={() => setOpen(true)}>
        <MessageSquarePlus size={13} /> Écrire au client
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 14, padding: 12, border: "1px solid var(--line, #e2e8f0)", borderRadius: 10 }}>
      <input className="res-input" placeholder="Objet" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="res-textarea" rows={4} maxLength={5000} placeholder="Votre message au client (visible dans son espace, envoyé aussi par email si possible)" value={message} onChange={(e) => setMessage(e.target.value)} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="res-btn small" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
        <button className="res-btn primary small" onClick={send} disabled={busy || !subject.trim() || !message.trim()}>
          <Send size={13} /> {busy ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}

export function DocumentsTab({ res, onUpdated, notify }) {
  useOpsStyles();
  const { user } = useAuth();
  const [issuing, setIssuing] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingFiche, setSavingFiche] = useState(false);
  const fieldsOf = (r) => ({
    refundable: r.refundable === undefined || r.refundable === null ? "" : String(r.refundable),
    modifiable: r.modifiable === undefined || r.modifiable === null ? "" : String(r.modifiable),
    transferType: r.transferType || "",
    specialConditions: r.specialConditions || "",
    remarks: r.remarks || "",
  });
  const [fiche, setFiche] = useState(() => fieldsOf(res));
  const payments = parse(res.payments);
  const hotels = parse(res.hotels);

  const issue = async () => {
    setIssuing(true);
    try {
      const r = await issueInvoice(res.$id);
      onUpdated({ ...res, invoiceNumber: r.invoiceNumber, invoiceDate: r.invoiceDate });
      notify(`Facture ${r.invoiceNumber} émise ✓`);
    } catch (e) {
      notify(e.message || "Émission impossible", "error");
    } finally {
      setIssuing(false);
    }
  };

  const send = async () => {
    setSending(true);
    try {
      const r = await sendReservationDocuments(res.$id);
      onUpdated({ ...res, documentsSentAt: new Date().toISOString() });
      notify(`Fiche, facture et conditions envoyées à ${r.to} ✓`);
    } catch (e) {
      notify(e.message || "Envoi impossible", "error");
    } finally {
      setSending(false);
    }
  };

  const saveFiche = async () => {
    setSavingFiche(true);
    try {
      const patch = {
        refundable: fiche.refundable === "" ? null : fiche.refundable === "true",
        modifiable: fiche.modifiable === "" ? null : fiche.modifiable === "true",
        transferType: fiche.transferType.trim(),
        specialConditions: fiche.specialConditions.trim(),
        remarks: fiche.remarks.trim(),
      };
      const updated = await db.update(Collections.RESERVATIONS, res.$id, patch);
      onUpdated({ ...res, ...updated });
      notify("Fiche de réservation mise à jour ✓");
    } catch (e) {
      notify(e.message || "Enregistrement impossible", "error");
    } finally {
      setSavingFiche(false);
    }
  };
  const ficheDirty = JSON.stringify(fiche) !== JSON.stringify(fieldsOf(res));
  const set = (k) => (e) => setFiche((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>
      <Header icon={FileText} title="Documents" />

      <div className={`ops-alert ${res.clientValidatedAt ? "ok" : "warn"}`} style={{ marginBottom: 12 }}>
        <CheckCircle2 size={16} />
        <div>
          {res.clientValidatedAt
            ? <>Fiche et conditions de vente <b>validées par le client</b> le {dateFr(res.clientValidatedAt)}.</>
            : <>En attente de validation par le client (depuis son espace, après réception des documents).</>}
          {res.documentsSentAt && <div className="ops-muted">Documents envoyés le {dateFr(res.documentsSentAt)}.</div>}
        </div>
        <button className="res-btn primary small" style={{ marginLeft: "auto" }} disabled={sending || res.status === "cancelled"} onClick={send}>
          <Send size={13} /> {sending ? "Envoi…" : res.documentsSentAt ? "Renvoyer au client" : "Envoyer au client"}
        </button>
      </div>

      <ClientMessage res={res} notify={notify} />

      <p className="ops-muted" style={{ marginBottom: 12 }}>
        Remis au client par email (avec le lien pour valider ou annuler) : fiche de réservation complète, facture avec l'état de paiement et conditions de vente. Générés avec les données actuelles du dossier et la fiche agence.
      </p>
      <DocRow label={DOCUMENTS[0].label} sub="Détail complet : voyage, hébergement, voyageurs, paiement, programme, conditions d'annulation" href={documentUrl(res.$id, "reservation")} />
      {res.invoiceNumber ? (
        <DocRow label={`Facture ${res.invoiceNumber}`} sub={`Émise le ${dateFr(res.invoiceDate)} — avec l'état de paiement`} href={documentUrl(res.$id, "facture")} />
      ) : (
        <DocRow
          label="Facture proforma"
          sub="État de paiement à jour. La facture définitive (numéro continu, obligation légale) s'émet ici."
          href={documentUrl(res.$id, "facture")}
          extra={canIssueInvoice(user) ? (
            <button className="res-btn primary small" disabled={issuing} onClick={issue}><Receipt size={13} /> Émettre</button>
          ) : null}
        />
      )}
      <DocRow label={DOCUMENTS[2].label} sub="Texte de Paramètres → Agence, barème d'annulation et règle des passeports" href={documentUrl(res.$id, "cgv")} />

      <h4 className="qv-h" style={{ marginTop: 18 }}>Fiche de réservation — conditions du dossier</h4>
      <div className="ops-form">
        <label>Remboursable
          <select value={fiche.refundable} onChange={set("refundable")}>{TRI.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </label>
        <label>Modifiable
          <select value={fiche.modifiable} onChange={set("modifiable")}>{TRI.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </label>
        <label>Type de transfert
          <input placeholder="ex : Groupe, Privé" value={fiche.transferType} onChange={set("transferType")} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>Conditions particulières
          <input value={fiche.specialConditions} onChange={set("specialConditions")} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>Remarques (visibles par le client)
          <textarea rows={2} value={fiche.remarks} onChange={set("remarks")} />
        </label>
      </div>
      {ficheDirty && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="res-btn primary small" disabled={savingFiche} onClick={saveFiche}>{savingFiche ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      )}

      <details style={{ marginTop: 16 }}>
        <summary className="ops-muted" style={{ cursor: "pointer", marginBottom: 8 }}>Autres documents (devis, contrat, programme, échéancier, vouchers, reçus)</summary>
        {OTHER_DOCUMENTS.map((d) => (
          <DocRow key={d.type} label={d.label} href={documentUrl(res.$id, d.type)} />
        ))}
        {hotels.map((h, i) => (
          <DocRow key={`v${i}`} label={`Voucher — ${h.name || `hôtel ${i + 1}`}`} href={documentUrl(res.$id, "voucher", { hotel: i })} />
        ))}
        {payments.filter((p) => p.id).map((p) => (
          <DocRow key={p.id} label={`Reçu — ${money(p.amount)}`} sub={dateFr(p.date)} href={documentUrl(res.$id, "recu", { paymentId: p.id })} />
        ))}
      </details>
    </div>
  );
}

// ── Coûts & marge ──────────────────────────────────────────────────
const COST_CATEGORIES = {
  flight: "Billets d'avion", hotel: "Hébergement", transfer: "Transferts", excursion: "Excursions", visa: "Visa", insurance: "Assurance", guide: "Guide", other: "Autre",
};

export function CostsTab({ res, onSave, notify }) {
  useOpsStyles();
  const costs = parse(res.costs);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const list = editing ? draft : costs;
  const total = Number(res.totalEstimate) || 0;
  const spent = list.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const margin = total - spent;
  const unpaid = list.filter((c) => !c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const set = (i, k, v) => setDraft((d) => d.map((c, n) => (n === i ? { ...c, [k]: v } : c)));
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...res, costs: JSON.stringify(draft.map((c) => ({ ...c, amount: Number(c.amount) || 0 }))) });
      notify("Coûts enregistrés ✓");
      setEditing(false);
    } catch {
      notify("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>
      <Header icon={TrendingUp} title="Coûts fournisseurs & marge">
        {editing ? (
          <>
            <button className="res-btn ghost small" onClick={() => setEditing(false)}><X size={13} /> Annuler</button>
            <button className="res-btn primary small" disabled={saving} onClick={save}><Save size={13} /> Enregistrer</button>
          </>
        ) : (
          <button className="res-btn ghost small" onClick={() => { setDraft(costs.map((c) => ({ ...c }))); setEditing(true); }}>Modifier</button>
        )}
      </Header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          ["Prix de vente", money(total)],
          ["Coûts", money(spent)],
          ["Marge", money(margin)],
          ["Taux de marge", total ? `${Math.round((margin / total) * 100)} %` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="ops-card" style={{ padding: 12 }}>
            <div className="res-kpi-label">{l}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: l === "Marge" && margin < 0 ? "#dc2626" : "#0f172a" }}>{v}</div>
          </div>
        ))}
      </div>
      {unpaid > 0 && !editing && <div className="ops-alert info">Reste à régler aux fournisseurs : <strong>{money(unpaid)}</strong></div>}
      {list.length === 0 && !editing && <div className="res-participant-empty">Aucun coût saisi — la marge affichée est le prix de vente.</div>}
      {list.map((c, i) =>
        editing ? (
          <div key={c.id || i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.6fr 1fr auto auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <select className="res-select" value={c.category || "other"} onChange={(e) => set(i, "category", e.target.value)}>
              {Object.entries(COST_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="res-input" placeholder="Fournisseur" value={c.supplier || ""} onChange={(e) => set(i, "supplier", e.target.value)} />
            <input className="res-input" placeholder="Libellé" value={c.label || ""} onChange={(e) => set(i, "label", e.target.value)} />
            <input className="res-input" type="number" min="0" step="100" value={c.amount ?? ""} onChange={(e) => set(i, "amount", e.target.value)} />
            <label className="ops-muted" style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!c.paid} onChange={(e) => set(i, "paid", e.target.checked)} />Réglé</label>
            <button className="res-icon-btn danger" onClick={() => setDraft((d) => d.filter((_, n) => n !== i))}><X size={14} /></button>
          </div>
        ) : (
          <div key={c.id || i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 6 }}>
            <Badge cls="muted">{COST_CATEGORIES[c.category] || "Autre"}</Badge>
            <div style={{ flex: 1 }}><strong>{c.label || "—"}</strong><div className="ops-muted">{c.supplier}</div></div>
            <strong>{money(c.amount)}</strong>
            {c.paid ? <Badge cls="ok">Réglé</Badge> : <Badge cls="warn">À régler</Badge>}
          </div>
        ),
      )}
      {editing && (
        <button className="res-btn ghost small" onClick={() => setDraft((d) => [...d, { id: uid(), category: "other", supplier: "", label: "", amount: 0, paid: false }])}>
          <Plus size={13} /> Ajouter un coût
        </button>
      )}
      <p className="ops-muted" style={{ marginTop: 12 }}>Visible uniquement par l'équipe : les coûts ne sont jamais envoyés au client.</p>
    </div>
  );
}

// ── Historique & notes ─────────────────────────────────────────────
const ACTION_META = {
  create: ["#16a34a", "Création"], update: ["#2563eb", "Modification"], delete: ["#dc2626", "Suppression"],
  note: ["#ff750e", "Note"], email: ["#7c3aed", "Email"], document: ["#0891b2", "Document"],
};
const FIELD_LABELS = {
  status: "Statut", payments: "Paiements", participants: "Voyageurs", totalEstimate: "Total", schedule: "Échéancier",
  costs: "Coûts", assignedTo: "Conseiller", hotels: "Hôtels", dateFrom: "Départ", dateTo: "Retour", travelStart: "Date de départ",
  travelEnd: "Date de retour", userName: "Client", supplements: "Suppléments", cancelledAt: "Annulée le", invoiceNumber: "Facture",
};

export function HistoryTab({ res }) {
  useOpsStyles();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const team = useTeam();
  const nameOf = (id) => team.find((u) => u.$id === id)?.name || id;

  const load = useCallback(() => {
    listAudit({ collection: "reservations", documentId: res.$id, limit: 200 })
      .then((r) => setEntries(r.entries))
      .catch(setError);
  }, [res.$id]);
  useEffect(load, [load, res.$updatedAt]);

  const submit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addNote("reservations", res.$id, note.trim());
      setNote("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const describe = (e) => {
    if (e.action !== "update" || !e.changes) return e.message;
    return Object.entries(e.changes)
      .map(([k, [before, after]]) => {
        const label = FIELD_LABELS[k] || k;
        if (k === "assignedTo") return `${label} : ${nameOf(after) || "—"}`;
        if (typeof after === "string" && after.length > 60) return `${label} modifié(s)`;
        return `${label} : ${before ?? "—"} → ${after ?? "—"}`;
      })
      .join(" · ");
  };

  return (
    <div style={{ animation: "resFadeIn .3s ease" }}>
      <Header icon={History} title="Historique du dossier" />
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <textarea className="res-textarea" rows={2} style={{ flex: 1 }} placeholder="Note interne : appel client, demande particulière, relance…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="res-btn primary" disabled={saving || !note.trim()} onClick={submit}><MessageSquarePlus size={14} /> Ajouter</button>
      </div>
      {error && <div className="ops-alert danger">{error.message}</div>}
      {!entries ? (
        <div className="res-empty"><span className="res-spinner" /></div>
      ) : entries.length === 0 ? (
        <div className="res-participant-empty">Aucun événement enregistré pour ce dossier.</div>
      ) : (
        <ul className="ops-timeline">
          {entries.map((e) => {
            const [color, label] = ACTION_META[e.action] || ["#94a3b8", e.action];
            return (
              <li key={e.id} style={{ "--dot": color }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  <strong style={{ color }}>{label}</strong> · {new Date(e.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {e.userName || "système"}
                </div>
                <div style={{ fontSize: 13, marginTop: 3, whiteSpace: "pre-wrap" }}>{describe(e) || ""}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

