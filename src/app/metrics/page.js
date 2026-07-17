'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Clock, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function MetricsPage() {
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics')
        const data = await res.json()
        setMetrics(data)
      } catch (error) {
        console.error('Erro ao buscar métricas:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  if (loading) {
    return <div className="container">Carregando métricas...</div>
  }

  // Agrupamento por BatchID para visualizar a geração de checklist
  const batches = metrics.reduce((acc, metric) => {
    if (!acc[metric.batchId]) {
      acc[metric.batchId] = {
        batchId: metric.batchId,
        startedAt: metric.startedAt,
        items: []
      }
    }
    acc[metric.batchId].items.push(metric)
    return acc
  }, {})

  const sortedBatches = Object.values(batches).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

  return (
    <div className="container">
      <div className="header-action">
        <h2>
          <BarChart3 style={{ display: 'inline', marginRight: '10px' }} />
          Métricas de Execução (Checklists)
        </h2>
      </div>

      {sortedBatches.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Nenhuma métrica registrada. Tente gerar um checklist no Dashboard.
        </div>
      ) : (
        sortedBatches.map(batch => (
          <div key={batch.batchId} className="glass-panel" style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} />
              Checklist gerado em: {format(new Date(batch.startedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </h4>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Comando Executado (DSC_COMANDO_CHECAGEM)</th>
                    <th style={{ width: '200px' }}>Tempo de Execução</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{item.comandoChecagem}</td>
                      <td>
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          color: item.durationMs > 2000 ? 'var(--danger-color)' : (item.durationMs > 1000 ? '#eab308' : 'var(--success-color)')
                        }}>
                          <Clock size={16} />
                          {item.durationMs} ms
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
