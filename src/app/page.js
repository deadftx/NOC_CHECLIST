'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, PlayCircle, Info, CheckCircle2, Download, Copy, Check, AlertTriangle, X } from 'lucide-react'
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

  const [lastResults, setLastResults] = useState([])
  const [copiedAlarmId, setCopiedAlarmId] = useState(null)
  const [generatingAlarm, setGeneratingAlarm] = useState(null)

  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [ignoredAlarms, setIgnoredAlarms] = useState([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ignoredNocAlarms')
      if (saved) setIgnoredAlarms(JSON.parse(saved))
    } catch (e) { }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const configRes = await fetch('/api/config')
      const configData = await configRes.json()
      setConfig(configData)

      const alarmsRes = await fetch('/api/alarms')
      let alarmsData = await alarmsRes.json()

      if (Array.isArray(alarmsData)) {
        alarmsData.sort((a, b) => {
          const nameA = (a.DSC_COMANDO_CHECAGEM || '').toString().toUpperCase()
          const nameB = (b.DSC_COMANDO_CHECAGEM || '').toString().toUpperCase()
          if (nameA < nameB) return -1
          if (nameA > nameB) return 1
          return 0
        })
        setAlarms(alarmsData)
      } else {
        setAlarms([])
      }
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

  const getAlarmValue = (alarm, key) => {
    if (!alarm || !key) return undefined;
    if (alarm[key] !== undefined) return alarm[key];
    if (alarm[key.toLowerCase()] !== undefined) return alarm[key.toLowerCase()];
    if (alarm[key.toUpperCase()] !== undefined) return alarm[key.toUpperCase()];
    return undefined;
  }

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

    setShowChecklistModal(false)

    const alarmsToRun = alarms.filter((a, i) => {
      const key = a.DSC_COMANDO_CHECAGEM || a.dsc_regra || String(i)
      return !ignoredAlarms.includes(key)
    })

    if (alarmsToRun.length === 0) return;

    setGenerating(true)
    setProgress(0)

    const batchId = crypto.randomUUID()
    const checklistResults = []

    for (let i = 0; i < alarmsToRun.length; i++) {
      const alarm = alarmsToRun[i]
      const comando = alarm.DSC_COMANDO_CHECAGEM

      setProgress(Math.round((i / alarmsToRun.length) * 100))

      if (comando && comando !== 'N/A') {
        setCurrentTask(`Rodando comando para: ${alarm.dsc_regra || 'Alarme ' + (i + 1)}`)
        setTaskTime(0)

        try {
          const res = await fetch('/api/execute-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: comando, batchId })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Erro desconhecido na API' }))
            checklistResults.push({ alarm, grid: [], error: errData.error || `HTTP ${res.status}` })
            continue;
          }

          const { data } = await res.json()

          checklistResults.push({
            alarm,
            grid: data || []
          })
        } catch (error) {
          checklistResults.push({ alarm, grid: [], error: error.message || 'Erro ao executar o comando.' })
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
    } catch (e) {
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

      const objetivo = item.alarm.DSC_OBJETIVO_TECNICO || item.alarm.dsc_objetivo_tecnico;
      if (objetivo) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "italic")
        const splitObjetivo = doc.splitTextToSize(`Objetivo: ${objetivo}`, 180)
        doc.text(splitObjetivo, 14, currentY)
        currentY += (splitObjetivo.length * 5)
      }

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
      if (item.error) {
        doc.setFontSize(10)
        doc.setTextColor(231, 76, 60)
        doc.text(`Erro na execucao: ${item.error}`, 14, currentY)
        doc.setTextColor(0, 0, 0)
        currentY += 15
      } else if (item.grid && item.grid.length > 0) {
        const gridKeys = Object.keys(item.grid[0])
        const totalRows = item.grid.length;
        const visibleGrid = item.grid.slice(0, 3);
        const gridData = visibleGrid.map(row => gridKeys.map(k => String(row[k])))

        autoTable(doc, {
          startY: currentY,
          head: [gridKeys],
          body: gridData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 14, right: 14 }
        })
        currentY = doc.lastAutoTable.finalY + 5;

        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(`Mostrando ${visibleGrid.length} de ${totalRows} resultado(s).`, 14, currentY)
        doc.setTextColor(0, 0, 0)
        currentY += 10
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
    } catch (e) {
      console.error('Erro ao salvar relatório no servidor', e)
    }

    setLastResults(checklistResults)
    setGenerating(false)
  }

  const handleGenerateSingleChecklist = async (alarm) => {
    setGeneratingAlarm(alarm)
    const batchId = crypto.randomUUID()
    const comando = alarm.DSC_COMANDO_CHECAGEM
    let resultItem = { alarm, grid: [] }

    if (comando && comando !== 'N/A') {
      try {
        const res = await fetch('/api/execute-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: comando, batchId })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Erro desconhecido na API' }))
          resultItem.error = errData.error || `HTTP ${res.status}`
        } else {
          const { data } = await res.json()
          resultItem.grid = data || []
        }
      } catch (error) {
        resultItem.error = error.message || 'Erro ao executar o comando.'
      }
    }

    setLastResults(prev => {
      const filtered = prev.filter(r => r.alarm !== alarm)
      return [...filtered, resultItem]
    })

    const doc = new jsPDF()
    const dateStr = format(new Date(), "ddMM_HHmm")
    const title = `Relatório NOC Individual (${format(new Date(), "dd/MM/yyyy HH:mm")})`

    let currentY = 15
    doc.setFontSize(16)
    doc.text(title, 14, currentY)
    currentY += 15

    let displayColumns = []
    try {
      displayColumns = JSON.parse(config.columns)
    } catch (e) {
      displayColumns = ['dsc_regra', 'dsc_solucao', 'DAT_ULTIMA_EXECUCAO']
    }

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`Alarme: ${resultItem.alarm.DSC_COMANDO_CHECAGEM || resultItem.alarm.dsc_regra || 'Desconhecido'}`, 14, currentY)
    currentY += 8

    const objetivo = resultItem.alarm.DSC_OBJETIVO_TECNICO || resultItem.alarm.dsc_objetivo_tecnico;
    if (objetivo) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "italic")
      const splitObjetivo = doc.splitTextToSize(`Objetivo: ${objetivo}`, 180)
      doc.text(splitObjetivo, 14, currentY)
      currentY += (splitObjetivo.length * 5)
    }

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    displayColumns.forEach(col => {
      if (col !== 'dsc_regra') {
        const val = renderCellValue(col, resultItem.alarm[col])
        const text = `${col.replace(/_/g, ' ')}: ${val || 'N/A'}`
        const splitText = doc.splitTextToSize(text, 180)
        doc.text(splitText, 14, currentY)
        currentY += (splitText.length * 5)
      }
    })
    currentY += 4

    if (resultItem.error) {
      doc.setFontSize(10)
      doc.setTextColor(231, 76, 60)
      doc.text(`Erro na execucao: ${resultItem.error}`, 14, currentY)
      doc.setTextColor(0, 0, 0)
    } else if (resultItem.grid && resultItem.grid.length > 0) {
      const gridKeys = Object.keys(resultItem.grid[0])
      const totalRows = resultItem.grid.length;
      const visibleGrid = resultItem.grid.slice(0, 3);
      const gridData = visibleGrid.map(row => gridKeys.map(k => String(row[k])))

      autoTable(doc, {
        startY: currentY,
        head: [gridKeys],
        body: gridData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 14, right: 14 }
      })
      currentY = doc.lastAutoTable.finalY + 5;

      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Mostrando ${visibleGrid.length} de ${totalRows} resultado(s).`, 14, currentY)
      doc.setTextColor(0, 0, 0)
    } else {
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text("Nenhum resultado retornado pelo grid.", 14, currentY)
      doc.setTextColor(0, 0, 0)
    }

    const pdfFileName = `NOC_Indiv_${dateStr}.pdf`

    try {
      const pdfDataUri = doc.output('datauristring')
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          fileName: pdfFileName,
          fileData: pdfDataUri,
          rawJsonData: JSON.stringify([resultItem])
        })
      })
    } catch (e) {
      console.error('Erro ao salvar relatório no servidor', e)
    }

    setGeneratingAlarm(null)
  }

  const handleGenerateErrorPDF = (result) => {
    const doc = new jsPDF()
    const title = `Relatorio de Erro - NOC`
    doc.setFontSize(16)
    doc.text(title, 14, 15)

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(`Alarme: ${result.alarm.DSC_COMANDO_CHECAGEM || result.alarm.dsc_regra || 'Desconhecido'}`, 14, 25)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    let currentY = 35

    // Add Alarm info
    let columns = []
    try {
      columns = JSON.parse(config.columns)
    } catch (e) {
      columns = ['dsc_regra', 'dsc_solucao', 'DAT_ULTIMA_EXECUCAO']
    }

    columns.forEach(col => {
      const text = `${col.replace(/_/g, ' ')}: ${renderCellValue(col, result.alarm[col]) || 'N/A'}`
      const splitText = doc.splitTextToSize(text, 180)
      doc.text(splitText, 14, currentY)
      currentY += (splitText.length * 5)
    })

    currentY += 10
    doc.setFontSize(11)
    doc.setTextColor(231, 76, 60)
    doc.setFont("helvetica", "bold")
    doc.text("Mensagem de Erro:", 14, currentY)
    currentY += 6
    doc.setFont("helvetica", "normal")
    const errorText = doc.splitTextToSize(result.error, 180)
    doc.text(errorText, 14, currentY)

    doc.save(`Erro_NOC_${result.alarm.id || 'Unknown'}.pdf`)
  }

  const handleCopyError = async (result) => {
    try {
      const alarmTitle = result.alarm.DSC_COMANDO_CHECAGEM || result.alarm.dsc_regra || 'Desconhecido'
      const objetivo = result.alarm.DSC_OBJETIVO_TECNICO || result.alarm.dsc_objetivo_tecnico
      const solucionadoPor = result.alarm.DSC_SOLUCIONADO_POR || result.alarm.dsc_solucionado_por

      let messageText = `Relatório de Erro - NOC\nAlarme: ${alarmTitle}\n`
      if (objetivo) messageText += `Objetivo: ${objetivo}\n`
      if (solucionadoPor && String(solucionadoPor).trim() !== '') messageText += `Solucionado Por: ${solucionadoPor}\n`
      messageText += `Erro: ${result.error}`

      let htmlContent = `
        <div style="font-family: sans-serif;">
          <h3 style="color: #c0392b;">Relatório de Erro - NOC</h3>
          <p><strong>Alarme:</strong> ${alarmTitle}</p>
      `
      if (objetivo) htmlContent += `<p><em>Objetivo:</em> ${objetivo}</p>`
      if (solucionadoPor && String(solucionadoPor).trim() !== '') htmlContent += `<p><em>Solucionado Por:</em> ${solucionadoPor}</p>`
      htmlContent += `
          <p><strong>Erro:</strong> ${result.error}</p>
        </div>
      `
      const blobHtml = new Blob([htmlContent], { type: 'text/html' })
      const blobText = new Blob([messageText], { type: 'text/plain' })
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]
      await navigator.clipboard.write(data)
      setCopiedAlarmId(result.alarm.id)
      setTimeout(() => setCopiedAlarmId(null), 2000)
    } catch (e) {
      console.error('Erro ao copiar dados:', e)
    }
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
  } catch (e) {
    displayColumns = ['dsc_regra', 'dsc_solucao', 'DAT_ULTIMA_EXECUCAO']
  }

  return (
    <div className="container">
      {showChecklistModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--accent-color)' }}>Selecionar Checklists</h3>
              <button onClick={() => setShowChecklistModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Desmarque os checklists que você NÃO quer rodar agora. Suas preferências ficarão salvas no navegador.
            </p>
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '20px', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '10px' }}>
              {alarms.map((alarm, idx) => {
                const key = alarm.DSC_COMANDO_CHECAGEM || alarm.dsc_regra || String(idx)
                const isIgnored = ignoredAlarms.includes(key)
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px', cursor: 'pointer', borderBottom: '1px solid var(--panel-border)' }}>
                    <input
                      type="checkbox"
                      checked={!isIgnored}
                      onChange={(e) => {
                        const isChecked = e.target.checked
                        let newIgnored
                        if (isChecked) {
                          newIgnored = ignoredAlarms.filter(id => id !== key)
                        } else {
                          newIgnored = [...ignoredAlarms, key]
                        }
                        setIgnoredAlarms(newIgnored)
                        localStorage.setItem('ignoredNocAlarms', JSON.stringify(newIgnored))
                      }}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ color: isIgnored ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: isIgnored ? 'line-through' : 'none', fontWeight: isIgnored ? 'normal' : '500' }}>
                      {alarm.DSC_COMANDO_CHECAGEM || alarm.dsc_regra || `Alarme ${idx + 1}`}
                    </span>
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {alarms.filter((a, i) => !ignoredAlarms.includes(a.DSC_COMANDO_CHECAGEM || a.dsc_regra || String(i))).length} de {alarms.length} selecionados
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowChecklistModal(false)}>Cancelar</button>
                <button className="btn" style={{ background: 'var(--success-color)' }} onClick={handleGenerateChecklist} disabled={alarms.filter((a, i) => !ignoredAlarms.includes(a.DSC_COMANDO_CHECAGEM || a.dsc_regra || String(i))).length === 0}>
                  <PlayCircle size={18} /> GERAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

          <button className="btn" style={{ background: 'var(--success-color)' }} onClick={() => setShowChecklistModal(true)} disabled={loading || generating || alarms.length === 0}>
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
                <th style={{ width: '250px', textAlign: 'center' }}>Ações (Status)</th>
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
                alarms.map((alarm, idx) => {
                  const result = lastResults.find(r => r.alarm === alarm)
                  return (
                    <tr key={alarm.id || idx}>
                      <td style={{ textAlign: 'center' }}>
                        <div className={result?.error ? "status-blinker error" : "status-blinker"} title={result?.error ? "Erro de Execução" : "Alarme Crítico"} style={result?.error ? { background: 'var(--danger-color)', boxShadow: '0 0 10px var(--danger-color)' } : {}}></div>
                      </td>
                      {displayColumns.map(col => (
                        <td key={col}>{renderCellValue(col, getAlarmValue(alarm, col))}</td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => handleGenerateSingleChecklist(alarm)}
                            className="btn"
                            disabled={generatingAlarm === alarm || generating}
                            style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--accent-color)' }}
                            title="Rodar NOC"
                          >
                            {generatingAlarm === alarm ? (
                              <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <PlayCircle size={14} />
                            )}
                            Rodar
                          </button>

                          {result?.error ? (
                            <>
                              <button onClick={() => handleGenerateErrorPDF(result)} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--danger-color)' }} title="Baixar PDF do Erro">
                                <Download size={14} /> PDF
                              </button>
                              <button onClick={() => handleCopyError(result)} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: copiedAlarmId === alarm.id ? 'var(--success-color)' : 'var(--panel-border)', color: 'var(--text-primary)' }} title="Copiar Erro">
                                {copiedAlarmId === alarm.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </>
                          ) : result ? (
                            <span style={{ color: 'var(--success-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginLeft: '4px' }}>
                              <CheckCircle2 size={14} /> OK
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
