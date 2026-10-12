const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const db = require("../config/db");
const { authenticate } = require("../middlewares/auth.middleware");

router.post("/login", async (req, res, next) => {
  try {
    const schema = z.object({
      churchSlug: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(1)
    });

    const input = schema.parse(req.body);

    const result = await db.query(
      `SELECT u.id, u.church_id, u.name, u.email, u.password_hash, u.role,
              c.name AS church_name, c.slug AS church_slug, c.logo_url
       FROM users u
       JOIN churches c ON c.id = u.church_id
       WHERE c.slug = $1 AND LOWER(u.email) = LOWER($2)
         AND u.active = TRUE`,
      [input.churchSlug, input.email]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash ||
        !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = jwt.sign(
      { sub: user.id, churchId: user.church_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      church: {
        id: user.church_id,
        name: user.church_name,
        slug: user.church_slug,
        logoUrl: user.logo_url
      }
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Dados inválidos.", details: error.issues });
    }
    next(error);
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;