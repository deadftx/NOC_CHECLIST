import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { Activity, Settings, Database } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'NOC Checklist Dashboard',
  description: 'Sistema de monitoramento e checklist estilo NOC',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <nav className="navbar">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ marginBottom: '2px' }}>
              <Activity className="status-blinker" style={{ margin: 0 }} size={20} />
              <span style={{ marginLeft: '12px' }}>NOC Control Center</span>
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '32px', marginTop: '-4px' }}>v1.0.2</span>
          </div>
          <div className="nav-links">
            <Link href="/">
              <Database size={18} />
              Dashboard
            </Link>
            <Link href="/control-panel">
              <Settings size={18} />
              Control Panel
            </Link>
            <Link href="/reports">
              <Activity size={18} />
              Histórico
            </Link>
            <Link href="/metrics">
              <Activity size={18} />
              Métricas
            </Link>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
