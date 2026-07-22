'use client'

import Link from 'next/link'
import { Activity, FileSpreadsheet, ArrowRight } from 'lucide-react'

export default function CentralDeApps() {
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '16px', background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Central de Aplicações
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Selecione a ferramenta que deseja utilizar no painel de controle centralizado.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', width: '100%', maxWidth: '900px' }}>
        
        {/* App: NOC Control Center */}
        <Link href="/noc" style={{ textDecoration: 'none' }}>
          <div className="glass-panel app-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--success-color)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '20px' }}>
                <Activity size={40} color="var(--success-color)" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 600 }}>NOC Dashboard</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', flex: 1 }}>
              Sistema de monitoramento e checklist estilo NOC. Execute verificações em lote, gere relatórios PDF e avalie as métricas de alarmes.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', color: 'var(--success-color)', fontWeight: 600, gap: '8px' }}>
              <span>Acessar Ferramenta</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* App: Importador XLSX */}
        <Link href="/importador" style={{ textDecoration: 'none' }}>
          <div className="glass-panel app-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-color)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '20px' }}>
                <FileSpreadsheet size={40} color="var(--accent-color)" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 600 }}>Importador XLSX</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', flex: 1 }}>
              Importe planilhas Excel dinamicamente para o SQL Server. Visualize os dados, defina os tipos das colunas e crie tabelas massivas rapidamente.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', color: 'var(--accent-color)', fontWeight: 600, gap: '8px' }}>
              <span>Acessar Ferramenta</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* App: Leitor de Retorno */}
        <Link href="/leitor-retorno" style={{ textDecoration: 'none' }}>
          <div className="glass-panel app-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--warning-color)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '20px' }}>
                <Activity size={40} color="var(--warning-color)" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 600 }}>Leitor CNAB 400</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', flex: 1 }}>
              Leia arquivos de retorno bancário (Bradesco) de forma instantânea. Visualize ocorrências, tarifas e valores pagos sem precisar de conexão com banco de dados.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', color: 'var(--warning-color)', fontWeight: 600, gap: '8px' }}>
              <span>Acessar Ferramenta</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* App: Monitor de Jobs */}
        <Link href="/jobs" style={{ textDecoration: 'none' }}>
          <div className="glass-panel app-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: '#a855f7' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '20px' }}>
                <Activity size={40} color="#a855f7" />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 600 }}>Monitor de Jobs</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', flex: 1 }}>
              Adicione múltiplos servidores e acompanhe os jobs do SQL Server Agent em tempo real. Identifique falhas, atrasos e execuções ativas.
            </p>
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', color: '#a855f7', fontWeight: 600, gap: '8px' }}>
              <span>Acessar Ferramenta</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </Link>

      </div>

      <style jsx>{`
        .app-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
