import { NextResponse } from 'next/server'

function mapType(typeStr, sql) {
  const upper = typeStr.toUpperCase()
  if (upper.includes('VARCHAR')) return sql.VarChar(sql.MAX)
  if (upper.includes('INT')) return sql.Int
  if (upper.includes('DATETIME')) return sql.DateTime
  if (upper.includes('DECIMAL')) return sql.Decimal(18, 2)
  if (upper.includes('BIT')) return sql.Bit
  if (upper.includes('FLOAT')) return sql.Float
  return sql.VarChar(sql.MAX)
}

export async function POST(req) {
  let pool = null;
  try {
    const { config, tableName, columns, data } = await req.json()

    if (!tableName || !columns || !data) {
      return NextResponse.json({ success: false, message: 'Dados inválidos.' }, { status: 400 })
    }

    const sql = config.authType === 'AD' ? require('mssql/msnodesqlv8') : require('mssql')

    const sqlConfig = {
      server: config.serverName,
      database: config.dbName,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      }
    }

    if (config.authType === 'AD') {
      sqlConfig.driver = 'SQL Server'
      sqlConfig.options.trustedConnection = true
    } else {
      sqlConfig.user = config.username
      sqlConfig.password = config.password
      if (config.domain) {
        sqlConfig.domain = config.domain
      }
    }

    // Aumentar timeouts para importação
    sqlConfig.requestTimeout = 60000 // 60s
    sqlConfig.connectionTimeout = 15000 // 15s

    pool = new sql.ConnectionPool(sqlConfig)
    await pool.connect()

    req.signal.addEventListener('abort', () => {
      console.warn('Operação ABORTADA (EMERGÊNCIA) pelo usuário. Matando conexão com o SQL Server...')
      if (pool) {
        pool.close().catch(() => {})
      }
    })

    // 1. Verificar se a Tabela existe e Criar
    const checkTableQuery = `SELECT OBJECT_ID('${tableName}', 'U') as id`
    const checkResult = await pool.request().query(checkTableQuery)
    
    if (checkResult.recordset && checkResult.recordset.length > 0 && checkResult.recordset[0].id !== null) {
      return NextResponse.json({ 
        success: false, 
        message: 'A tabela já existe. A importação foi cancelada pois operações de DROP/TRUNCATE não são permitidas.' 
      }, { status: 400 })
    }

    const colDefs = columns.map(c => `[${c.name}] ${c.type}`).join(', ')
    const createTableQuery = `
      CREATE TABLE [${tableName}] (${colDefs});
    `
    await pool.request().query(createTableQuery)

    // 2. Inserir Dados em Lotes (Batches) para evitar problemas do Bulk com o driver msnodesqlv8 (AD)
    if (data.length > 0) {
      const batchSize = 100; // Inserir de 100 em 100 linhas para não estourar o limite de parâmetros
      const colNames = columns.map(c => `[${c.name}]`).join(', ');

      for (let i = 0; i < data.length; i += batchSize) {
        if (req.signal.aborted) throw new Error('Operação cancelada pelo usuário (EMERGÊNCIA).');
        
        const chunk = data.slice(i, i + batchSize);
        const request = new sql.Request(pool);
        
        let valueStrings = [];
        let paramIndex = 0;

        chunk.forEach(row => {
          let rowValues = [];
          columns.forEach(col => {
            let val = row[col.name];
            if (val === undefined || val === '') val = null;
            
            const paramName = `p${paramIndex++}`;
            request.input(paramName, mapType(col.type, sql), val);
            rowValues.push(`@${paramName}`);
          });
          valueStrings.push(`(${rowValues.join(', ')})`);
        });

        const insertQuery = `INSERT INTO [${tableName}] (${colNames}) VALUES ${valueStrings.join(', ')}`;
        await request.query(insertQuery);
      }
    }

    return NextResponse.json({ success: true, message: 'Tabela criada e populada com sucesso.' })

  } catch (error) {
    console.error('Erro na importacao:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Falha na importacao', 
      error: error.message || String(error)
    }, { status: 500 })
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (e) {}
    }
  }
}
