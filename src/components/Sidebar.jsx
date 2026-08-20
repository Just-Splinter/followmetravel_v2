import { NavLink, useNavigate } from 'react-router-dom'
import styles from '../styles/Sidebar.module.css'
import { usePendingReservations } from '../context/usePendingReservations'
import { useAuth } from '../context/AuthContext'
import { Mail, Settings, LayoutDashboard, Plane, ClipboardList, Hotel, ExternalLink, LogOut, Users } from 'lucide-react'

const NAV = [
  { to: '/dashboard/home', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/dashboard/reservations', icon: ClipboardList, label: 'Réservations', badge: true },
  { to: '/dashboard/clients', icon: Users, label: 'Clients' },
  { to: '/dashboard/packages', icon: Plane, label: 'Packages' },
  { to: '/dashboard/hotel', icon: Hotel, label: 'Hotels' },
]

export default function Sidebar() {
  const pending = usePendingReservations()
  const { logout } = useAuth()
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
        <div className={styles.navGroup}>
          <div className={styles.navGroupLabel}>Principal</div>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
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

        <div className={styles.navGroup}>
          <div className={styles.navGroupLabel}>Configuration</div>
          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Settings className={styles.navIcon} size={20} />
            <span>Paramètres</span>
          </NavLink>
          <NavLink
            to="/dashboard/mail"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Mail className={styles.navIcon} size={20} />
            <span>Mail Manager</span>
          </NavLink>
        </div>
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