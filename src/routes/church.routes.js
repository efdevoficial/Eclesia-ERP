const router = require("express").Router();
const db = require("../config/db");
const { authenticate, allowRoles } = require("../middlewares/auth.middleware");

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, email, phone, logo_url, created_at
       FROM churches WHERE id = $1`,
      [req.user.church_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Igreja não encontrada." });
    }

    res.json({ church: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", authenticate, allowRoles("ADMIN"), async (req, res, next) => {
  try {
    const { name, email, phone, logoUrl } = req.body;

    const result = await db.query(
      `UPDATE churches
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           logo_url = COALESCE($4, logo_url)
       WHERE id = $5
       RETURNING id, name, slug, email, phone, logo_url`,
      [name ?? null, email ?? null, phone ?? null, logoUrl ?? null, req.user.church_id]
    );

    res.json({ church: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;