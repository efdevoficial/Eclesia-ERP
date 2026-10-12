const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("A variável DATABASE_URL não foi configurada.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on("error", (error) => {
  console.error("Erro na conexão com PostgreSQL:", error.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};