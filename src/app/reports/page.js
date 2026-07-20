'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Filter, Search, Send, X, CheckCircle2, Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtros de Data
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Teams Modal State
  const [teamsGroups, setTeamsGroups] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [sendingToTeams, setSendingToTeams] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState('')
  const [copiedReportId, setCopiedReportId] = useState(null)

  const fetchReports = async () => {
    setLoading(true)
    try {
      let url = '/api/reports?'
      if (startDate) url += `startDate=${startDate}&`
      if (endDate) url += `endDate=${endDate}`

      const res = await fetch(url)
      const data = await res.json()
      setReports(data)
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamsGroups = async () => {
    try {
      const res = await fetch('/api/teams')
      const data = await res.json()
      setTeamsGroups(data || [])
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].id)
      }
    } catch (error) {
      console.error('Erro ao buscar grupos do Teams:', error)
    }
  }

  useEffect(() => {
    fetchReports()
    fetchTeamsGroups()
  }, [])

  const handleFilter = (e) => {
    e.preventDefault()
    fetchReports()
  }

  const handleSendToTeams = async () => {
    if (!selectedReportId || !selectedGroupId) return
    setSendingToTeams(true)
    setSendError('')
    setSendSuccess(false)

    try {
      const res = await fetch('/api/teams/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReportId, groupId: selectedGroupId })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido ao enviar.')
      
      setSendSuccess(true)
      setTimeout(() => {
        setSelectedReportId(null)
        setSendSuccess(false)
      }, 2000)

    } catch (error) {
      setSendError(error.message)
    } finally {
      setSendingToTeams(false)
    }
  }

  const handleCopyToClipboard = async (report) => {
    try {
      const checklistResults = JSON.parse(report.rawJsonData);
      
      let messageText = `Resumo de Execução do NOC\nGerado em: ${new Date(report.createdAt).toLocaleString('pt-BR')}\n\n`;
      let htmlContent = `<div style="font-family: sans-serif;">
        <h2 style="color: #333;">Resumo de Execução do NOC</h2>
        <p style="color: #666; font-size: 14px;"><em>Gerado em: ${new Date(report.createdAt).toLocaleString('pt-BR')}</em></p>
        <hr style="border: 1px solid #eee; margin: 16px 0;" />
      `;

      checklistResults.forEach((item, index) => {
        const alarmTitle = item.alarm.DSC_COMANDO_CHECAGEM || item.alarm.dsc_regra || 'Desconhecido';
        const objetivo = item.alarm.DSC_OBJETIVO_TECNICO || item.alarm.dsc_objetivo_tecnico;
        const solucionadoPor = item.alarm.DSC_SOLUCIONADO_POR || item.alarm.dsc_solucionado_por;

        messageText += `Alarme ${index + 1}: ${alarmTitle}\n`;
        htmlContent += `<h3 style="color: #2c3e50; margin-top: 24px; margin-bottom: 8px;">Alarme ${index + 1}: ${alarmTitle}</h3>`;

        if (objetivo) {
          messageText += `Objetivo: ${objetivo}\n`;
          htmlContent += `<p style="margin: 0 0 4px 0; color: #555;"><em>Objetivo:</em> ${objetivo}</p>`;
        }
        
        if (solucionadoPor && String(solucionadoPor).trim() !== '') {
          messageText += `Solucionado Por: ${solucionadoPor}\n`;
          htmlContent += `<p style="margin: 0 0 12px 0; color: #555;"><em>Solucionado Por:</em> ${solucionadoPor}</p>`;
        }

        messageText += `\n`;
        
        if (item.grid && item.grid.length > 0) {
          const headers = Object.keys(item.grid[0]);
          const totalRows = item.grid.length;
          const visibleGrid = item.grid.slice(0, 3);
          
          // Fallback de texto puro (sem formatação markdown bruta)
          messageText += headers.join(' | ') + '\n';
          
          // HTML Table Perfeita para o Teams
          htmlContent += `
            <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-bottom: 8px;">
              <thead>
                <tr>
                  ${headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; text-align: left; font-weight: 600;">${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
          `;
          
          visibleGrid.forEach(row => {
            messageText += headers.map(h => String(row[h] || '').replace(/\n/g, ' ')).join(' | ') + '\n';
            htmlContent += `
                <tr>
                  ${headers.map(h => `<td style="border: 1px solid #ddd; padding: 8px;">${String(row[h] || '').replace(/\n/g, '<br/>')}</td>`).join('')}
                </tr>
            `;
          });
          
          messageText += `Mostrando ${visibleGrid.length} de ${totalRows} resultado(s).\n\n`;
          htmlContent += `</tbody></table>
            <p style="margin-top: 0; font-size: 12px; color: #666; margin-bottom: 24px;">Mostrando ${visibleGrid.length} de ${totalRows} resultado(s).</p>
          `;
        } else {
          messageText += `Nenhum resultado retornado pelo grid.\n\n`;
          htmlContent += `<p style="color: #888;"><em>Nenhum resultado retornado pelo grid.</em></p>`;
        }
      });
      
      htmlContent += `</div>`;

      // Escrever HTML e Texto na área de transferência
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([messageText], { type: 'text/plain' });
      const data = [new ClipboardItem({ 
        'text/html': blobHtml, 
        'text/plain': blobText 
      })];

      await navigator.clipboard.write(data);
      
      setCopiedReportId(report.id);
      setTimeout(() => {
        setCopiedReportId(null);
      }, 2000);
    } catch (e) {
      console.error('Erro ao copiar dados:', e);
    }
  }

  return (
    <div className="container">
      {/* Modal do Teams */}
      {selectedReportId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', zIndex: 999, 
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-panel" style={{ width: '500px', position: 'relative' }}>
            <button 
              onClick={() => setSelectedReportId(null)} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ marginBottom: '20px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={24} /> Enviar Relatório via Teams
            </h3>

            {teamsGroups.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                Nenhum grupo do Teams cadastrado. Vá até o Control Panel para adicionar a URL de Webhook de uma equipe.
              </p>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Selecione o Grupo/Canal de Destino</label>
                  <select 
                    className="form-select" 
                    value={selectedGroupId} 
                    onChange={e => setSelectedGroupId(e.target.value)}
                  >
                    {teamsGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    O relatório será enviado em formato de texto nativo, contendo todas as linhas retornadas, para facilitar a leitura direto no chat.
                  </p>
                </div>

                {sendError && (
                  <div style={{ padding: '12px', background: 'rgba(231, 76, 60, 0.2)', borderLeft: '4px solid var(--danger-color)', color: 'var(--danger-color)', marginBottom: '16px' }}>
                    {sendError}
                  </div>
                )}

                {sendSuccess ? (
                  <div style={{ textAlign: 'center', color: 'var(--success-color)', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.1rem' }}>
                    <CheckCircle2 size={24} /> Enviado com sucesso!
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button className="btn" onClick={handleSendToTeams} disabled={sendingToTeams} style={{ background: 'var(--success-color)' }}>
                      {sendingToTeams ? 'Enviando...' : 'Confirmar Envio'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


      <div className="header-action">
        <h2>
          <FileText style={{ display: 'inline', marginRight: '10px' }} />
          Histórico de Checklists
        </h2>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Data Inicial</label>
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Data Final</label>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <button type="submit" className="btn" disabled={loading} style={{ height: '46px' }}>
            <Search size={18} />
            Filtrar
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ height: '46px' }}
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setTimeout(fetchReports, 100)
            }}
          >
            Limpar
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Carregando...</div>
      ) : reports.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Nenhum checklist encontrado no período selecionado.
        </div>
      ) : (
        <div className="glass-panel">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome do Arquivo</th>
                  <th>Data de Geração</th>
                  <th style={{ width: '250px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 500 }}>{report.fileName}</td>
                    <td>
                      {format(new Date(report.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                      <a href={report.filePath} download={report.fileName} className="btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} title="Baixar PDF">
                        <Download size={16} /> PDF
                      </a>
                      
                      {report.rawJsonData ? (
                        <>
                          <button 
                            onClick={() => setSelectedReportId(report.id)} 
                            className="btn" 
                            style={{ padding: '8px 16px', fontSize: '0.9rem', background: '#5a5eb9' }}
                            title="Enviar via Webhook"
                          >
                            <Send size={16} /> Teams
                          </button>
                          
                          <button 
                            onClick={() => handleCopyToClipboard(report)} 
                            className="btn" 
                            style={{ 
                              padding: '8px 16px', 
                              fontSize: '0.9rem', 
                              background: copiedReportId === report.id ? 'var(--success-color)' : 'var(--panel-border)',
                              color: 'var(--text-primary)'
                            }}
                            title="Copiar texto para colar em qualquer lugar"
                          >
                            {copiedReportId === report.id ? <Check size={16} /> : <Copy size={16} />}
                            {copiedReportId === report.id ? 'Copiado!' : 'Copiar'}
                          </button>
                        </>
                      ) : (
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                            JSON Indisponível
                         </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
