'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Activity, Server, Plus, RefreshCw, CheckCircle2, AlertTriangle, Clock, XOctagon, ChevronDown, ChevronUp } from 'lucide-react'

export default function JobsMonitorPage() {
  // Dashboard State
  const [servers, setServers] = useState([]) // { name, authType, sqlUser, sqlPass, status, error, data }
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('noc_jobs_servers')
    if (saved) {
      try { setServers(JSON.parse(saved)) } catch(e) {}
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('noc_jobs_servers', JSON.stringify(servers))
    }
  }, [servers, mounted])

  const [expandedServer, setExpandedServer] = useState(null)
  const [activePopover, setActivePopover] = useState(null) // { serverName, targetQuery }
  
  // Add Server Form State
  const [newServerName, setNewServerName] = useState('')
  const [newAuthType, setNewAuthType] = useState('AD')
  const [newSqlUser, setNewSqlUser] = useState('')
  const [newSqlPass, setNewSqlPass] = useState('')

  const handleAddServer = (e) => {
    e.preventDefault()
    if (!newServerName.trim()) return
    const sName = newServerName.trim()
    
    if (servers.some(s => s.name.toLowerCase() === sName.toLowerCase())) {
      alert("Servidor já adicionado.")
      return
    }

    if (newAuthType === 'SQL' && (!newSqlUser || !newSqlPass)) {
      alert("Para a autenticação SQL, preencha o Usuário e Senha.")
      return
    }
    
    setServers([...servers, { 
      name: sName,
      authType: newAuthType,
      sqlUser: newSqlUser,
      sqlPass: newSqlPass,
      status: 'idle', 
      error: null, 
      data: { running: null, errors: null, runningLong: null, canceled: null } 
    }])
    
    setNewServerName('')
    setNewSqlUser('')
    setNewSqlPass('')
    setNewAuthType('AD')
  }

  const fetchSingleQuery = async (serverObj, targetQuery) => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverName: serverObj.name,
        authType: serverObj.authType,
        sqlUser: serverObj.sqlUser,
        sqlPass: serverObj.sqlPass,
        targetQuery
      })
    })
    const result = await res.json()
    if (!result.success) throw new Error(result.error || "Erro desconhecido")
    return result.data
  }

  const handleRefreshSingle = async (serverName, targetQuery) => {
    setActivePopover(null)
    const serverObj = servers.find(s => s.name === serverName)
    if (!serverObj) return
    
    // Mostra o spinner apenas para o badge selecionado
    setServers(prev => prev.map(s => {
      if (s.name !== serverName) return s
      const newData = { ...s.data }
      if (targetQuery === 1) newData.running = null
      if (targetQuery === 2) newData.errors = null
      if (targetQuery === 3) newData.runningLong = null
      if (targetQuery === 4) newData.canceled = null
      return { ...s, data: newData }
    }))
    
    try {
      const qData = await fetchSingleQuery(serverObj, targetQuery)
      setServers(prev => prev.map(s => {
        if (s.name !== serverName) return s
        const newData = { ...s.data }
        if (targetQuery === 1) newData.running = qData
        if (targetQuery === 2) newData.errors = qData
        if (targetQuery === 3) newData.runningLong = qData
        if (targetQuery === 4) newData.canceled = qData
        return { ...s, data: newData }
      }))
    } catch (err) {
      alert("Erro ao atualizar: " + err.message)
      // Restaura array vazio no erro para tirar o spinner
      setServers(prev => prev.map(s => {
        if (s.name !== serverName) return s
        const newData = { ...s.data }
        if (targetQuery === 1) newData.running = []
        if (targetQuery === 2) newData.errors = []
        if (targetQuery === 3) newData.runningLong = []
        if (targetQuery === 4) newData.canceled = []
        return { ...s, data: newData }
      }))
    }
  }

  const fetchServerData = async (serverName) => {
    const serverObj = servers.find(s => s.name === serverName)
    if (!serverObj) return

    setServers(prev => prev.map(s => s.name === serverName ? { 
      ...s, 
      status: 'loading', 
      error: null, 
      data: { running: null, errors: null, runningLong: null, canceled: null } 
    } : s))
    
    try {
      const q1Data = await fetchSingleQuery(serverObj, 1)
      setServers(prev => prev.map(s => s.name === serverName ? { ...s, data: { ...s.data, running: q1Data } } : s))

      const q3Data = await fetchSingleQuery(serverObj, 3)
      setServers(prev => prev.map(s => s.name === serverName ? { ...s, data: { ...s.data, runningLong: q3Data } } : s))

      const q2Data = await fetchSingleQuery(serverObj, 2)
      setServers(prev => prev.map(s => s.name === serverName ? { ...s, data: { ...s.data, errors: q2Data } } : s))

      const q4Data = await fetchSingleQuery(serverObj, 4)
      setServers(prev => prev.map(s => s.name === serverName ? { ...s, status: 'success', data: { ...s.data, canceled: q4Data } } : s))

    } catch (err) {
      setServers(prev => prev.map(s => s.name === serverName ? { ...s, status: 'error', error: err.message } : s))
    }
  }

  const handleRefreshAll = () => {
    servers.forEach(s => fetchServerData(s.name))
  }

  const removeServer = (serverName) => {
    setServers(servers.filter(s => s.name !== serverName))
  }

  const toggleExpand = (serverName) => {
    if (expandedServer === serverName) setExpandedServer(null)
    else setExpandedServer(serverName)
  }

  const isAllLoaded = (data) => {
    return data.running !== null && data.errors !== null && data.runningLong !== null && data.canceled !== null
  }

  const renderBadge = (server, targetQuery, bgColor, IconComponent, count, label) => {
    const isHovered = activePopover?.serverName === server.name && activePopover?.targetQuery === targetQuery;
    const isLoading = count === null;

    return (
      <span 
        onClick={() => {
          if (isLoading) return;
          setActivePopover(isHovered ? null : { serverName: server.name, targetQuery })
        }}
        style={{ 
          background: count && count > 0 ? bgColor : 'rgba(255,255,255,0.1)', 
          color: '#fff', 
          padding: '4px 12px', 
          borderRadius: '16px', 
          fontSize: '0.85rem', 
          fontWeight: 'bold', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          cursor: isLoading ? 'default' : 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease',
          boxShadow: isHovered ? '0 0 0 2px var(--text-primary)' : 'none'
        }}
        title={`Clique para opções de ${label}`}
      >
        {isLoading ? <RefreshCw size={14} className="spinner" /> : <IconComponent size={14} />} 
        {isLoading ? 'Buscando...' : `${count} ${label}`}

        {/* Popover */}
        {isHovered && !isLoading && (
          <div style={{ 
            position: 'absolute', 
            bottom: '130%', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'var(--bg-color)', 
            padding: '8px', 
            borderRadius: '8px', 
            border: '1px solid var(--panel-border)', 
            boxShadow: '0 4px 16px rgba(0,0,0,0.8)', 
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '120px'
          }}>
            <button 
               className="btn" 
               style={{ fontSize: '0.8rem', padding: '6px 12px', width: '100%', justifyContent: 'center', background: 'var(--accent-color)' }}
               onClick={(e) => { e.stopPropagation(); handleRefreshSingle(server.name, targetQuery); }}
            >
               <RefreshCw size={14} style={{ marginRight: '6px' }}/> Atualizar
            </button>
            
            {/* Seta do popover (Tooltip arrow) */}
            <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: '10px', height: '10px', background: 'var(--bg-color)', borderBottom: '1px solid var(--panel-border)', borderRight: '1px solid var(--panel-border)' }}></div>
          </div>
        )}
      </span>
    )
  }

  return (
    <div className="container" style={{ padding: '20px 40px' }} onClick={() => setActivePopover(null)}>
      <div className="header-action">
        <Link href="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <Activity color="#a855f7" /> Monitor de Jobs SQL
        </h2>
      </div>

      <div>
        <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleAddServer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label className="form-label">Nome ou IP do Servidor</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: bdo01redspm" 
                  value={newServerName} 
                  onChange={(e) => setNewServerName(e.target.value)} 
                />
              </div>
              
              <div style={{ width: '250px' }}>
                <label className="form-label">Autenticação</label>
                <select className="form-select" value={newAuthType} onChange={(e) => setNewAuthType(e.target.value)}>
                  <option value="AD">Windows Authentication (AD)</option>
                  <option value="SQL">SQL Server Auth</option>
                </select>
              </div>

              {newAuthType === 'SQL' && (
                <>
                  <div style={{ width: '150px' }}>
                    <label className="form-label">Usuário</label>
                    <input type="text" className="form-input" value={newSqlUser} onChange={(e) => setNewSqlUser(e.target.value)} />
                  </div>
                  <div style={{ width: '150px' }}>
                    <label className="form-label">Senha</label>
                    <input type="password" className="form-input" value={newSqlPass} onChange={(e) => setNewSqlPass(e.target.value)} />
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-secondary" style={{ height: '50px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #a855f7', color: '#fff' }}>
                <Plus size={20} /> Adicionar Servidor
              </button>
            </div>
          </form>

          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn" 
              style={{ background: '#a855f7', height: '50px', opacity: servers.length === 0 ? 0.5 : 1 }} 
              onClick={handleRefreshAll}
              disabled={servers.length === 0}
            >
              <RefreshCw size={20} /> Atualizar Todos
            </button>
          </div>
        </div>

        {servers.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <Server size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <h3>Nenhum servidor monitorado</h3>
            <p>Adicione instâncias do SQL Server no painel acima definindo a autenticação específica de cada uma.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {servers.map(server => (
              <div key={server.name} className="glass-panel" style={{ padding: '0' }} onClick={(e) => e.stopPropagation()}>
                
                {/* Server Header */}
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: expandedServer === server.name ? '1px solid var(--panel-border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Server size={24} color="#a855f7" />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {server.name} 
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'normal' }}>
                          {server.authType}
                        </span>
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Status: 
                        {server.status === 'idle' && ' Aguardando atualização'}
                        {server.status === 'loading' && <span style={{ color: 'var(--warning-color)' }}> Conectando e Processando Histórico...</span>}
                        {server.status === 'success' && <span style={{ color: 'var(--success-color)' }}> Atualizado</span>}
                        {server.status === 'error' && <span style={{ color: 'var(--danger-color)' }}> Erro de Conexão</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    
                    {/* Resumo de Badges Sequenciais com Popover de clique */}
                    {(server.status === 'success' || server.status === 'loading') && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        
                        {renderBadge(server, 1, 'var(--success-color)', Activity, server.data.running ? server.data.running.length : null, 'Ativos')}
                        {renderBadge(server, 3, 'var(--warning-color)', Clock, server.data.runningLong ? server.data.runningLong.length : null, '>1h')}
                        {renderBadge(server, 2, 'var(--danger-color)', XOctagon, server.data.errors ? server.data.errors.length : null, 'Falhas')}
                        {renderBadge(server, 4, 'var(--warning-color)', AlertTriangle, server.data.canceled ? server.data.canceled.length : null, 'Canc.')}

                      </div>
                    )}

                    <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => fetchServerData(server.name)} title="Atualizar Servidor Completo">
                      <RefreshCw size={16} className={server.status === 'loading' ? 'spinner' : ''} />
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '8px', color: 'var(--danger-color)' }} onClick={() => removeServer(server.name)} title="Remover">
                      <XOctagon size={16} />
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => toggleExpand(server.name)}>
                      {expandedServer === server.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Detalhes do Servidor (Expandido) */}
                {expandedServer === server.name && (
                  <div style={{ padding: '20px' }}>
                    {server.status === 'error' && (
                      <div style={{ padding: '16px', background: 'var(--danger-bg)', color: 'var(--danger-color)', borderRadius: '8px', marginBottom: '16px' }}>
                        <strong>Erro:</strong> {server.error}
                      </div>
                    )}

                    {(server.status === 'success' || server.status === 'loading') && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                        
                        {/* Falhas */}
                        {server.data.errors && server.data.errors.length > 0 && (
                          <div>
                            <h4 style={{ color: 'var(--danger-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><XOctagon size={16}/> Jobs com Falha</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Job</th>
                                    <th>Data/Hora</th>
                                    <th>Mensagem</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {server.data.errors.map((job, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 'bold' }}>{job.Nome_do_Job}</td>
                                      <td>{new Date(job.Data_Hora_Erro).toLocaleString()}</td>
                                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.Mensagem_Erro}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Longos */}
                        {server.data.runningLong && server.data.runningLong.length > 0 && (
                          <div>
                            <h4 style={{ color: 'var(--warning-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16}/> Rodando a mais de 1 Hora</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Job</th>
                                    <th>Início</th>
                                    <th>Minutos Rodando</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {server.data.runningLong.map((job, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 'bold' }}>{job.Nome_do_Job}</td>
                                      <td>{new Date(job.Inicio_Execucao).toLocaleString()}</td>
                                      <td style={{ color: 'var(--warning-color)', fontWeight: 'bold' }}>{job.Minutos_Rodando} min</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Cancelados */}
                        {server.data.canceled && server.data.canceled.length > 0 && (
                          <div>
                            <h4 style={{ color: 'var(--warning-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16}/> Cancelados</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Job</th>
                                    <th>Data/Hora</th>
                                    <th>Mensagem</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {server.data.canceled.map((job, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 'bold' }}>{job.Nome_do_Job}</td>
                                      <td>{new Date(job.Data_Hora_Cancelamento).toLocaleString()}</td>
                                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.Mensagem_Cancelamento}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Rodando */}
                        {server.data.running && server.data.running.length > 0 && (
                          <div>
                            <h4 style={{ color: 'var(--success-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16}/> Em Execução Atualmente</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Job</th>
                                    <th>Início</th>
                                    <th>Minutos Rodando</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {server.data.running.map((job, idx) => (
                                    <tr key={idx}>
                                      <td style={{ fontWeight: 'bold' }}>{job.Nome_do_Job}</td>
                                      <td>{new Date(job.Inicio_Execucao).toLocaleString()}</td>
                                      <td>{job.Minutos_Rodando} min</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Tudo Limpo */}
                        {isAllLoaded(server.data) && server.data.errors.length === 0 && server.data.canceled.length === 0 && server.data.runningLong.length === 0 && server.data.running.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                            <CheckCircle2 size={40} color="var(--success-color)" style={{ marginBottom: '12px' }} />
                            <p>Nenhum job em execução, com falha ou cancelado.</p>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
