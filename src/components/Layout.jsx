import "../services/adminAssets";
import { Suspense, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import DetailModalProvider from './detail/DetailModalProvider'
import styles from '../styles/Layout.module.css'
import '../styles/admin-theme.css'

export default function Layout() {
  // Design system admin (styles/admin-theme.css) : actif tant que le
  // dashboard est affiché, modales rendues hors du conteneur comprises.
  useEffect(() => {
    document.body.classList.add('adm')
    return () => document.body.classList.remove('adm')
  }, [])

  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <main className={styles.content}>
          {/* Inside the shell, not around it: every back-office page is a lazy
              chunk, and a Suspense above Layout would blank the sidebar on
              each navigation. */}
          {/* Modale de détail commune : réservation, package, hôtel, client
              s'ouvrent depuis n'importe quel tableau, sans quitter la page. */}
          <DetailModalProvider>
            <Suspense fallback={<div className={styles.pending}>Chargement…</div>}>
              <Outlet />
            </Suspense>
          </DetailModalProvider>
        </main>
      </div>
    </div>
  )
}
