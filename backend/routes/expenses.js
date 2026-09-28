import express from 'express';
import { query, get, run } from '../database/database.js';

const router = express.Router();

export const VALID_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Travel',
  'Education',
  'Other'
];

// Helper to normalize and categorize
export function normalizeCategory(input) {
  if (!input || typeof input !== 'string') return 'Other';
  const clean = input.trim().toLowerCase();

  // Exact matches
  const match = VALID_CATEGORIES.find(c => c.toLowerCase() === clean);
  if (match) return match;

  // Keyword heuristic matching
  if (/(food|dinner|lunch|breakfast|snack|coffee|tea|pizza|burger|meal|grocery|groceries|restaurant|cafe|swiggy|zomato)/i.test(clean)) {
    return 'Food';
  }
  if (/(transport|uber|ola|cab|taxi|metro|bus|train|fuel|petrol|diesel|auto|commute|parking|toll)/i.test(clean)) {
    return 'Transport';
  }
  if (/(shop|shopping|shirt|pant|shoes|dress|clothes|cloth|amazon|flipkart|electronics|gadget|mall|store)/i.test(clean)) {
    return 'Shopping';
  }
  if (/(bill|bills|electricity|water|wifi|internet|broadband|rent|recharge|mobile|utility|gas cylinder|maintenance)/i.test(clean)) {
    return 'Bills';
  }
  if (/(entertainment|movie|cinema|netflix|prime|spotify|concert|game|gaming|show|outing)/i.test(clean)) {
    return 'Entertainment';
  }
  if (/(health|doctor|medicine|medical|hospital|clinic|pharmacy|drugs|gym|fitness|dental|checkup)/i.test(clean)) {
    return 'Health';
  }
  if (/(travel|trip|flight|airline|hotel|resort|vacation|stay|tour)/i.test(clean)) {
    return 'Travel';
  }
  if (/(education|book|books|course|tuition|school|college|fee|fees|training|class|stationery)/i.test(clean)) {
    return 'Education';
  }

  return 'Other';
}

// Helper to resolve dates from natural language or ISO strings
export function resolveDate(input) {
  const now = new Date();
  const formatYMD = (d) => d.toISOString().split('T')[0];

  if (!input || typeof input !== 'string' || input.trim() === '') {
    return formatYMD(now);
  }

  const str = input.trim().toLowerCase();

  if (str === 'today' || str === 'now') {
    return formatYMD(now);
  }

  if (str === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return formatYMD(y);
  }

  if (str.startsWith('last ')) {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayName = str.replace('last ', '').trim();
    const targetDayIndex = daysOfWeek.indexOf(targetDayName);
    if (targetDayIndex !== -1) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let diff = currentDay - targetDayIndex;
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() - diff);
      return formatYMD(d);
    }
  }

  // Check if standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try parsing date string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatYMD(parsed);
  }

  // Fallback to today
  return formatYMD(now);
}

// GET /api/expenses/summary
router.get('/summary', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }
    if (from) {
      sql += ' AND expense_date >= ?';
      params.push(resolveDate(from));
    }
    if (to) {
      sql += ' AND expense_date <= ?';
      params.push(resolveDate(to));
    }

    const rows = await query(sql, params);

    let total = 0;
    const byCategory = {};

    // Initialize all categories with 0
    VALID_CATEGORIES.forEach(cat => {
      byCategory[cat] = 0;
    });

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      total += amt;
      const cat = r.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    }

    // Filter out categories with 0 if you want clean list, or return only non-zero categories
    const nonZeroCategories = {};
    for (const [k, v] of Object.entries(byCategory)) {
      if (v > 0) {
        nonZeroCategories[k] = Math.round(v * 100) / 100;
      }
    }

    res.json({
      total: Math.round(total * 100) / 100,
      count: rows.length,
      byCategory: nonZeroCategories
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to calculate expense summary' });
  }
});

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const { category, from, to, limit } = req.query;
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }
    if (from) {
      sql += ' AND expense_date >= ?';
      params.push(resolveDate(from));
    }
    if (to) {
      sql += ' AND expense_date <= ?';
      params.push(resolveDate(to));
    }

    sql += ' ORDER BY expense_date DESC, id DESC';

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        sql += ' LIMIT ?';
        params.push(parsedLimit);
      }
    }

    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to retrieve expenses' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    let { amount, category, description, expense_date } = req.body;

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description should not be empty' });
    }

    // Normalize category and date
    const finalCategory = normalizeCategory(category);
    const finalDate = resolveDate(expense_date);
    const createdAt = new Date().toISOString();

    const insertSql = `
      INSERT INTO expenses (amount, category, description, expense_date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await run(insertSql, [
      Math.round(parsedAmount * 100) / 100,
      finalCategory,
      description.trim(),
      finalDate,
      createdAt
    ]);

    const createdExpense = await get('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
    res.status(201).json(createdExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'last') {
      const lastItem = await get('SELECT * FROM expenses ORDER BY id DESC LIMIT 1');
      if (!lastItem) {
        return res.status(404).json({ error: 'No expenses to delete' });
      }
      await run('DELETE FROM expenses WHERE id = ?', [lastItem.id]);
      return res.json({ success: true, deletedId: lastItem.id, deletedItem: lastItem });
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const existing = await get('SELECT * FROM expenses WHERE id = ?', [parsedId]);
    if (!existing) {
      return res.status(404).json({ error: `Expense #${parsedId} not found` });
    }

    await run('DELETE FROM expenses WHERE id = ?', [parsedId]);
    res.json({ success: true, deletedId: parsedId, deletedItem: existing });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
