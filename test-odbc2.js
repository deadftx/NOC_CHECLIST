const sql = require('mssql/msnodesqlv8');

async function testDriver() {
  try {
    const connStr = 'Driver={SQL Server};Server=bdp01redspm;Database=RED_NOC;Trusted_Connection=yes;';
    const pool = new sql.ConnectionPool(connStr);
    await pool.connect();
    console.log(`✅ Success with mssql Connection String!`);
    await pool.close();
  } catch (err) {
    console.log(`❌ Failed: ${err.message}`);
  }
}

testDriver();
