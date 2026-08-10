import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Button, Card, CardHeader, StatusBadge, Table, Modal, Input, Select, Textarea, Divider } from './UI'
import styles from '../styles/Reservations.module.css'

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'pending', label: 'En attente' },
  { value: 'cancelled', label: 'Annulé' },
]

const EMPTY_RES = {
  id: null, clientId: '', packageId: '', departureId: '', hotel: '',
  roomType: 'double', pax: 2, total: 0, status: 'pending', notes: ''
}

export default function Reservations() {
  const { reservations, saveReservation, updateReservationStatus, packages, clients } = useApp()
  const [filterPkg, setFilterPkg] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
  const getPkg = id => packages.find(p => p.id === id)
  const getClient = id => clients.find(c => c.id === id)
  const getDep = (pkgId, depId) => getPkg(pkgId)?.departures.find(d => d.id === depId)

  const filtered = reservations.filter(r => {
    if (filterPkg && r.packageId !== filterPkg) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const columns = [
    { key: 'id', label: 'Réf', render: r => <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{r.id}</span> },
    { key: 'client', label: 'Client', render: r => { const c = getClient(r.clientId); return c ? `${c.firstName} ${c.lastName}` : r.clientId } },
    { key: 'package', label: 'Package', render: r => <span className={styles.pkgName}>{getPkg(r.packageId)?.name ?? r.packageId}</span> },
    { key: 'depart', label: 'Départ', render: r => { const d = getDep(r.packageId, r.departureId); return d ? fmtDate(d.from) : '—' } },
    { key: 'hotel', label: 'Hôtel', render: r => <span style={{ fontSize: 12 }}>{r.hotel}</span> },
    { key: 'room', label: 'Chambre', render: r => <span style={{ textTransform: 'capitalize', fontSize: 12 }}>{r.roomType}</span> },
    { key: 'pax', label: 'Pax', render: r => r.pax },
    { key: 'total', label: 'Total', render: r => <strong>{r.total.toLocaleString('fr-MA')} DH</strong> },
    { key: 'status', label: 'Statut', render: r => <StatusBadge status={r.status} /> },
    {
      key: 'actions', label: '', render: r => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setViewing(r) }}>👁</Button>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setEditing(JSON.parse(JSON.stringify(r))) }}>✏</Button>
        </div>
      )
    },
  ]

  const pkgOptions = [
    { value: '', label: 'Tous les packages' },
    ...packages.map(p => ({ value: p.id, label: p.name }))
  ]

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Select value={filterPkg} onChange={setFilterPkg} options={pkgOptions} />
          <Select value={filterStatus} onChange={setFilterStatus} options={STATUSES} />
        </div>
        <Button variant="gold" onClick={() => setEditing({ ...EMPTY_RES })}>+ Nouvelle réservation</Button>
      </div>

      <Card>
        <CardHeader title={`${filtered.length} réservation${filtered.length > 1 ? 's' : ''}`} />
        <Table columns={columns} data={filtered} onRowClick={setViewing} />
      </Card>

      {viewing && <ReservationDetail res={viewing} onClose={() => setViewing(null)} packages={packages} clients={clients} onStatusChange={(id, s) => { updateReservationStatus(id, s); setViewing(prev => ({ ...prev, status: s })) }} />}
      {editing && <ReservationForm res={editing} onChange={setEditing} onSave={() => { saveReservation(editing); setEditing(null) }} onClose={() => setEditing(null)} packages={packages} clients={clients} />}
    </div>
  )
}

