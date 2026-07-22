import prisma from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req) {
  const { command, batchId } = await req.json();
  const startTime = Date.now();
  
  const config = await prisma.dashboardConfig.findFirst();
  
  if (!config) {
    return NextResponse.json({ error: 'Configuração não encontrada.' }, { status: 400 });
  }

  try {
    let resultGrid = [];
    
    if (config.sourceType === 'SQLSERVER') {
      const sql = config.authType === 'AD' ? require('mssql/msnodesqlv8') : require('mssql');

      const sqlConfig = {
        server: config.serverName,
        database: config.dbName,
        requestTimeout: 120000, // 2 minutos (120000 ms)
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      };

      if (config.authType === 'AD') {
        sqlConfig.driver = 'SQL Server';
        sqlConfig.options.trustedConnection = true;
      } else {
        sqlConfig.user = config.username;
        sqlConfig.password = config.password;
        if (config.domain) {
          sqlConfig.domain = config.domain;
        }
      }

      // Conectar ao SQL Server
      const pool = new sql.ConnectionPool(sqlConfig);
      await pool.connect();
      
      try {
        let commandText = command || '';
        if (commandText && !commandText.toLowerCase().includes(' ') && !commandText.toLowerCase().includes('exec')) {
          commandText = `EXEC ${commandText}`;
        }

        // Garantir NOLOCK em todas as tabelas lidas para não indisponibilizar a base
        commandText = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\n${commandText}`;

        const result = await pool.request().query(commandText);
        
        let grid = result.recordset || [];
        if (grid.length === 0 && result.recordsets && result.recordsets.length > 0) {
          grid = result.recordsets[0] || [];
        }

        const MAX_ROWS = 10;
        const MAX_STRING_LENGTH = 250; // Limite rigoroso de caracteres por célula

        // Truncar strings para evitar que um campo VARCHAR(MAX) de 50MB trave o navegador
        grid.forEach(row => {
          Object.keys(row).forEach(k => {
            if (typeof row[k] === 'string' && row[k].length > MAX_STRING_LENGTH) {
              row[k] = row[k].substring(0, MAX_STRING_LENGTH) + '... [TRUNCADO]';
            }
          });
        });

        if (grid.length > MAX_ROWS) {
          const totalRows = grid.length;
          grid = grid.slice(0, MAX_ROWS);
          
          if (grid.length > 0) {
            const warningRow = {};
            const keys = Object.keys(grid[0]);
            keys.forEach(k => warningRow[k] = "...");
            warningRow[keys[0]] = `Resultado total: ${totalRows} linhas (+ ${totalRows - MAX_ROWS} ocultadas).`;
            grid.push(warningRow);
          }
        }

        resultGrid = grid;
      } finally {
        await pool.close();
      }

    } else if (config.sourceType === 'INTERNAL' || config.sourceType === 'EXCEL') {
      // Simula a execução no banco de dados com um delay
      const delay = Math.floor(Math.random() * 2000) + 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const hasResults = Math.random() > 0.1;
      if (hasResults) {
        resultGrid = [
          { ID: crypto.randomUUID().slice(0, 8), CheckStatus: 'OK', Message: 'Verificação passou com sucesso', Server: config.serverName || 'localhost' },
          { ID: crypto.randomUUID().slice(0, 8), CheckStatus: 'WARNING', Message: 'Recurso operando perto do limite', Server: config.serverName || 'localhost' }
        ];
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Salva a métrica de execução no banco local
    await prisma.checklistMetric.create({
      data: {
        batchId: batchId || crypto.randomUUID(),
        comandoChecagem: command,
        startedAt: new Date(startTime),
        durationMs
      }
    });

    return NextResponse.json({ 
      data: resultGrid, 
      durationMs 
    });

  } catch (error) {
    console.error('SQL Execution Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
