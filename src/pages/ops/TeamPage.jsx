import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Shield, UserCog, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS, createUser, deleteUser, listUsers, updateUser } from "../../services/operations";
import { STAFF_ROLES } from "../../services/roles";
import { dateFr } from "../../services/opsFormat";
import { Badge, Empty, ErrorNote, Loading, Page } from "../../components/ops/OpsUI";

const ROLE_HINTS = {
  admin: "Tout : utilisateurs, réglages, templates, suppressions, journal",
  agent: "Catalogue (packages, hôtels, CMS), réservations, clients",
  accounting: "Réservations, paiements, échéancier, factures, clients",
};

const randomPassword = () => `Fmt-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

function MemberModal({ member, onClose, onSaved }) {
  const creating = !member;
  const [form, setForm] = useState(() => ({
    email: member?.email || "",
    name: member?.name || "",
    roles: member?.roles || ["agent"],
    password: creating ? randomPassword() : "",
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const toggle = (role) => setForm((f) => ({ ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role] }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = creating
        ? await createUser(form)
        : await updateUser(member.$id, { name: form.name, roles: form.roles, ...(form.password ? { password: form.password } : {}) });
      onSaved(saved, form.password);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="res-modal-backdrop" onClick={onClose}>
      <div className="res-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="res-modal-header">
          <div className="res-modal-title"><UserCog size={18} />{creating ? "Nouveau membre de l'équipe" : `Modifier ${member.name || member.email}`}</div>
          <button className="res-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="res-modal-body">
          <ErrorNote error={error} />
          <div className="ops-form">
            <label>Email<input type="email" value={form.email} disabled={!creating} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Nom<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="full">
              {creating ? "Mot de passe initial (à transmettre au collaborateur)" : "Nouveau mot de passe (laisser vide pour ne pas changer)"}
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={creating ? "" : "8 caractères minimum"} />
            </label>
          </div>
          <div className="ops-section">Rôles</div>
          {STAFF_ROLES.map((r) => (
            <label key={r} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggle(r)} style={{ marginTop: 3 }} />
              <span><strong>{ROLE_LABELS[r]}</strong><div className="ops-muted">{ROLE_HINTS[r]}</div></span>
            </label>
          ))}
          {form.roles.length === 0 && <div className="ops-alert warn">Sans rôle, le compte est un compte client (pas d'accès au dashboard).</div>}
        </div>
        <div className="res-modal-actions">
          <button className="res-btn ghost" onClick={onClose}>Annuler</button>
          <button className="res-btn primary" disabled={saving || !form.email} onClick={save}>{creating ? "Créer le compte" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined : fermé, null : création
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    listUsers({ all, q }).then((d) => {
      setError(null);
      setData(d);
    }).catch(setError);
  }, [all, q]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Suppression définitive : confirmation explicite (les dossiers assignés deviennent non assignés).
  const remove = async (m) => {
    const message = `Supprimer définitivement le compte ${m.email} ?\n\nSes dossiers assignés redeviendront non assignés. L'historique est conservé. Pour une simple suspension, utilisez « Désactiver ».`;
    if (!window.confirm(message)) return;
    try {
      const r = await deleteUser(m.$id);
      setNotice(`Compte ${m.email} supprimé${r.unassigned ? ` — ${r.unassigned} dossier(s) à réassigner` : ""}.`);
      load();
    } catch (e) {
      setError(e);
    }
  };

  const toggleStatus = async (m) => {
    try {
      await updateUser(m.$id, { status: !m.status });
      load();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Page
      title="Équipe & accès"
      subtitle="Comptes du dashboard et leurs rôles. Un compte désactivé est déconnecté immédiatement."
      actions={<button className="res-btn primary" onClick={() => setEditing(null)}><Plus size={15} /> Ajouter un membre</button>}
    >
      <ErrorNote error={error} />
      {notice && (
        <div className="ops-alert info"><KeyRound size={16} /><div>{notice}</div><button className="res-icon-btn" style={{ marginLeft: "auto" }} onClick={() => setNotice(null)}><X size={14} /></button></div>
      )}
      <div className="res-toolbar">
        <div className="res-search-wrap">
          <div className="res-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un nom ou un email…" /></div>
        </div>
        <div className="res-filters">
          <button className={`res-pill ${!all ? "active" : ""}`} onClick={() => setAll(false)}>Équipe</button>
          <button className={`res-pill ${all ? "active" : ""}`} onClick={() => setAll(true)}>Tous les comptes (clients compris)</button>
        </div>
      </div>
      <div className="res-table-wrap">
        {!data ? (
          <Loading />
        ) : data.users.length === 0 ? (
          <Empty icon={Users} title="Aucun compte" />
        ) : (
          <div className="res-table-scroll">
            <table className="res-table">
              <thead><tr><th>Compte</th><th>Rôles</th><th>Connexion</th><th>Dernier accès</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {data.users.map((m) => (
                  <tr key={m.$id} className="res-row">
                    <td><div className="res-client-name">{m.name || "—"}{m.$id === user?.$id && <Badge cls="info">vous</Badge>}</div><div className="res-client-email">{m.email}</div></td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.roles.length ? m.roles.map((r) => <Badge key={r} cls={r === "admin" ? "danger" : "info"}><Shield size={10} /> {ROLE_LABELS[r]}</Badge>) : <Badge cls="muted">Client</Badge>}
                      </div>
                    </td>
                    <td className="ops-muted">{[m.hasPassword && "Mot de passe", m.google && "Google"].filter(Boolean).join(" + ") || "—"}</td>
                    <td className="ops-muted">{m.accessedAt ? dateFr(m.accessedAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "jamais"}</td>
                    <td>{m.status ? <Badge cls="ok">Actif</Badge> : <Badge cls="danger">Désactivé</Badge>}</td>
                    <td>
                      <div className="res-actions">
                        <button className="res-btn ghost small" onClick={() => setEditing(m)}>Modifier</button>
                        {m.$id !== user?.$id && (
                          <>
                            <button className="res-btn ghost small" onClick={() => toggleStatus(m)}>{m.status ? "Désactiver" : "Réactiver"}</button>
                            <button className="res-btn ghost small danger" onClick={() => remove(m)}>Supprimer</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing !== undefined && (
        <MemberModal
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved, password) => {
            setEditing(undefined);
            if (password) setNotice(`Identifiants de ${saved.email} : mot de passe « ${password} » — à transmettre de façon sécurisée, il ne sera plus affiché.`);
            load();
          }}
        />
      )}
    </Page>
  );
}
