const sql = require('msnodesqlv8');

const connectionString = "Driver={SQL Server};Server=bdp01redspm;Database=RED_NOC;Trusted_Connection=yes;";
sql.query(connectionString, "SELECT 1 as teste", (err, rows) => {
  if (err) {
    console.error("❌ Erro:", err.message);
  } else {
    console.log("✅ Sucesso:", rows);
  }
});