// ── Reservation detail view ───────────────────────────────────────────────────
function ReservationDetail({ res, onClose, packages, clients, onStatusChange }) {
  const pkg = packages.find(p => p.id === res.packageId)
  const client = clients.find(c => c.id === res.clientId)
  const dep = pkg?.departures.find(d => d.id === res.departureId)
  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  return (
    <Modal title={`Réservation ${res.id}`} onClose={onClose} width={520}>
      <div className={styles.detailGrid}>
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Client</div>
          <div className={styles.detailValue}>{client ? `${client.firstName} ${client.lastName}` : res.clientId}</div>
          {client && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{client.phone} · {client.email}</div>}
        </div>
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Package</div>
          <div className={styles.detailValue}>{pkg?.name ?? res.packageId}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pkg?.duration}J/{pkg?.nights}N · {pkg?.airline}</div>
        </div>
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Dates</div>
          <div className={styles.detailValue}>{fmtDate(dep?.from)} → {fmtDate(dep?.to)}</div>
        </div>
        <div className={styles.detailSection}>
          <div className={styles.detailLabel}>Hôtel</div>
          <div className={styles.detailValue}>{res.hotel}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chambre {res.roomType} · {res.pax} pax</div>
        </div>
        <div className={styles.detailSection} style={{ gridColumn: '1 / -1', background: 'var(--gold-pale)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
          <div className={styles.detailLabel}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>{res.total.toLocaleString('fr-MA')} DH</div>
        </div>
        {res.notes && (
          <div className={styles.detailSection} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.detailLabel}>Notes</div>
            <div style={{ fontSize: 13 }}>{res.notes}</div>
          </div>
        )}
      </div>
      <Divider label="Changer le statut" />
      <div style={{ display: 'flex', gap: 8 }}>
        {['confirmed', 'pending', 'cancelled'].map(s => (
          <Button key={s} size="sm" variant={res.status === s ? 'primary' : 'default'} onClick={() => onStatusChange(res.id, s)}>
            {s === 'confirmed' ? '✓ Confirmer' : s === 'pending' ? '⏳ En attente' : '✕ Annuler'}
          </Button>
        ))}
      </div>
    </Modal>
  )
}

// ── Reservation form ──────────────────────────────────────────────────────────
function ReservationForm({ res, onChange, onSave, onClose, packages, clients }) {
  const set = (k, v) => onChange(p => ({ ...p, [k]: v }))
  const pkg = packages.find(p => p.id === res.packageId)

  const autoCalc = (pkgId, hotelName, roomType, pax) => {
    const p = packages.find(x => x.id === pkgId)
    if (!p) return
    const h = p.hotels.find(h => h.name === hotelName)
    if (h) {
      const price = h[roomType] ?? 0
      set('total', price * pax)
    }
  }

  return (
    <Modal title={res.id ? `Modifier ${res.id}` : 'Nouvelle réservation'} onClose={onClose} width={560}>
      <div className={styles.formGrid}>
        <Select label="Client" value={res.clientId} onChange={v => set('clientId', v)}
          options={[{ value: '', label: '— Sélectionner —' }, ...clients.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))]} />
        <Select label="Package" value={res.packageId} onChange={v => { set('packageId', v); set('departureId', ''); set('hotel', '') }}
          options={[{ value: '', label: '— Sélectionner —' }, ...packages.map(p => ({ value: p.id, label: p.name }))]} />
        {pkg && (
          <Select label="Date de départ" value={res.departureId} onChange={v => set('departureId', v)}
            options={[{ value: '', label: '— Sélectionner —' }, ...pkg.departures.map(d => ({
              value: d.id,
              label: `${new Date(d.from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${new Date(d.to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
            }))]} />
        )}
        {pkg && (
          <Select label="Hôtel" value={res.hotel} onChange={v => { set('hotel', v); autoCalc(res.packageId, v, res.roomType, res.pax) }}
            options={[{ value: '', label: '— Sélectionner —' }, ...pkg.hotels.map(h => ({ value: h.name, label: `${h.name} ★`.repeat(1) + `${h.name}`.includes(h.name) ? h.name : h.name }))] } />
        )}
        <Select label="Type chambre" value={res.roomType} onChange={v => { set('roomType', v); autoCalc(res.packageId, res.hotel, v, res.pax) }}
          options={[{ value: 'triple', label: 'Triple' }, { value: 'double', label: 'Double' }, { value: 'single', label: 'Single' }]} />
        <Input label="Nombre de pax" type="number" value={res.pax} onChange={v => { set('pax', +v); autoCalc(res.packageId, res.hotel, res.roomType, +v) }} />
        <Input label="Total (DH)" type="number" value={res.total} onChange={v => set('total', +v)} />
        <Select label="Statut" value={res.status} onChange={v => set('status', v)}
          options={[{ value: 'pending', label: 'En attente' }, { value: 'confirmed', label: 'Confirmé' }, { value: 'cancelled', label: 'Annulé' }]} />
        <Textarea label="Notes" value={res.notes} onChange={v => set('notes', v)} placeholder="Remarques, demandes spéciales..." />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="gold" onClick={onSave}>💾 Enregistrer</Button>
      </div>
    </Modal>
  )
}