import { NavLink, useNavigate } from 'react-router-dom'
import styles from '../styles/Sidebar.module.css'
import { usePendingReservations } from '../context/usePendingReservations'
import { useAuth } from '../context/AuthContext'
import { hasRole } from '../services/roles'
import {
  Mail, Settings, LayoutDashboard, Plane, ClipboardList, Hotel, ExternalLink, LogOut, Users,
  CalendarDays, Wallet, KanbanSquare, BellRing, UserCog, ScrollText,
} from 'lucide-react'

const ALL = ['admin', 'agent', 'accounting']
const EDITORS = ['admin', 'agent']
const ADMIN = ['admin']

// Chaque entrée n'apparaît qu'aux rôles qui peuvent s'en servir (l'API
// vérifie de toute façon les droits).
const GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard/home', icon: LayoutDashboard, label: 'Tableau de bord', roles: ALL },
      { to: '/dashboard/reservations', icon: ClipboardList, label: 'Réservations', badge: true, roles: ALL },
      { to: '/dashboard/planning', icon: CalendarDays, label: 'Planning des départs', roles: ALL },
      { to: '/dashboard/echeancier', icon: Wallet, label: 'Échéancier', roles: ALL },
      { to: '/dashboard/pipeline', icon: KanbanSquare, label: 'Pipeline', roles: ALL },
      { to: '/dashboard/clients', icon: Users, label: 'Clients', roles: ALL },
      { to: '/dashboard/relances', icon: BellRing, label: 'Relances', roles: ALL },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/dashboard/packages', icon: Plane, label: 'Packages', roles: EDITORS },
      { to: '/dashboard/hotel', icon: Hotel, label: 'Hotels', roles: EDITORS },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/dashboard/settings', icon: Settings, label: 'Paramètres', roles: EDITORS },
      { to: '/dashboard/mail', icon: Mail, label: 'Mail Manager', roles: ADMIN },
      { to: '/dashboard/equipe', icon: UserCog, label: 'Équipe & accès', roles: ADMIN },
      { to: '/dashboard/journal', icon: ScrollText, label: "Journal d'activité", roles: ADMIN },
    ],
  },
]

export default function Sidebar() {
  const pending = usePendingReservations()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/logo-256.png" alt="Follow Me Travel" className={styles.logoImg} />
      </div>

      <nav className={styles.nav}>
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => hasRole(user, ...item.roles))
          if (!items.length) return null
          return (
            <div key={group.label} className={styles.navGroup}>
              <div className={styles.navGroupLabel}>{group.label}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <item.icon className={styles.navIcon} size={20} />
                  <span>{item.label}</span>
                  {item.badge && pending > 0 && (
                    <span className={styles.badge}>{pending}</span>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className={styles.bottom}>
        <NavLink target='_blank'
          to="/"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <ExternalLink className={styles.navIcon} size={20} />
          <span>ouvrir le site</span>
        </NavLink>
        <button type="button" onClick={handleLogout} className={`${styles.navItem} ${styles.logoutItem}`}>
          <LogOut className={styles.navIcon} size={20} />
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
