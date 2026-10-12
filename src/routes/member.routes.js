const router = require("express").Router();
const { z } = require("zod");
const db = require("../config/db");
const {
  authenticate,
  allowRoles
} = require("../middlewares/auth.middleware");

router.use(authenticate);

const memberSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  memberSince: z.string().date().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED"]).optional(),
  notes: z.string().max(3000).optional().nullable()
});

const rolesCanManage = ["ADMIN", "SECRETARY"];

router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = req.query.status;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );
    const offset = (page - 1) * limit;

    if (status && !["ACTIVE", "INACTIVE", "TRANSFERRED"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const result = await db.query(
      `SELECT id, name, email, phone, birth_date, address,
              member_since, status, notes, created_at
       FROM members
       WHERE church_id = $1
         AND ($2 = '' OR name ILIKE '%' || $2 || '%'
              OR COALESCE(email, '') ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR status = $3)
       ORDER BY name ASC
       LIMIT $4 OFFSET $5`,
      [req.user.church_id, search, status || null, limit, offset]
    );

    res.json({
      members: result.rows,
      pagination: { page, limit, count: result.rows.length }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, birth_date, address,
              member_since, status, notes, created_at
       FROM members
       WHERE id = $1 AND church_id = $2`,
      [req.params.id, req.user.church_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Membro não encontrado." });
    }

    res.json({ member: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/", allowRoles(...rolesCanManage), async (req, res, next) => {
  try {
    const data = memberSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO members
       (church_id, name, email, phone, birth_date, address,
        member_since, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.church_id,
        data.name,
        data.email ?? null,
        data.phone ?? null,
        data.birthDate ?? null,
        data.address ?? null,
        data.memberSince ?? null,
        data.status ?? "ACTIVE",
        data.notes ?? null
      ]
    );

    res.status(201).json({ member: result.rows[0] });
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

router.patch("/:id", allowRoles(...rolesCanManage), async (req, res, next) => {
  try {
    const data = memberSchema.partial().parse(req.body);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Informe ao menos um campo." });
    }

    const columns = {
      name: "name",
      email: "email",
      phone: "phone",
      birthDate: "birth_date",
      address: "address",
      memberSince: "member_since",
      status: "status",
      notes: "notes"
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
      `UPDATE members SET ${updates.join(", ")}
       WHERE id = $${idPosition} AND church_id = $${churchPosition}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Membro não encontrado." });
    }

    res.json({ member: result.rows[0] });
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

router.patch("/:id/inactivate", allowRoles(...rolesCanManage), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE members SET status = 'INACTIVE'
       WHERE id = $1 AND church_id = $2
       RETURNING id, name, status`,
      [req.params.id, req.user.church_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Membro não encontrado." });
    }

    res.json({ member: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;