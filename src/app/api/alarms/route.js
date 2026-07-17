import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const config = await prisma.dashboardConfig.findFirst();
  
  if (!config) {
    return NextResponse.json({ error: 'Nenhuma configuração encontrada.' }, { status: 400 });
  }

  try {
    if (config.sourceType === 'INTERNAL') {
      const alarms = await prisma.mockAlarm.findMany({
        orderBy: { DAT_ULTIMA_EXECUCAO: 'desc' }
      });
      return NextResponse.json(alarms);
    } 
    
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
        sqlConfig.driver = 'SQL Server';
        sqlConfig.options.trustedConnection = true;
      } else {
        sqlConfig.user = config.username;
        sqlConfig.password = config.password;
        if (config.domain) {
          sqlConfig.domain = config.domain;
        }
      }

      const pool = new sql.ConnectionPool(sqlConfig);
      await pool.connect();

      try {
        let commandText = config.query || '';
        // Se a query for apenas o nome da procedure (sem SELECT ou EXEC), adicionamos EXEC
        if (commandText && !commandText.toLowerCase().includes(' ') && !commandText.toLowerCase().includes('exec')) {
          commandText = `EXEC ${commandText}`;
        }
        
        const result = await pool.request().query(commandText);
        
        // Pode ser que a proc retorne múltiplos recordsets e o grid esteja no primeiro
        let grid = result.recordset || [];
        if (grid.length === 0 && result.recordsets && result.recordsets.length > 0) {
          grid = result.recordsets[0] || [];
        }

        return NextResponse.json(grid);
      } finally {
        await pool.close();
      }
    }
    
    if (config.sourceType === 'EXCEL') {
      return NextResponse.json([{ 
        dsc_regra: 'Leitura de Excel (MOCK)', 
        dsc_solucao: `Leria arquivo em: ${config.filePath}`,
        DSC_SOLUCIONADO_POR: 'Sistema',
        DSC_COMANDO_CHECAGEM: 'N/A',
        DSC_OBJETIVO_TECNICO: 'Ler planilha local',
        DAT_ULTIMA_EXECUCAO: new Date()
      }]);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('SQL Execution Error (Alarms):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
