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
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      };

      if (config.authType === 'AD') {
        sqlConfig.driver = 'msnodesqlv8';
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

        const result = await pool.request().query(commandText);
        
        let grid = result.recordset || [];
        if (grid.length === 0 && result.recordsets && result.recordsets.length > 0) {
          grid = result.recordsets[0] || [];
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
