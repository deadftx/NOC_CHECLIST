import { NextResponse } from 'next/server'

export async function POST(req) {
  let pool = null
  try {
    const { serverName, authType, sqlUser, sqlPass, targetQuery } = await req.json()

    if (!serverName) {
      return NextResponse.json({ success: false, error: 'Nome do servidor é obrigatório.' }, { status: 400 })
    }

    // Configuração unificada
    const sqlDriver = authType === 'AD' ? require('mssql/msnodesqlv8') : require('mssql')

    const sqlConfig = {
      server: serverName,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      requestTimeout: 60000, // Aumentado para 60s
      connectionTimeout: 10000
    }

    if (authType === 'AD') {
      sqlConfig.driver = 'SQL Server' // Required for AD / msnodesqlv8
      sqlConfig.options.trustedConnection = true
    } else {
      sqlConfig.user = sqlUser
      sqlConfig.password = sqlPass
    }

    pool = new sqlDriver.ConnectionPool(sqlConfig)
    await pool.connect()

    // Q1: Em Execução
    const q1 = `
      USE msdb;
      SELECT 
          j.name AS Nome_do_Job,
          a.start_execution_date AS Inicio_Execucao,
          DATEDIFF(MINUTE, a.start_execution_date, GETDATE()) AS Minutos_Rodando
      FROM msdb.dbo.sysjobs j
      INNER JOIN msdb.dbo.sysjobactivity a ON j.job_id = a.job_id
      WHERE a.session_id = (SELECT MAX(session_id) FROM msdb.dbo.syssessions)
        AND a.start_execution_date IS NOT NULL
        AND a.stop_execution_date IS NULL;
    `

    // Q2: Erro Atual
    const q2 = `
      USE msdb;
      WITH UltimaExecucao AS (
          SELECT 
              job_id,
              run_status,
              message,
              run_date,
              run_time,
              server,
              ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY run_date DESC, run_time DESC) AS rn
          FROM msdb.dbo.sysjobhistory
          WHERE step_id = 0
      )
      SELECT 
          j.name AS Nome_do_Job,
          msdb.dbo.agent_datetime(u.run_date, u.run_time) AS Data_Hora_Erro,
          u.server AS Servidor,
          u.message AS Mensagem_Erro
      FROM msdb.dbo.sysjobs j
      INNER JOIN UltimaExecucao u ON j.job_id = u.job_id
      WHERE u.rn = 1 AND u.run_status = 0;
    `

    // Q3: Mais de 60min
    const q3 = `
      USE msdb;
      SELECT 
          j.name AS Nome_do_Job,
          a.start_execution_date AS Inicio_Execucao,
          DATEDIFF(MINUTE, a.start_execution_date, GETDATE()) AS Minutos_Rodando
      FROM msdb.dbo.sysjobs j
      INNER JOIN msdb.dbo.sysjobactivity a ON j.job_id = a.job_id
      WHERE a.session_id = (SELECT MAX(session_id) FROM msdb.dbo.syssessions)
        AND a.start_execution_date IS NOT NULL
        AND a.stop_execution_date IS NULL
        AND DATEDIFF(MINUTE, a.start_execution_date, GETDATE()) >= 60;
    `

    // Q4: Cancelados Atual
    const q4 = `
      USE msdb;
      WITH UltimaExecucao AS (
          SELECT 
              job_id,
              run_status,
              message,
              run_date,
              run_time,
              server,
              ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY run_date DESC, run_time DESC) AS rn
          FROM msdb.dbo.sysjobhistory
          WHERE step_id = 0
      )
      SELECT 
          j.name AS Nome_do_Job,
          msdb.dbo.agent_datetime(u.run_date, u.run_time) AS Data_Hora_Cancelamento,
          u.server AS Servidor,
          u.message AS Mensagem_Cancelamento
      FROM msdb.dbo.sysjobs j
      INNER JOIN UltimaExecucao u ON j.job_id = u.job_id
      WHERE u.rn = 1 AND u.run_status = 3;
    `

    const request = pool.request()
    
    let resultData = []
    if (targetQuery === 1) resultData = (await request.query(q1)).recordset || []
    else if (targetQuery === 2) resultData = (await request.query(q2)).recordset || []
    else if (targetQuery === 3) resultData = (await request.query(q3)).recordset || []
    else if (targetQuery === 4) resultData = (await request.query(q4)).recordset || []
    else throw new Error("targetQuery inválido")

    return NextResponse.json({
      success: true,
      data: resultData
    })

  } catch (error) {
    console.error('API /jobs erro:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}
