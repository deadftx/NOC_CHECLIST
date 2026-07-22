'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, Search, Upload, Loader2, Split, Download, X, Layers, File, Settings } from 'lucide-react'

const parseDate = (str) => {
  if (!str || str.length !== 6 || str === '000000') return ''
  return `${str.substring(0, 2)}/${str.substring(2, 4)}/20${str.substring(4, 6)}`
}

const parseMoney = (str) => {
  if (!str) return 'R$ 0,00'
  const val = parseInt(str, 10) / 100
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

const OCORRENCIAS_BRADESCO = {
  '02': 'Entrada Confirmada',
  '03': 'Entrada Rejeitada',
  '06': 'Liquidação Normal',
  '09': 'Baixado via Arquivo',
  '10': 'Baixado pela Agência',
  '11': 'Em Ser (Pendente)',
  '12': 'Abatimento Concedido',
  '13': 'Abatimento Cancelado',
  '14': 'Vencimento Alterado',
  '15': 'Liquidação em Cartório',
  '17': 'Liquidação após baixa',
  '19': 'Conf. Instrução Protesto',
  '20': 'Conf. Sustação Protesto',
  '23': 'Entrada em Cartório',
  '24': 'Entrada rejeitada (CEP)',
  '27': 'Baixa Rejeitada',
  '28': 'Débito de tarifas',
  '30': 'Alteração Rejeitada',
  '32': 'Instrução Rejeitada',
  '33': 'Confirmação Alteração',
  '34': 'Retirado de Cartório',
  '35': 'Desagendamento débito',
  '68': 'Acerto rateio',
  '69': 'Cancelamento rateio'
}

export default function LeitorRetornoPage() {
  const [fileName, setFileName] = useState('')
  const [baseFileName, setBaseFileName] = useState('')
  const [fileExt, setFileExt] = useState('')
  
  const [parsedData, setParsedData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Dados puros em memória para a Divisão
  const [rawHeader, setRawHeader] = useState('')
  const [rawTrailer, setRawTrailer] = useState('')
  const [rawLines, setRawLines] = useState([]) // array de strings (tipo 1)
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState('view') // 'view' ou 'files'
  
  // Divisão
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false)
  const [splitMethod, setSplitMethod] = useState('ocorrencia') // 'ocorrencia' ou 'linhas'
  const [linesPerFile, setLinesPerFile] = useState(100)
  const [splitFiles, setSplitFiles] = useState([]) // array com blobls

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    const bName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
    const fExt = file.name.substring(file.name.lastIndexOf('.'))
    setBaseFileName(bName)
    setFileExt(fExt)
    
    setIsProcessing(true)
    
    setTimeout(() => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const text = evt.target.result
          const lines = text.split('\n').map(l => l.replace('\r', ''))
          
          const extracted = []
          let head = ''
          let trail = ''
          const rLines = []
          
          lines.forEach((line, index) => {
            if (line.charAt(0) === '0') {
              head = line
            } else if (line.charAt(0) === '9') {
              trail = line
            } else if (line.charAt(0) === '1' && line.length >= 400) {
              rLines.push(line)
              extracted.push({
                id: index,
                linha: index + 1,
                ocorrencia: line.substring(108, 110),
                dataOcorrencia: parseDate(line.substring(110, 116)),
                nossoNumero: line.substring(70, 82).trim(),
                seuNumero: line.substring(116, 126).trim(),
                dataVencimento: parseDate(line.substring(146, 152)),
                valorTitulo: parseMoney(line.substring(152, 165)),
                valorPago: parseMoney(line.substring(253, 266)),
                valorTarifa: parseMoney(line.substring(175, 188)),
                motivos: line.substring(318, 328).match(/.{1,2}/g)?.filter(m => m !== '  ' && m !== '00').join(', ') || ''
              })
            }
          })
          
          setRawHeader(head)
          setRawTrailer(trail)
          setRawLines(rLines)
          setParsedData(extracted)
          setSplitFiles([]) // Reseta arquivos divididos
          setActiveTab('view')
        } catch (err) {
          console.error(err)
          alert("Erro ao processar arquivo.")
        } finally {
          setIsProcessing(false)
        }
      }
      
      reader.readAsText(file)
    }, 50)
  }

  const handleSplit = () => {
    if (rawLines.length === 0) return
    setIsProcessing(true)
    setIsSplitModalOpen(false)

    setTimeout(() => {
      const generated = []
      
      if (splitMethod === 'ocorrencia') {
        const groups = {}
        rawLines.forEach(line => {
          const oc = line.substring(108, 110)
          if (!groups[oc]) groups[oc] = []
          groups[oc].push(line)
        })
        
        Object.keys(groups).forEach(oc => {
          const contentLines = []
          if (rawHeader) contentLines.push(rawHeader)
          contentLines.push(...groups[oc])
          if (rawTrailer) contentLines.push(rawTrailer)
          
          const textContent = contentLines.join('\r\n')
          const blob = new Blob([textContent], { type: 'text/plain' })
          
          generated.push({
            name: `${baseFileName}_${oc}${fileExt}`,
            count: groups[oc].length,
            size: (blob.size / 1024).toFixed(2),
            url: URL.createObjectURL(blob)
          })
        })
      } else {
        let part = 1
        const limit = parseInt(linesPerFile, 10) || 100
        for (let i = 0; i < rawLines.length; i += limit) {
          const chunk = rawLines.slice(i, i + limit)
          const contentLines = []
          if (rawHeader) contentLines.push(rawHeader)
          contentLines.push(...chunk)
          if (rawTrailer) contentLines.push(rawTrailer)
          
          const textContent = contentLines.join('\r\n')
          const blob = new Blob([textContent], { type: 'text/plain' })
          
          generated.push({
            name: `${baseFileName}_${part}${fileExt}`,
            count: chunk.length,
            size: (blob.size / 1024).toFixed(2),
            url: URL.createObjectURL(blob)
          })
          part++
        }
      }
      
      setSplitFiles(generated)
      setIsProcessing(false)
      setActiveTab('files')
    }, 50)
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return parsedData
    const lower = searchTerm.toLowerCase()
    return parsedData.filter(row => 
      Object.values(row).some(val => String(val).toLowerCase().includes(lower))
    )
  }, [parsedData, searchTerm])

  const displayLimit = 500;
  const displayedData = filteredData.slice(0, displayLimit);

  return (
    <div className="container" style={{ padding: '20px 40px', position: 'relative' }}>
      
      {/* Loading Modal */}
      {isProcessing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={64} color="var(--warning-color)" style={{ animation: 'spin 2s linear infinite', marginBottom: '24px' }} />
          <h2 style={{ color: 'var(--text-primary)' }}>Processando Arquivo...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Isso pode levar alguns segundos para arquivos grandes.</p>
          <style jsx>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* Split Modal */}
      {isSplitModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '450px', background: 'var(--bg-color)', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Split color="var(--accent-color)" /> Dividir Arquivo
              </h3>
              <button onClick={() => setIsSplitModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X /></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Regra de Divisão</label>
              <select className="form-select" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)}>
                <option value="ocorrencia">Dividir por Código de Ocorrência</option>
                <option value="linhas">Dividir por Quantidade de Linhas</option>
              </select>
            </div>

            {splitMethod === 'linhas' && (
              <div className="form-group">
                <label className="form-label">Quantidade de Linhas por Arquivo (Apenas Registros)</label>
                <input type="number" min="1" className="form-input" value={linesPerFile} onChange={(e) => setLinesPerFile(e.target.value)} />
              </div>
            )}
            
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--accent-color)' }}>Aviso:</strong> O Cabeçalho (linha 0) e o Rodapé (linha 9) originais serão automaticamente <strong>clonados</strong> e inseridos em todos os novos arquivos gerados para garantir a validade no sistema bancário.
            </div>

            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '1.1rem' }} onClick={handleSplit}>
              Gerar Arquivos Divididos
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '24px' }}>
        <Link href="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <FileText color="var(--warning-color)" /> Leitor CNAB 400 Bradesco
        </h2>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label className="btn" style={{ display: 'inline-flex', cursor: 'pointer', background: 'var(--accent-color)', color: '#fff', fontWeight: 'bold', border: '2px solid rgba(255,255,255,0.2)' }}>
              <Upload size={18} style={{ marginRight: '8px' }} /> Selecionar Arquivo (.ret/.txt)
              <input type="file" accept=".txt,.ret" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
            {fileName && (
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong>{fileName}</strong> ({parsedData.length} registros tipo 1)
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {parsedData.length > 0 && (
              <button 
                className="btn btn-secondary" 
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid var(--panel-border)' }}
                onClick={() => setIsSplitModalOpen(true)}
              >
                <Split size={18} /> DIVIDIR ARQUIVO
              </button>
            )}
          </div>
        </div>
      </div>

      {parsedData.length > 0 ? (
        <div>
          {/* Custom Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
            <button 
              style={{ background: activeTab === 'view' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'view' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('view')}
            >
              <Search size={18} /> Visualizar Dados
            </button>
            
            <button 
              style={{ background: activeTab === 'files' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'files' ? '#fff' : 'var(--text-secondary)', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('files')}
            >
              <Layers size={18} /> Arquivos Divididos 
              {splitFiles.length > 0 && (
                <span style={{ background: activeTab === 'files' ? 'rgba(0,0,0,0.3)' : 'var(--accent-color)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                  {splitFiles.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'view' && (
            <div className="table-container glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Pesquisar em qualquer coluna..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '40px', background: 'var(--bg-color)' }}
                  />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Ocorrência</th>
                    <th>Descrição</th>
                    <th>Data Ocorr.</th>
                    <th>Nosso Número</th>
                    <th>Seu Número</th>
                    <th>Vencimento</th>
                    <th>Valor Título</th>
                    <th>Tarifa</th>
                    <th>Valor Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedData.length > 0 ? (
                    displayedData.map(row => (
                      <tr key={row.id}>
                        <td>
                          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {row.ocorrencia}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {OCORRENCIAS_BRADESCO[row.ocorrencia] || 'Outros / Desconhecido'}
                        </td>
                        <td>{row.dataOcorrencia}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}>{row.nossoNumero}</td>
                        <td>{row.seuNumero}</td>
                        <td>{row.dataVencimento}</td>
                        <td style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{row.valorTitulo}</td>
                        <td style={{ color: 'var(--danger-color)' }}>{row.valorTarifa}</td>
                        <td style={{ color: 'var(--success-color)', fontWeight: 600 }}>{row.valorPago}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        Nenhum registro encontrado para "{searchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Exibindo {displayedData.length} registros (Total lido: {filteredData.length}). 
                {filteredData.length > displayLimit && " Utilize a busca para encontrar registros específicos."}
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="glass-panel">
              {splitFiles.length > 0 ? (
                <div>
                  <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>Arquivos Prontos para Download</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {splitFiles.map((sf, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <File size={32} color="var(--success-color)" />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sf.name}>
                              {sf.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {sf.count} registros • {sf.size} KB
                            </div>
                          </div>
                        </div>
                        <a 
                          href={sf.url} 
                          download={sf.name}
                          className="btn"
                          style={{ width: '100%', justifyContent: 'center', background: 'var(--success-color)' }}
                        >
                          <Download size={18} /> Baixar
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <Settings size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                  <h3>Nenhum arquivo dividido ainda</h3>
                  <p>Clique no botão "DIVIDIR ARQUIVO" acima para gerar quebras deste arquivo de retorno.</p>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
          <h3>Nenhum dado importado</h3>
          <p>Selecione um arquivo de retorno CNAB 400 Bradesco para visualizar os dados ou dividi-lo.</p>
        </div>
      )}

    </div>
  )
}
