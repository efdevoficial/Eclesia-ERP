const router = require("express").Router();
const { z } = require("zod");
const db = require("../config/db");
const {
  authenticate,
  allowRoles
} = require("../middlewares/auth.middleware");

router.use(authenticate);

const canManage = allowRoles("ADMIN", "SECRETARY");

const visitorSchema = z.object({
  name: z.string().trim().min(2).max(150),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  visitDate: z.string().date().optional(),
  attendedService: z.string().max(150).optional().nullable(),
  followUpNotes: z.string().max(3000).optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const result = await db.query(
      `SELECT id, name, phone, email, visit_date,
              attended_service, follow_up_notes, created_at
       FROM visitors
       WHERE church_id = $1
         AND ($2 = '' OR name ILIKE '%' || $2 || '%'
              OR COALESCE(phone, '') ILIKE '%' || $2 || '%')
       ORDER BY visit_date DESC, created_at DESC
       LIMIT 100`,
      [req.user.church_id, search]
    );

    res.json({ visitors: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM visitors
       WHERE id = $1 AND church_id = $2`,
      [req.params.id, req.user.church_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Visitante não encontrado." });
    }

    res.json({ visitor: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/", canManage, async (req, res, next) => {
  try {
    const data = visitorSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO visitors
       (church_id, name, phone, email, visit_date,
        attended_service, follow_up_notes)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7)
       RETURNING *`,
      [
        req.user.church_id,
        data.name,
        data.phone ?? null,
        data.email ?? null,
        data.visitDate ?? null,
        data.attendedService ?? null,
        data.followUpNotes ?? null
      ]
    );

    res.status(201).json({ visitor: result.rows[0] });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Dados inválidos.",
        details: error.issues
      });
    }
    next(error);
  }
});

router.patch("/:id", canManage, async (req, res, next) => {
  try {
    const data = visitorSchema.partial().parse(req.body);

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "Informe ao menos um campo." });
    }

    const columns = {
      name: "name",
      phone: "phone",
      email: "email",
      visitDate: "visit_date",
      attendedService: "attended_service",
      followUpNotes: "follow_up_notes"
    };

    const values = [];
    const updates = [];

    for (const [key, value] of Object.entries(data)) {
      values.push(value);
      updates.push(`${columns[key]} = $${values.length}`);
    }

    values.push(req.params.id);
    const idPosition = values.length;
    values.push(req.user.church_id);
    const churchPosition = values.length;

    const result = await db.query(
      `UPDATE visitors SET ${updates.join(", ")}
       WHERE id = $${idPosition} AND church_id = $${churchPosition}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Visitante não encontrado." });
    }

    res.json({ visitor: result.rows[0] });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Dados inválidos.",
        details: error.issues
      });
    }
    next(error);
  }
});

module.exports = router;