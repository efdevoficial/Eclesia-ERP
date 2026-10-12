require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("../src/config/db");

async function setupDatabase() {
  const schemaPath = path.join(__dirname, "../database/schema.sql");

  try {
    console.log("1. Verificando arquivo SQL...");

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Arquivo não encontrado: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("2. Testando conexão com PostgreSQL...");
    await pool.query("SELECT 1");

    console.log("3. Habilitando extensão pgcrypto...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

    console.log("4. Criando tabelas...");
    await pool.query(schema);

    console.log("Banco de dados configurado com sucesso.");
  } catch (error) {
    console.error("\nFalha na configuração do banco:");
    console.error("Mensagem:", error.message || "(vazia)");
    console.error("Código:", error.code || "(não informado)");
    console.error("Detalhes:", error.detail || "(nenhum)");
    console.error("Dica:", error.hint || "(nenhuma)");
    console.error("Etapa/stack:", error.stack || "(indisponível)");

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();