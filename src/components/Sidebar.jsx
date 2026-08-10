import { NavLink } from 'react-router-dom'
import styles from '../styles/Sidebar.module.css'
import { useApp } from '../context/AppContext'

const NAV = [
  { to: '/dashboard/home', icon: '⊞', label: 'Tableau de bord' },
  { to: '/dashboard/packages', icon: '✈', label: 'Packages' },
  { to: '/dashboard/reservations', icon: '📋', label: 'Réservations', badge: true },
  { to: '/dashboard/hotel', icon: '📋', label: 'Hotels', badge: true },

  { to: '/dashboard/clients', icon: '👥', label: 'Clients' },
]

export default function Sidebar() {
  const { stats } = useApp()

  return (
    <aside className={styles.sidebar}>
      {/* <div className={styles.logo}>
        <div className={styles.logoIcon}>✈</div>
        <div>
          <div className={styles.logoName}>Follow Me Travel</div>
        </div>
      </div> */}

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
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && stats.pendingReservations > 0 && (
                <span className={styles.badge}>{stats.pendingReservations}</span>
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
            <span className={styles.navIcon}>⚙</span>
            <span>Paramètres</span>
          </NavLink>
          <NavLink
            to="/dashboard/mail"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>⚙</span>
            <span>Mail Manager</span>
          </NavLink>
          <NavLink
            to="/dashboard/ads"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>⚙</span>
            <span>Meta Ads</span>
          </NavLink>
        </div>
      </nav>

      <div className={styles.bottom}>
        <NavLink target='_blanck'
          to="/"
          className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.navIcon}>⚙</span>
          <span>ouvrir le site</span>
        </NavLink>
        
      </div>
    </aside>
  )
}