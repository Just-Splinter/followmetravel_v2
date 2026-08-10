import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from '../styles/Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}