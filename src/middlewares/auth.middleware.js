const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Autenticação necessária." });
    }

    const token = authorization.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      `SELECT id, church_id, name, email, role
       FROM users
       WHERE id = $1 AND church_id = $2 AND active = TRUE`,
      [payload.sub, payload.churchId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Usuário não encontrado ou inativo." });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Você não tem permissão para esta ação." });
    }

    next();
  };
}

module.exports = { authenticate, allowRoles };