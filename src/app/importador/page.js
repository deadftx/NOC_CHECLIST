'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Database, Upload, FileSpreadsheet, PlayCircle, CheckCircle2, AlertTriangle, X, ShieldCheck, ShieldAlert, StopCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

const SQL_TYPES = [
  'VARCHAR(MAX)',
  'INT',
  'DATETIME',
  'DECIMAL(18,2)',
  'BIT',
  'FLOAT'
]

export default function ImportadorPage() {
  const [step, setStep] = useState(1)
  
  // Conexao DB
  const [dbConfig, setDbConfig] = useState({
    serverName: '',
    dbName: '',
    authType: 'AD',
    domain: '',
    username: '',
    password: ''
  })
  
  // Validacao AD / SQL
  const [isValidated, setIsValidated] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  
  // Cancelamento
  const abortControllerRef = useRef(null)

  // Arquivo XLSX
  const [fileName, setFileName] = useState('')
  const [columns, setColumns] = useState([]) // { name, type }
  const [previewData, setPreviewData] = useState([])
  const [allData, setAllData] = useState([])

  // Modal / Criacao
  const [showModal, setShowModal] = useState(false)
  const [tableName, setTableName] = useState('')
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null) // { success: true/false, message: '' }

  const handleDbChange = (e) => {
    setDbConfig({ ...dbConfig, [e.target.name]: e.target.value })
    setIsValidated(false)
    setValidationResult(null)
  }

  const handleValidate = async () => {
    setValidating(true)
    setValidationResult(null)
    try {
      const res = await fetch('/api/validate-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dbConfig, sourceType: 'SQLSERVER' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsValidated(true)
        setValidationResult({ success: true, message: 'Conexão validada com sucesso!' })
      } else {
        setValidationResult({ success: false, message: data.error || data.message || 'Erro de conexão' })
      }
    } catch (err) {
      setValidationResult({ success: false, message: 'Falha de rede ao validar' })
    } finally {
      setValidating(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws, { defval: null })
        
        if (data.length > 0) {
          const cols = Object.keys(data[0]).map(k => ({ name: k, type: 'VARCHAR(MAX)' }))
          setColumns(cols)
          setPreviewData(data.slice(0, 5))
          setAllData(data)
          setStep(3) // Vai direto pra validação
        }
      } catch (err) {
        alert('Erro ao ler arquivo XLSX: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleTypeChange = (idx, newType) => {
    const newCols = [...columns]
    newCols[idx].type = newType
    setColumns(newCols)
  }

  const handleCreate = async () => {
    if (!tableName) return
    setCreating(true)
    setProgress(10)
    
    abortControllerRef.current = new AbortController()
    
    try {
      // Simulate progress for UI
      const interval = setInterval(() => {
        setProgress(p => p < 90 ? p + 10 : p)
      }, 500)

      const payload = {
        config: dbConfig,
        tableName,
        columns,
        data: allData
      }

      const res = await fetch('/api/importador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      })

      clearInterval(interval)
      setProgress(100)

      const resultData = await res.json()

      if (!res.ok || !resultData.success) {
        setResult({ success: false, message: resultData.error || resultData.message || 'Erro desconhecido' })
      } else {
        setResult({ success: true, message: `Tabela criada e populada com sucesso: ${dbConfig.dbName}.${tableName} (${allData.length} linhas)` })
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        setResult({ success: false, message: 'Operação de criação abortada (PARADA DE EMERGÊNCIA).' })
      } else {
        setResult({ success: false, message: 'Erro ao chamar a API: ' + err.message })
      }
    } finally {
      setTimeout(() => {
        setCreating(false)
        setShowModal(false)
      }, 1000)
    }
  }

  const handleStopEmergency = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const resetImport = () => {
    setFileName('')
    setColumns([])
    setPreviewData([])
    setAllData([])
    setTableName('')
    setResult(null)
    setStep(2)
  }

  return (
    <div className="container" style={{ padding: '20px 40px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '24px' }}>
        <Link href="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <FileSpreadsheet color="var(--accent-color)" /> Importador XLSX
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: '4px', background: step >= s ? 'var(--accent-color)' : 'var(--panel-border)', borderRadius: '2px', transition: 'background 0.3s' }}></div>
        ))}
      </div>

      {step === 1 && (
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} /> Conexão SQL Server
          </h3>
          
          <div className="form-group">
            <label className="form-label">Servidor (ex: bdp01redspm)</label>
            <input type="text" name="serverName" className="form-input" value={dbConfig.serverName} onChange={handleDbChange} placeholder="Nome do servidor" />
          </div>
          <div className="form-group">
            <label className="form-label">Base de Dados (ex: RED_NOC)</label>
            <input type="text" name="dbName" className="form-input" value={dbConfig.dbName} onChange={handleDbChange} placeholder="Nome da base" />
          </div>
          
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ marginBottom: '12px' }}>Autenticação</label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label className="checkbox-label">
                <input type="radio" name="authType" value="AD" checked={dbConfig.authType === 'AD'} onChange={handleDbChange} style={{ accentColor: 'var(--accent-color)' }} />
                Logar via AD (Usuário Atual do Windows)
              </label>
              <label className="checkbox-label">
                <input type="radio" name="authType" value="SQL" checked={dbConfig.authType === 'SQL'} onChange={handleDbChange} style={{ accentColor: 'var(--accent-color)' }} />
                Logar com Usuário e Senha
              </label>
            </div>
          </div>

          {dbConfig.authType === 'SQL' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="form-group">
                <label className="form-label">Domínio (opcional)</label>
                <input type="text" name="domain" className="form-input" value={dbConfig.domain} onChange={handleDbChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Usuário</label>
                <input type="text" name="username" className="form-input" value={dbConfig.username} onChange={handleDbChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Senha</label>
                <input type="password" name="password" className="form-input" value={dbConfig.password} onChange={handleDbChange} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              {validationResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: validationResult.success ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.9rem' }}>
                  {validationResult.success ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                  {validationResult.message}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={handleValidate} disabled={validating || !dbConfig.serverName || !dbConfig.dbName}>
                {validating ? 'Validando...' : 'Testar Conexão'}
              </button>
              <button className="btn" onClick={() => setStep(2)} disabled={!isValidated || !dbConfig.serverName || !dbConfig.dbName}>
                Avançar <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
          <Upload size={48} color="var(--accent-color)" style={{ marginBottom: '20px' }} />
          <h3 style={{ marginBottom: '16px' }}>Selecione o Arquivo XLSX</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            A primeira aba da planilha será lida e a primeira linha será usada como cabeçalho.
          </p>
          
          <label className="btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            Escolher Arquivo
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          
          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
             <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Voltar para Conexão</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ marginBottom: '8px' }}>Validação e Estrutura</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Arquivo: <strong>{fileName}</strong> ({allData.length} linhas lidas)</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={resetImport}>Cancelar / Outro Arquivo</button>
              <button className="btn" style={{ background: 'var(--success-color)' }} onClick={() => setShowModal(true)}>
                <PlayCircle size={18} /> GERAR TABELA
              </button>
            </div>
          </div>

          {result && (
            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', background: result.success ? 'var(--success-color)' : 'var(--danger-color)', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {result.success ? <CheckCircle2 /> : <AlertTriangle />}
              {result.message}
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} style={{ minWidth: '150px' }}>
                      <div style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{col.name}</div>
                      <select 
                        className="form-select" 
                        value={col.type} 
                        onChange={(e) => handleTypeChange(idx, e.target.value)}
                        style={{ padding: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', border: 'none' }}
                      >
                        {SQL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} style={{ fontSize: '0.85rem' }}>{String(row[col.name] !== undefined && row[col.name] !== null ? row[col.name] : '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '16px' }}>
            Mostrando os primeiros {previewData.length} registros como prévia.
          </p>
        </div>
      )}

      {/* Modal de Criação */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--accent-color)' }}>Finalizar Criação</h3>
              {!creating && (
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              )}
            </div>

            {!creating ? (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                  A tabela será criada no servidor <strong>{dbConfig.serverName}</strong>, na base <strong>{dbConfig.dbName}</strong> com {allData.length} registros.
                </p>
                <div className="form-group" style={{ marginBottom: '32px' }}>
                  <label className="form-label">Nome da Nova Tabela (ex: tbl_importacao_2026)</label>
                  <input type="text" className="form-input" value={tableName} onChange={e => setTableName(e.target.value)} placeholder="Nome da tabela" autoFocus />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button className="btn" style={{ background: 'var(--success-color)' }} onClick={handleCreate} disabled={!tableName}>
                    CRIAR
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Gerando Tabela...</h3>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', marginBottom: '20px' }}>
                  <div style={{ width: `${progress}%`, background: 'var(--success-color)', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>Executando no Banco de Dados...</p>
                <button 
                  className="btn" 
                  style={{ background: 'var(--danger-color)', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: 'bold' }}
                  onClick={handleStopEmergency}
                >
                  <StopCircle size={20} /> PARAR EMERGÊNCIA
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
