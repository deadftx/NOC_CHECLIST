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
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
