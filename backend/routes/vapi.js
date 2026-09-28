import express from 'express';
import { query, get, run } from '../database/database.js';
import { normalizeCategory, resolveDate, VALID_CATEGORIES } from './expenses.js';

const router = express.Router();

/**
 * Executes a tool by name with arguments
 */
export async function executeTool(name, args = {}) {
  const toolName = (name || '').toLowerCase();

  if (toolName === 'addexpense') {
    const rawAmount = parseFloat(args.amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      return {
        error: 'Invalid amount. Please specify an amount greater than 0.'
      };
    }

    const description = (args.description || args.title || 'Expense').toString().trim();
    const category = normalizeCategory(args.category || description);
    const date = resolveDate(args.expense_date || args.date);
    const createdAt = new Date().toISOString();

    const insertResult = await run(
      `INSERT INTO expenses (amount, category, description, expense_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [Math.round(rawAmount * 100) / 100, category, description, date, createdAt]
    );

    const created = await get('SELECT * FROM expenses WHERE id = ?', [insertResult.lastID]);

    return {
      success: true,
      message: `Done. I recorded ₹${created.amount} for ${created.description} under ${created.category}.`,
      expense: created
    };
  }

  if (toolName === 'getexpenses') {
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (args.category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(args.category);
    }
    if (args.from) {
      sql += ' AND expense_date >= ?';
      params.push(resolveDate(args.from));
    }
    if (args.to) {
      sql += ' AND expense_date <= ?';
      params.push(resolveDate(args.to));
    }

    sql += ' ORDER BY expense_date DESC, id DESC';

    const limit = parseInt(args.limit, 10) || 5;
    sql += ' LIMIT ?';
    params.push(limit);

    const rows = await query(sql, params);

    if (rows.length === 0) {
      return {
        success: true,
        message: 'No expenses found matching your request.',
        expenses: []
      };
    }

    const itemsSummary = rows
      .map(r => `₹${r.amount} for ${r.description} (${r.category}) on ${r.expense_date}`)
      .join(', ');

    return {
      success: true,
      message: `Here are your recent expenses: ${itemsSummary}.`,
      count: rows.length,
      expenses: rows
    };
  }

  if (toolName === 'getexpensesummary') {
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (args.category) {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(args.category);
    }
    if (args.from) {
      sql += ' AND expense_date >= ?';
      params.push(resolveDate(args.from));
    }
    if (args.to) {
      sql += ' AND expense_date <= ?';
      params.push(resolveDate(args.to));
    }

    const rows = await query(sql, params);
    let total = 0;
    const byCategory = {};

    rows.forEach(r => {
      const amt = Number(r.amount) || 0;
      total += amt;
      const cat = r.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + amt;
    });

    const categoryBreakdown = Object.entries(byCategory)
      .filter(([_, amt]) => amt > 0)
      .map(([cat, amt]) => `${cat}: ₹${amt}`)
      .join(', ');

    const periodText = args.from || args.to ? 'for the selected period' : 'in total';

    return {
      success: true,
      total,
      count: rows.length,
      byCategory,
      message: `You spent ₹${total.toLocaleString('en-IN')} ${periodText} across ${rows.length} expenses.${categoryBreakdown ? ' Breakdown: ' + categoryBreakdown : ''}`
    };
  }

  if (toolName === 'deleteexpense') {
    let targetId = args.id;

    if (!targetId || targetId === 'last' || targetId === 'latest') {
      const lastItem = await get('SELECT * FROM expenses ORDER BY id DESC LIMIT 1');
      if (!lastItem) {
        return {
          success: false,
          message: 'No expenses found to delete.'
        };
      }
      await run('DELETE FROM expenses WHERE id = ?', [lastItem.id]);
      return {
        success: true,
        message: `Deleted your last expense: ₹${lastItem.amount} for ${lastItem.description}.`,
        deletedId: lastItem.id,
        expense: lastItem
      };
    }

    const parsedId = parseInt(targetId, 10);
    if (isNaN(parsedId)) {
      return {
        error: `Invalid expense ID: ${targetId}`
      };
    }

    const existing = await get('SELECT * FROM expenses WHERE id = ?', [parsedId]);
    if (!existing) {
      return {
        success: false,
        message: `Could not find expense with ID #${parsedId}.`
      };
    }

    await run('DELETE FROM expenses WHERE id = ?', [parsedId]);
    return {
      success: true,
      message: `Deleted expense #${parsedId}: ₹${existing.amount} for ${existing.description}.`,
      deletedId: parsedId,
      expense: existing
    };
  }

  return {
    error: `Unknown tool: ${name}`
  };
}

/**
 * Universal Vapi Webhook / Tool Handler
 * Handles Vapi's Server URL webhook format (tool-calls & function-call)
 * and direct tool POST requests.
 */
router.post('/tool', async (req, res) => {
  try {
    const body = req.body || {};

    // 1. Check for Vapi standard "tool-calls" webhook
    if (body.message && body.message.type === 'tool-calls' && Array.isArray(body.message.toolCalls)) {
      const results = [];

      for (const call of body.message.toolCalls) {
        const fn = call.function || {};
        const fnName = fn.name;
        let args = fn.arguments;
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (e) { args = {}; }
        }

        const output = await executeTool(fnName, args);
        // Vapi expects a result string or JSON object
        results.push({
          toolCallId: call.id,
          result: typeof output.message === 'string' ? output.message : JSON.stringify(output)
        });
      }

      return res.json({ results });
    }

    // 2. Check for Vapi legacy "function-call" webhook
    if (body.message && body.message.type === 'function-call' && body.message.functionCall) {
      const fn = body.message.functionCall;
      const fnName = fn.name;
      let args = fn.parameters || {};
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch (e) { args = {}; }
      }

      const output = await executeTool(fnName, args);
      return res.json({
        result: typeof output.message === 'string' ? output.message : JSON.stringify(output)
      });
    }

    // 3. Check for direct Custom Tool request: { name: "addExpense", parameters: { ... }, toolCallId: "..." }
    const toolName = body.name || (body.function && body.function.name) || body.tool;
    let toolArgs = body.parameters || body.arguments || (body.function && body.function.arguments) || body;
    if (typeof toolArgs === 'string') {
      try { toolArgs = JSON.parse(toolArgs); } catch (e) { toolArgs = {}; }
    }

    if (toolName) {
      const output = await executeTool(toolName, toolArgs);
      if (body.toolCallId) {
        return res.json({
          results: [
            {
              toolCallId: body.toolCallId,
              result: output.message || JSON.stringify(output)
            }
          ]
        });
      }
      return res.json(output);
    }

    // Fallback: If received ping or unknown message from Vapi
    res.json({ status: 'ok', received: true });
  } catch (err) {
    console.error('Error handling Vapi tool call:', err);
    res.status(500).json({
      error: 'Error executing Vapi tool',
      message: err.message
    });
  }
});

// Explicit tool endpoints for users configuring individual tool URLs
router.post('/addExpense', async (req, res) => {
  const result = await executeTool('addExpense', req.body);
  res.json(result);
});

router.post('/getExpenses', async (req, res) => {
  const result = await executeTool('getExpenses', req.body);
  res.json(result);
});

router.post('/getExpenseSummary', async (req, res) => {
  const result = await executeTool('getExpenseSummary', req.body);
  res.json(result);
});

router.post('/deleteExpense', async (req, res) => {
  const result = await executeTool('deleteExpense', req.body);
  res.json(result);
});

export default router;
