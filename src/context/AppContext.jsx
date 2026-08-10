import { createContext, useContext, useState, useCallback } from 'react'
import { initialPackages, initialReservations, initialClients, agencyDefaults } from '../data/seed'

const AppContext = createContext(null)

export function AppProvider({ children }) {

  const [packages, setPackages] = useState(initialPackages)
  const [reservations, setReservations] = useState(initialReservations)
  const [clients, setClients] = useState(initialClients)
  const [agency, setAgency] = useState(agencyDefaults)

  // ── Packages ──
  const savePackage = useCallback((pkg) => {
    setPackages(prev => {
      const idx = prev.findIndex(p => p.id === pkg.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = pkg; return next }
      return [...prev, pkg]
    })
  }, [])

  const deletePackage = useCallback((id) => {
    setPackages(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── Reservations ──
  const saveReservation = useCallback((res) => {
    setReservations(prev => {
      const idx = prev.findIndex(r => r.id === res.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = res; return next }
      const newId = 'R' + (Math.max(...prev.map(r => parseInt(r.id.slice(1)))) + 1)
      return [{ ...res, id: newId, createdAt: new Date().toISOString().slice(0, 10) }, ...prev]
    })
  }, [])

  const updateReservationStatus = useCallback((id, status) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }, [])

  // ── Clients ──
  const saveClient = useCallback((client) => {
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === client.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = client; return next }
      return [...prev, { ...client, id: 'c' + Date.now() }]
    })
  }, [])

  // ── Stats (derived) ──
  const stats = {
    totalPackages: packages.filter(p => p.status === 'active').length,
    totalReservations: reservations.length,
    pendingReservations: reservations.filter(r => r.status === 'pending').length,
    revenue: reservations.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.total, 0),
  }

  return (
    <AppContext.Provider value={{
      packages, savePackage, deletePackage,
      reservations, saveReservation, updateReservationStatus,
      clients, saveClient,
      agency, setAgency,
      stats,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)