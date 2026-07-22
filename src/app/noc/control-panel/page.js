'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, Trash2, Plus } from 'lucide-react'

const AVAILABLE_COLUMNS = [
  'dsc_regra',
  'dsc_solucao',
  'DSC_SOLUCIONADO_POR',
  'DSC_COMANDO_CHECAGEM',
  'DSC_OBJETIVO_TECNICO',
  'DAT_ULTIMA_EXECUCAO'
]

export default function ControlPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)

  const [formData, setFormData] = useState({
    name: 'Dashboard Principal',
    sourceType: 'INTERNAL',
    serverName: '',
    dbName: '',
    query: '',
    authType: 'AD',
    domain: '',
    username: '',
    password: '',
    filePath: '',
    columns: AVAILABLE_COLUMNS
  })

  // Teams State
  const [teamsGroups, setTeamsGroups] = useState([])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamUrl, setNewTeamUrl] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/config')
        const data = await res.json()
        if (data && Object.keys(data).length > 0) {
          setFormData({
            ...data,
            columns: data.columns ? JSON.parse(data.columns) : AVAILABLE_COLUMNS
          })
        }

        const teamsRes = await fetch('/api/teams')
        const teamsData = await teamsRes.json()
        setTeamsGroups(teamsData || [])

      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (col) => {
    setFormData(prev => {
      const isChecked = prev.columns.includes(col)
      const newColumns = isChecked 
        ? prev.columns.filter(c => c !== col)
        : [...prev.columns, col]
      return { ...prev, columns: newColumns }
    })
  }

  const handleValidate = async () => {
    setValidating(true)
    setValidationResult(null)
    try {
      const payload = { ...formData, columns: JSON.stringify(formData.columns) }
      const res = await fetch('/api/validate-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      setValidationResult({ success: data.success, message: data.message || data.error })
    } catch (error) {
      setValidationResult({ success: false, message: 'Erro de rede ou servidor indisponível.' })
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    
    try {
      const payload = {
        ...formData,
        columns: JSON.stringify(formData.columns)
      }
      
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName || !newTeamUrl) return
    setAddingTeam(true)

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName, webhookUrl: newTeamUrl })
      })
      const group = await res.json()
      if (group.id) {
        setTeamsGroups(prev => [group, ...prev])
        setNewTeamName('')
        setNewTeamUrl('')
      }
    } catch (error) {
      console.error('Erro ao adicionar grupo:', error)
    } finally {
      setAddingTeam(false)
    }
  }

  const handleDeleteTeam = async (id) => {
    try {
      await fetch(`/api/teams/${id}`, { method: 'DELETE' })
      setTeamsGroups(prev => prev.filter(g => g.id !== id))
    } catch (error) {
      console.error('Erro ao remover grupo:', error)
    }
  }

  if (loading) {
    return <div className="container">Carregando painel de controle...</div>
  }

  return (
    <div className="container">
      <div className="header-action">
        <h2>Control Panel</h2>
      </div>

      <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>Configuração de Dados</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Nome do Dashboard</label>
            <input 
              type="text" 
              name="name" 
              className="form-input" 
              value={formData.name || ''} 
              onChange={handleChange} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Conexão (Fonte de Dados)</label>
            <select 
              name="sourceType" 
              className="form-select" 
              value={formData.sourceType || 'INTERNAL'} 
              onChange={handleChange}
            >
              <option value="INTERNAL">Banco Interno de Testes (Mock)</option>
              <option value="SQLSERVER">Microsoft SQL Server</option>
              <option value="EXCEL">Planilha Excel</option>
            </select>
          </div>

          {formData.sourceType === 'SQLSERVER' && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--panel-border)' }}>
              <h4 style={{ marginBottom: '16px', color: 'var(--accent-color)' }}>Configurações do Servidor</h4>
              <div className="form-group">
                <label className="form-label">Servidor (ex: bdp01redspm)</label>
                <input type="text" name="serverName" className="form-input" value={formData.serverName || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Base de Dados (ex: RED_NOC)</label>
                <input type="text" name="dbName" className="form-input" value={formData.dbName || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Procedure / Query (ex: SP_CON_VERIFICACAO_ERRO)</label>
                <input type="text" name="query" className="form-input" value={formData.query || ''} onChange={handleChange} />
              </div>
              
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ marginBottom: '12px' }}>Autenticação</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label className="checkbox-label">
                    <input type="radio" name="authType" value="AD" checked={formData.authType === 'AD'} onChange={handleChange} style={{ accentColor: 'var(--accent-color)' }} />
                    Logar via AD (Usuário Atual do Windows)
                  </label>
                  <label className="checkbox-label">
                    <input type="radio" name="authType" value="SQL" checked={formData.authType === 'SQL'} onChange={handleChange} style={{ accentColor: 'var(--accent-color)' }} />
                    Logar com Usuário e Senha
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <button type="button" className="btn" onClick={handleValidate} disabled={validating || !formData.serverName || !formData.dbName} style={{ background: 'var(--panel-border)', border: '1px solid var(--text-secondary)' }}>
                  {validating ? 'Testando Conexão...' : 'Validar Conexão'}
                </button>
                {validationResult && (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: validationResult.success ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)', color: validationResult.success ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.9rem', border: `1px solid ${validationResult.success ? 'var(--success-color)' : 'var(--danger-color)'}` }}>
                    {validationResult.success ? <CheckCircle size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'6px'}}/> : null}
                    <strong>{validationResult.success ? 'Sucesso: ' : 'Falha: '}</strong> {validationResult.message}
                  </div>
                )}
              </div>

              {formData.authType === 'SQL' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Domínio (opcional)</label>
                    <input type="text" name="domain" className="form-input" value={formData.domain || ''} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Usuário</label>
                    <input type="text" name="username" className="form-input" value={formData.username || ''} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Senha</label>
                    <input type="password" name="password" className="form-input" value={formData.password || ''} onChange={handleChange} />
                  </div>
                </div>
              )}
            </div>
          )}

          {formData.sourceType === 'EXCEL' && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--panel-border)' }}>
              <h4 style={{ marginBottom: '16px', color: 'var(--success-color)' }}>Configurações do Excel</h4>
              <div className="form-group">
                <label className="form-label">Caminho de Rede ou Caminho Local do Arquivo (.xlsx)</label>
                <input 
                  type="text" 
                  name="filePath" 
                  className="form-input" 
                  placeholder="ex: Z:\Shared\NOC\alarmes.xlsx" 
                  value={formData.filePath || ''} 
                  onChange={handleChange} 
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Nota: O sistema sempre lerá a última versão deste arquivo. Futuramente, será adicionado um botão de upload para sobrescrever o arquivo no servidor.
                </p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Colunas a Exibir no Dashboard</label>
            <div className="checkbox-group">
              {AVAILABLE_COLUMNS.map(col => (
                <label key={col} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={formData.columns.includes(col)}
                    onChange={() => handleCheckboxChange(col)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }}
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px', gap: '16px', alignItems: 'center' }}>
            {saved && (
              <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} /> Salvo com sucesso!
              </span>
            )}
            <button type="submit" className="btn" disabled={saving}>
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>Integração com Microsoft Teams</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Cadastre as URLs de Webhook dos canais do Teams para poder enviar relatórios de texto em um clique.
        </p>

        <form onSubmit={handleAddTeam} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Nome da Equipe / Canal</label>
            <input type="text" className="form-input" placeholder="Ex: NOC Nível 1" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} required />
          </div>
          <div style={{ flex: 2 }}>
            <label className="form-label">URL do Webhook</label>
            <input type="url" className="form-input" placeholder="https://seudominio.webhook.office.com/..." value={newTeamUrl} onChange={e => setNewTeamUrl(e.target.value)} required />
          </div>
          <button type="submit" className="btn" disabled={addingTeam} style={{ height: '46px', background: 'var(--success-color)' }}>
            <Plus size={18} />
            Adicionar
          </button>
        </form>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>URL do Webhook</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {teamsGroups.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Nenhum grupo cadastrado.</td>
                </tr>
              ) : (
                teamsGroups.map(group => (
                  <tr key={group.id}>
                    <td style={{ fontWeight: 500 }}>{group.name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{group.webhookUrl}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" onClick={() => handleDeleteTeam(group.id)} className="btn" style={{ padding: '8px', background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }} title="Remover">
                        <Trash2 size={16} />
                      </button>
                    </td>
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
