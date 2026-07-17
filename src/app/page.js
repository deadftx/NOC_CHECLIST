'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, PlayCircle, Info, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Dashboard() {
  const [alarms, setAlarms] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Estado do Gerador de Checklist
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTask, setCurrentTask] = useState('')
  const [taskTime, setTaskTime] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const configRes = await fetch('/api/config')
      const configData = await configRes.json()
      setConfig(configData)

      const alarmsRes = await fetch('/api/alarms')
      const alarmsData = await alarmsRes.json()
      setAlarms(Array.isArray(alarmsData) ? alarmsData : [])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 2 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    let timer;
    if (generating && currentTask) {
      timer = setInterval(() => {
        setTaskTime(prev => prev + 100) // Incrementa 100ms
      }, 100)
    }
    return () => clearInterval(timer)
  }, [generating, currentTask])

  const renderCellValue = (key, value) => {
    if (key.includes('DAT_') || value instanceof Date) {
      try {
        return format(new Date(value), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
      } catch (e) {
        return value
      }
    }
    return value
  }

  const handleGenerateChecklist = async () => {
    if (alarms.length === 0) return;
    
    setGenerating(true)
    setProgress(0)
    
    const batchId = crypto.randomUUID()
    const checklistResults = []

    for (let i = 0; i < alarms.length; i++) {
      const alarm = alarms[i]
      const comando = alarm.DSC_COMANDO_CHECAGEM

      setProgress(Math.round((i / alarms.length) * 100))
      
      if (comando && comando !== 'N/A') {
        setCurrentTask(`Rodando comando para: ${alarm.dsc_regra || 'Alarme ' + (i+1)}`)
        setTaskTime(0)

        try {
          const res = await fetch('/api/execute-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: comando, batchId })
          })
          const { data } = await res.json()
          
          checklistResults.push({
            alarm,
            grid: data || []
          })
        } catch (error) {
          checklistResults.push({ alarm, grid: [], error: 'Erro ao executar o comando.' })
        }
      } else {
        checklistResults.push({ alarm, grid: [] })
      }
    }

    setProgress(100)
    setCurrentTask('Gerando PDF...')

    // Gerar PDF
    const doc = new jsPDF()
    const dateStr = format(new Date(), "ddMM_HHmm")
    const title = `Relatório NOC - Checklist (${format(new Date(), "dd/MM/yyyy HH:mm")})`
    
    let currentY = 15
    doc.setFontSize(16)
    doc.text(title, 14, currentY)
    currentY += 15

    let displayColumns = []
    try {
      displayColumns = JSON.parse(config.columns)
    } catch(e) {
      displayColumns = ['dsc_regra', 'dsc_solucao', 'DAT_ULTIMA_EXECUCAO']
    }

    checklistResults.forEach((item, index) => {
      if (currentY > 270) {
        doc.addPage()
        currentY = 15
      }

      // Desenhar informações do Alarme (Colunas NOC)
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(`Alarme ${index + 1}: ${item.alarm.DSC_COMANDO_CHECAGEM || item.alarm.dsc_regra || 'Desconhecido'}`, 14, currentY)
      currentY += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      
      displayColumns.forEach(col => {
        if (col !== 'dsc_regra') {
           const val = renderCellValue(col, item.alarm[col])
           const text = `${col.replace(/_/g, ' ')}: ${val || 'N/A'}`
           
           // Quebra de linha se o texto for muito longo
           const splitText = doc.splitTextToSize(text, 180)
           doc.text(splitText, 14, currentY)
           currentY += (splitText.length * 5)
        }
      })
      currentY += 4

      // Desenhar o Grid
      if (item.grid && item.grid.length > 0) {
        const gridKeys = Object.keys(item.grid[0])
        const gridData = item.grid.map(row => gridKeys.map(k => String(row[k])))

        autoTable(doc, {
          startY: currentY,
          head: [gridKeys],
          body: gridData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 14, right: 14 }
        })
        currentY = doc.lastAutoTable.finalY + 15
      } else {
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text("Nenhum resultado retornado pelo grid.", 14, currentY)
        doc.setTextColor(0, 0, 0)
        currentY += 15
      }
    })

    const pdfFileName = `NOC_${dateStr}.pdf`
    doc.save(pdfFileName)
    
    try {
      const pdfDataUri = doc.output('datauristring')
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          fileName: pdfFileName,
          fileData: pdfDataUri,
          rawJsonData: JSON.stringify(checklistResults)
        })
      })
    } catch(e) {
      console.error('Erro ao salvar relatório no servidor', e)
    }
    
    setGenerating(false)
  }

  if (loading && !config) {
    return <div className="container">Carregando painel de monitoramento...</div>
  }

  if (!config || Object.keys(config).length === 0) {
    return (
      <div className="container">
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
          <Info size={48} style={{ color: 'var(--accent-color)', marginBottom: '20px' }} />
          <h2>Painel Não Configurado</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
            Acesse o Control Panel para configurar a origem dos dados do Dashboard.
          </p>
        </div>
      </div>
    )
  }

  let displayColumns = []
  try {
    displayColumns = JSON.parse(config.columns)
  } catch(e) {
    displayColumns = ['dsc_regra', 'dsc_solucao', 'DAT_ULTIMA_EXECUCAO']
  }

  return (
    <div className="container">
      {generating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', zIndex: 999, 
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '400px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--accent-color)' }}>Gerando Checklist...</h3>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '10px', borderRadius: '5px', marginBottom: '20px' }}>
              <div style={{ width: `${progress}%`, background: 'var(--success-color)', height: '100%', borderRadius: '5px', transition: 'width 0.3s' }}></div>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>{currentTask}</p>
            <p style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>
              {(taskTime / 1000).toFixed(1)}s
            </p>
            {progress === 100 && (
              <p style={{ color: 'var(--success-color)', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> Finalizado!
              </p>
            )}
          </div>
        </div>
      )}

      <div className="header-action">
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Monitoramento: {config.name}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Origem: <strong>{config.sourceType}</strong> • Última atualização: {format(lastUpdate, 'HH:mm:ss')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn" onClick={fetchData} disabled={loading || generating}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Atualizando...' : 'Atualizar Agora'}
          </button>
          
          <button className="btn" style={{ background: 'var(--success-color)' }} onClick={handleGenerateChecklist} disabled={loading || generating || alarms.length === 0}>
            <PlayCircle size={18} />
            GERAR CHECKLIST
          </button>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Status</th>
                {displayColumns.map(col => (
                  <th key={col}>{col.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alarms.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length + 1} style={{ textAlign: 'center', padding: '40px', color: 'var(--success-color)' }}>
                    Nenhum alarme crítico encontrado.
                  </td>
                </tr>
              ) : (
                alarms.map((alarm, idx) => (
                  <tr key={alarm.id || idx}>
                    <td style={{ textAlign: 'center' }}>
                      <div className="status-blinker" title="Alarme Crítico"></div>
                    </td>
                    {displayColumns.map(col => (
                      <td key={col}>{renderCellValue(col, alarm[col])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
