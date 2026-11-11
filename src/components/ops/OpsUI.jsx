// Briques d'interface des pages de gestion (planning, échéancier, pipeline,
// équipe, journal…) — même langage visuel que ReservationsManager (classes
// res-* injectées par useInjectStyles), plus quelques classes ops-*.
import { STATUS_META, useOpsStyles } from "../../services/opsFormat";

export function Badge({ cls = "muted", children, title }) {
  return <span className={`ops-badge ${cls}`} title={title}>{children}</span>;
}

export function StatusBadge({ status }) {
  const s = STATUS_META[status] || STATUS_META.pending;
  return <Badge cls={s.cls}>{s.label}</Badge>;
}

export function Page({ title, subtitle, actions, children }) {
  useOpsStyles();
  return (
    <div className="res-root">
      <div className="res-container">
        <div className="ops-head">
          <div>
            <h1 className="ops-title">{title}</h1>
            {subtitle && <p className="ops-sub">{subtitle}</p>}
          </div>
          {actions && <div className="ops-actions">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Kpis({ items }) {
  return (
    <div className="res-kpis" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="res-kpi-card" style={{ "--kpi-color": k.color || "#ff750e", "--kpi-bg": k.bg || "rgba(255,117,14,.1)" }}>
            {Icon && <div className="res-kpi-icon"><Icon size={22} /></div>}
            <div>
              <div className="res-kpi-label">{k.label}</div>
              <div className="res-kpi-value">{k.value}</div>
              {k.sub && <div className="ops-muted" style={{ marginTop: 4 }}>{k.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Loading({ label = "Chargement…" }) {
  return (
    <div className="res-empty">
      <span className="res-spinner" style={{ width: 22, height: 22 }} />
      <p className="ops-muted" style={{ marginTop: 12 }}>{label}</p>
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="res-empty">
      {Icon && <div className="res-empty-icon"><Icon size={30} /></div>}
      <p className="res-empty-title">{title}</p>
      {children && <div className="ops-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="ops-alert danger">{error.message || String(error)}</div>;
}

export function FillBar({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "#16a34a";
  return (
    <div title={max ? `${value} / ${max} (${pct} %)` : `${value} vendus`}>
      <div className="ops-bar"><span style={{ width: `${max ? pct : 0}%`, background: color }} /></div>
    </div>
  );
}
