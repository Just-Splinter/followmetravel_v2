import { useEffect } from 'react'
import styles from '../styles/UI.module.css'

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'md', onClick, type = 'button', disabled, style }) {
  const cls = [styles.btn, styles[`btn-${variant}`], styles[`btn-${size}`], disabled ? styles.disabled : ''].join(' ')
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} style={style}>{children}</button>
}

// ── Badge / Status pill ───────────────────────────────────────────────────────
const STATUS_MAP = {
  confirmed: { label: 'Confirmé', cls: 'success' },
  pending:   { label: 'En attente', cls: 'warning' },
  cancelled: { label: 'Annulé', cls: 'danger' },
  active:    { label: 'Actif', cls: 'success' },
  draft:     { label: 'Brouillon', cls: 'neutral' },
}

export function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'neutral' }
  return <span className={`${styles.badge} ${styles[`badge-${cls}`]}`}>{label}</span>
}

export function Badge({ children, color = 'neutral' }) {
  return <span className={`${styles.badge} ${styles[`badge-${color}`]}`}>{children}</span>
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, className = '' }) {
  return <div className={`${styles.card} ${className}`} style={style}>{children}</div>
}

export function CardHeader({ title, actions }) {
  return (
    <div className={styles.cardHeader}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {actions && <div className={styles.cardActions}>{actions}</div>}
    </div>
  )
}

// ── Input / Select / Textarea ─────────────────────────────────────────────────
export function Input({ label, value, onChange, type = 'text', placeholder, required, style }) {
  return (
    <div className={styles.formGroup} style={style}>
      {label && <label className={styles.formLabel}>{label}{required && <span className={styles.req}> *</span>}</label>}
      <input
        type={type}
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

export function Select({ label, value, onChange, options, style }) {
  return (
    <div className={styles.formGroup} style={style}>
      {label && <label className={styles.formLabel}>{label}</label>}
      <select className={styles.input} value={value} onChange={e => onChange(e.target.value)} style={style}>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.formLabel}>{label}</label>}
      <textarea
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ resize: 'vertical' }}
      />
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 600, fullscreen = false }) {
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, onClose]);
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className={`${styles.modal} ${fullscreen ? styles.modalFull : ""}`}
        style={fullscreen ? undefined : { width }}
      >
        {title && !fullscreen && (
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>{title}</span>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        )}
        <div className={fullscreen ? styles.modalBodyFull : styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, data, onRowClick }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map(c => <th key={c.key} style={c.style}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0
            ? <tr><td colSpan={columns.length} className={styles.empty}>Aucune donnée</td></tr>
            : data.map((row, i) => (
              <tr key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? styles.clickable : ''}>
                {columns.map(c => <td key={c.key} style={c.style}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ── Stats card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }) {
  return (
    <div className={styles.statCard} style={accent ? { borderTop: `3px solid var(--gold)` } : {}}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────
export function Divider({ label }) {
  return <div className={styles.divider}>{label && <span>{label}</span>}</div>
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.confirm}>
        <p>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onCancel}>Annuler</Button>
          <Button variant="danger" onClick={onConfirm}>Confirmer</Button>
        </div>
      </div>
    </div>
  )
}
