import { useEffect, useMemo } from 'react'
import { StatCard, Card, CardHeader, StatusBadge, Table } from './UI'
import styles from '../styles/Dashboard.module.css'
import { useReservation } from '../context/ReservationContext'
import { usePackages } from '../context/PackagesContext'

export default function Dashboard() {
  const {
    reservations,
    fetchMyReservations,
    loading: resLoading,
  } = useReservation()

  const {
    findPackages,
    loading: pkgLoading,
  } = usePackages()

  // ── Chargement initial ───────────────────────────────────────────
  useEffect(() => {
    fetchMyReservations()
    findPackages()
  }, [fetchMyReservations, findPackages])

  // ── Stats calculées ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = reservations.length
    const pending   = reservations.filter(r => r.status === 'pending').length
    const confirmed = reservations.filter(r => r.status === 'confirmed').length
    const cancelled = reservations.filter(r => r.status === 'cancelled').length
    const revenue   = reservations
      .filter(r => r.status !== 'cancelled')
      .reduce((acc, r) => acc + (r.totalEstimate ?? 0), 0)
    return { total, pending, confirmed, cancelled, revenue }
  }, [reservations])

  // ── Prochains départs (date >= aujourd'hui, non annulés) ─────────
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return reservations
      .filter(r => r.status !== 'cancelled' && r.dateFrom >= today)
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
      .slice(0, 6)
  }, [reservations])

  // ── Réservations récentes ────────────────────────────────────────
  const recent = useMemo(() =>
    [...reservations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    [reservations]
  )

  // ── Par package (mini-cards) ─────────────────────────────────────
  const perPackage = useMemo(() => {
    const map = {}
    reservations.forEach(r => {
      if (!map[r.packageId]) {
        map[r.packageId] = {
          packageId:    r.packageId,
          packageTitle: r.packageTitle ?? r.packageId,
          count:        0,
          revenue:      0,
          pending:      0,
        }
      }
      map[r.packageId].count++
      if (r.status !== 'cancelled') map[r.packageId].revenue += r.totalEstimate ?? 0
      if (r.status === 'pending')   map[r.packageId].pending++
    })
    return Object.values(map)
  }, [reservations])

  const fmtMoney = n => (n ?? 0).toLocaleString('fr-MA') + ' DH'

  const fmtDate = iso => iso
    ? new Date(iso.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'))
        .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : '—'

  // ── Colonnes tableaux ────────────────────────────────────────────
  const upcomingCols = [
    {
      key: 'ref',
      label: 'Réf',
      render: r => (
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>
          {(r.$id ?? r.id ?? '').slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'pkg',
      label: 'Package',
      render: r => (
        <span style={{ fontWeight: 600, fontSize: 13 }}>{r.packageTitle}</span>
      ),
    },
    {
      key: 'client',
      label: 'Client',
      render: r => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{r.userName ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.userEmail}</div>
        </div>
      ),
    },
    {
      key: 'depart',
      label: 'Départ',
      render: r => (
        <div>
          <div style={{ fontSize: 13 }}>{fmtDate(r.dateFrom)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {fmtDate(r.dateTo)}</div>
        </div>
      ),
    },
    {
      key: 'pax',
      label: 'Pax',
      render: r => (
        <span>
          {r.adults}a{r.children > 0 ? ` + ${r.children}e` : ''}
        </span>
      ),
    },
    {
      key: 'hotel',
      label: 'Hôtel',
      render: r => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {r.hotelName ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: r => <StatusBadge status={r.status} />,
    },
  ]

  const recentCols = [
    {
      key: 'ref',
      label: 'Réf',
      render: r => (
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>
          {(r.$id ?? r.id ?? '').slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'client',
      label: 'Client',
      render: r => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{r.userName ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.userEmail}</div>
        </div>
      ),
    },
    {
      key: 'pkg',
      label: 'Package',
      render: r => <span style={{ fontSize: 13 }}>{r.packageTitle}</span>,
    },
    {
      key: 'chambre',
      label: 'Chambre',
      render: r => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {r.roomType ?? '—'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Montant',
      render: r => (
        <strong style={{ color: 'var(--gold)' }}>{fmtMoney(r.totalEstimate)}</strong>
      ),
    },
    {
      key: 'date',
      label: 'Créée le',
      render: r => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: r => <StatusBadge status={r.status} />,
    },
  ]

  const isLoading = resLoading || pkgLoading

  if (isLoading && !reservations.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: 14 }}>
        Chargement…
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Stats ── */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total réservations"
          value={stats.total}
          sub="toutes périodes"
          accent
        />
        <StatCard
          label="En attente"
          value={stats.pending}
          sub="confirmations requises"
        />
        <StatCard
          label="Confirmées"
          value={stats.confirmed}
          sub="réservations actives"
        />
        <StatCard
          label="Chiffre d'affaires"
          value={fmtMoney(stats.revenue)}
          sub="hors annulations"
        />
      </div>

      {/* ── Tableaux ── */}
      <div className={styles.grid2}>
        <Card>
          <CardHeader title="Prochains départs" sub={`${upcoming.length} départ(s) à venir`} />
          <Table columns={upcomingCols} data={upcoming} emptyLabel="Aucun départ à venir" />
        </Card>
        <Card>
          <CardHeader title="Réservations récentes" sub="dernières enregistrées" />
          <Table columns={recentCols} data={recent} emptyLabel="Aucune réservation" />
        </Card>
      </div>

      {/* ── Par package ── */}
      {perPackage.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Réservations par package
          </div>
          <div className={styles.packagesRow}>
            {perPackage.map(p => (
              <div key={p.packageId} className={styles.pkgMini}>
                <div className={styles.pkgMiniName}>{p.packageTitle}</div>
                <div className={styles.pkgMiniStat}>
                  <span>{p.count} réservation(s)</span>
                  <strong>{fmtMoney(p.revenue)}</strong>
                </div>
                {p.pending > 0 && (
                  <div className={styles.pkgMiniStat} style={{ marginTop: 6 }}>
                    <span style={{ color: 'var(--gold)', fontSize: 11 }}>
                      ⏳ {p.pending} en attente
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}