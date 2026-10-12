const router = require("express").Router();
const { z } = require("zod");
const db = require("../config/db");
const {
  authenticate,
  allowRoles
} = require("../middlewares/auth.middleware");

router.use(authenticate);

const canManageFinance = allowRoles("ADMIN", "TREASURER");

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(2000),
  amount: z.coerce.number().positive().finite().max(9999999999.99),
  transactionDate: z.string().date().optional(),
  paymentMethod: z.string().max(30).optional().nullable()
});

router.get("/summary", async (req, res, next) => {
  try {
    const from = req.query.from || "1900-01-01";
    const to = req.query.to || "2999-12-31";

    if (!z.string().date().safeParse(from).success ||
        !z.string().date().safeParse(to).success ||
        from > to) {
      return res.status(400).json({ error: "Período inválido." });
    }

    const result = await db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0) AS income,
         COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS expenses,
         COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)
         - COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS balance,
         COUNT(*) AS transaction_count
       FROM transactions
       WHERE church_id = $1
         AND transaction_date BETWEEN $2::date AND $3::date`,
      [req.user.church_id, from, to]
    );

    res.json({
      period: { from, to },
      summary: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const from = req.query.from || "1900-01-01";
    const to = req.query.to || "2999-12-31";
    const type = req.query.type || null;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1,
      Number.parseInt(req.query.limit, 10) || 20
    ));
    const offset = (page - 1) * limit;

    if (!z.string().date().safeParse(from).success ||
        !z.string().date().safeParse(to).success ||
        from > to) {
      return res.status(400).json({ error: "Período inválido." });
    }

    if (type && !["INCOME", "EXPENSE"].includes(type)) {
      return res.status(400).json({ error: "Tipo de movimentação inválido." });
    }

    const result = await db.query(
      `SELECT id, type, category, description, amount,
              transaction_date, payment_method, created_by, created_at
       FROM transactions
       WHERE church_id = $1
         AND transaction_date BETWEEN $2::date AND $3::date
         AND ($4::text IS NULL OR type = $4)
       ORDER BY transaction_date DESC, created_at DESC
       LIMIT $5 OFFSET $6`,
      [req.user.church_id, from, to, type, limit, offset]
    );

    res.json({
      transactions: result.rows,
      pagination: { page, limit, count: result.rows.length }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", canManageFinance, async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO transactions
       (church_id, created_by, type, category, description,
        amount, transaction_date, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE($7::date, CURRENT_DATE), $8)
       RETURNING *`,
      [
        req.user.church_id,
        req.user.id,
        data.type,
        data.category,
        data.description,
        data.amount,
        data.transactionDate ?? null,
        data.paymentMethod ?? null
      ]
    );

    res.status(201).json({ transaction: result.rows[0] });
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

router.delete("/:id", canManageFinance, async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM transactions
       WHERE id = $1 AND church_id = $2
       RETURNING id`,
      [req.params.id, req.user.church_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Movimentação não encontrada."
      });
    }

    res.json({ message: "Movimentação excluída." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;