const sql = require('msnodesqlv8');
const connectionString = "Driver={SQL Server};Server=bdp01redspm;Database=RED_NOC;Trusted_Connection=yes;";

console.log('Connecting...');
sql.query(connectionString, "SELECT 1 as test", (err, rows) => {
  if (err) {
    console.error("❌ Erro:", err.message);
  } else {
    console.log("✅ Sucesso:", rows);
  }
  process.exit(0);
});
