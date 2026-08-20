import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from '../styles/Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <main className={styles.content}>
          {/* Inside the shell, not around it: every back-office page is a lazy
              chunk, and a Suspense above Layout would blank the sidebar on
              each navigation. */}
          <Suspense fallback={<div className={styles.pending}>Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
