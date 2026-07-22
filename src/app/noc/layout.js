import Link from 'next/link'
import { Activity, Settings, Database, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'NOC Checklist Dashboard',
  description: 'Sistema de monitoramento e checklist estilo NOC',
}

export default function NocLayout({ children }) {
  return (
    <>
      <nav className="navbar">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
            <Activity className="status-blinker" style={{ margin: 0 }} size={20} />
            <span style={{ marginLeft: '12px' }}>NOC Control Center</span>
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '32px', marginTop: '-4px' }}>v1.0.7</span>
        </div>
        <div className="nav-links">
          <Link href="/">
            <ArrowLeft size={18} />
            Central
          </Link>
          <Link href="/noc">
            <Database size={18} />
            Dashboard
          </Link>
          <Link href="/noc/control-panel">
            <Settings size={18} />
            Control Panel
          </Link>
          <Link href="/noc/reports">
            <Activity size={18} />
            Histórico
          </Link>
          <Link href="/noc/metrics">
            <Activity size={18} />
            Métricas
          </Link>
        </div>
      </nav>
      {children}
    </>
  )
}
