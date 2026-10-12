const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const churchRoutes = require("./routes/church.routes");
const memberRoutes = require("./routes/member.routes");
const visitorRoutes = require("./routes/visitor.routes");
const financeRoutes = require("./routes/finance.routes");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    application: "Eclesia",
    version: require("../package.json").version
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/churches", churchRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/finance", financeRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "Erro interno do servidor."
  });
});

module.exports = app;