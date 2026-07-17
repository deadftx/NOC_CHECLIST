import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const config = await req.json();

    if (config.sourceType !== 'SQLSERVER') {
      return NextResponse.json({ success: true, message: 'Validação apenas para SQL Server.' });
    }

    const sql = config.authType === 'AD' ? require('mssql/msnodesqlv8') : require('mssql');

    const sqlConfig = {
      server: config.serverName,
      database: config.dbName,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      }
    };

    if (config.authType === 'AD') {
      sqlConfig.driver = 'SQL Server'; // Explicitamente SQL Server
      sqlConfig.options.trustedConnection = true;
    } else {
      sqlConfig.user = config.username;
      sqlConfig.password = config.password;
      if (config.domain) {
        sqlConfig.domain = config.domain;
      }
    }

    // Tentar conectar e executar uma query simples com timeout curto (5s) para evitar travar
    sqlConfig.requestTimeout = 5000;
    sqlConfig.connectionTimeout = 5000;

    const pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();

    try {
      await pool.request().query('SELECT 1 as test');
      return NextResponse.json({ success: true, message: 'Conexão estabelecida com sucesso!' });
    } finally {
      await pool.close();
    }

  } catch (error) {
    console.error('Erro ao validar conexão:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Falha na conexão', 
      error: error.message || String(error)
    }, { status: 400 });
  }
}
