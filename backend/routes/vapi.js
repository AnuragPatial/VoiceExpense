import express from 'express';
import { query, get, run } from '../database/database.js';
import { normalizeCategory, resolveDate } from './expenses.js';

const router = express.Router();

// Cache executed toolCallIds to prevent duplicate insertions when both Vapi server webhook and client SDK forward tool calls
const executedToolCalls = new Map();

/**
 * Executes a tool by name with arguments
 */
export async function executeTool(name, args = {}, toolCallId = null) {
  if (toolCallId && executedToolCalls.has(toolCallId)) {
    return executedToolCalls.get(toolCallId);
  }

  const toolName = (name || '').toLowerCase().replace(/[_-\s]/g, '');
  let resultOutput;

  if (toolName === 'addexpense' || toolName === 'createexpense' || toolName === 'recordexpense') {
    const rawAmount = parseFloat(args.amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      resultOutput = {
        error: 'Invalid amount. Please specify an amount greater than 0.'
      };
    } else {
      const description = (args.description || args.title || args.item || args.category || 'Expense').toString().trim();
      const category = normalizeCategory(args.category || description);
      const date = resolveDate(args.expense_date || args.date);
      const createdAt = new Date().toISOString();

      const insertResult = await run(
        `INSERT INTO expenses (amount, category, description, expense_date, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [Math.round(rawAmount * 100) / 100, category, description, date, createdAt]
      );

      const created = await get('SELECT * FROM expenses WHERE id = ?', [insertResult.lastID]);

      resultOutput = {
        success: true,
        message: `Done. I recorded ₹${created.amount} for ${created.description} under ${created.category}.`,
        expense: created
      };
    }
  } else if (toolName === 'getexpenses' || toolName === 'listexpenses' || toolName === 'showexpenses') {
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (args.category && args.category.toLowerCase() !== 'all') {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(normalizeCategory(args.category));
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
      resultOutput = {
        success: true,
        message: 'No expenses found matching your request.',
        expenses: []
      };
    } else {
      const itemsSummary = rows
        .map(r => `₹${r.amount} for ${r.description} (${r.category}) on ${r.expense_date}`)
        .join(', ');

      resultOutput = {
        success: true,
        message: `Here are your recent expenses: ${itemsSummary}.`,
        count: rows.length,
        expenses: rows
      };
    }
  } else if (toolName === 'getexpensesummary' || toolName === 'getsummary' || toolName === 'expensesummary') {
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (args.category && args.category.toLowerCase() !== 'all') {
      sql += ' AND LOWER(category) = LOWER(?)';
      params.push(normalizeCategory(args.category));
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

    const periodText = args.category
      ? `on ${normalizeCategory(args.category)}`
      : args.from || args.to
      ? 'for the selected period'
      : 'in total';

    resultOutput = {
      success: true,
      total,
      count: rows.length,
      byCategory,
      message: `You spent ₹${total.toLocaleString('en-IN')} ${periodText} across ${rows.length} expenses.${categoryBreakdown && !args.category ? ' Breakdown: ' + categoryBreakdown : ''}`
    };
  } else if (toolName === 'deleteexpense' || toolName === 'removeexpense' || toolName === 'deletelastexpense') {
    let targetId = args.id;

    if (!targetId || String(targetId).toLowerCase() === 'last' || String(targetId).toLowerCase() === 'latest') {
      const lastItem = await get('SELECT * FROM expenses ORDER BY id DESC LIMIT 1');
      if (!lastItem) {
        resultOutput = {
          success: false,
          message: 'No expenses found to delete.'
        };
      } else {
        await run('DELETE FROM expenses WHERE id = ?', [lastItem.id]);
        resultOutput = {
          success: true,
          message: `Deleted your last expense: ₹${lastItem.amount} for ${lastItem.description}.`,
          deletedId: lastItem.id,
          expense: lastItem
        };
      }
    } else {
      const parsedId = parseInt(targetId, 10);
      if (isNaN(parsedId)) {
        resultOutput = {
          error: `Invalid expense ID: ${targetId}`
        };
      } else {
        const existing = await get('SELECT * FROM expenses WHERE id = ?', [parsedId]);
        if (!existing) {
          resultOutput = {
            success: false,
            message: `Could not find expense with ID #${parsedId}.`
          };
        } else {
          await run('DELETE FROM expenses WHERE id = ?', [parsedId]);
          resultOutput = {
            success: true,
            message: `Deleted expense #${parsedId}: ₹${existing.amount} for ${existing.description}.`,
            deletedId: parsedId,
            expense: existing
          };
        }
      }
    }
  } else {
    resultOutput = {
      error: `Unknown tool: ${name}`
    };
  }

  if (toolCallId) {
    executedToolCalls.set(toolCallId, resultOutput);
    if (executedToolCalls.size > 500) {
      const firstKey = executedToolCalls.keys().next().value;
      executedToolCalls.delete(firstKey);
    }
  }

  return resultOutput;
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
    const toolCallsList =
      (body.message && Array.isArray(body.message.toolCallList) && body.message.toolCallList) ||
      (body.message && Array.isArray(body.message.toolCalls) && body.message.toolCalls) ||
      (body.message &&
        Array.isArray(body.message.toolWithToolCallList) &&
        body.message.toolWithToolCallList.map(t => t.toolCall || t)) ||
      (Array.isArray(body.toolCallList) && body.toolCallList) ||
      (Array.isArray(body.toolCalls) && body.toolCalls);

    if (toolCallsList) {
      const results = [];

      for (const item of toolCallsList) {
        const call = item.toolCall || item;
        const fn = call.function || item.function || call;
        const fnName = fn.name || call.name || item.name;
        const toolCallId = call.id || item.id;
        let args = fn.arguments || fn.parameters || call.arguments || call.parameters || {};
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (e) { args = {}; }
        }

        const output = await executeTool(fnName, args, toolCallId);
        results.push({
          name: fnName,
          toolCallId,
          result: typeof output.message === 'string' ? output.message : JSON.stringify(output)
        });
      }

      return res.json({ results });
    }

    // 2. Check for Vapi legacy "function-call" webhook
    const functionCall = (body.message && body.message.functionCall) || body.functionCall;
    if (functionCall) {
      const fnName = functionCall.name;
      let args = functionCall.parameters || functionCall.arguments || {};
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch (e) { args = {}; }
      }

      const output = await executeTool(fnName, args, functionCall.id);
      return res.json({
        result: typeof output.message === 'string' ? output.message : JSON.stringify(output),
        data: output
      });
    }

    // 3. Check for direct Custom Tool request: { name: "addExpense", parameters: { ... }, toolCallId: "..." }
    const toolName = body.name || (body.function && body.function.name) || body.tool;
    let toolArgs = body.parameters || body.arguments || (body.function && body.function.arguments) || body;
    if (typeof toolArgs === 'string') {
      try { toolArgs = JSON.parse(toolArgs); } catch (e) { toolArgs = {}; }
    }

    if (toolName) {
      const output = await executeTool(toolName, toolArgs, body.toolCallId);
      if (body.toolCallId) {
        return res.json({
          results: [
            {
              name: toolName,
              toolCallId: body.toolCallId,
              result: output.message || JSON.stringify(output),
              data: output
            }
          ]
        });
      }
      return res.json(output);
    }

    // Fallback: If received status-update, speech-update, or end-of-call-report from Vapi Server URL
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
  const result = await executeTool('addExpense', req.body, req.body?.toolCallId);
  res.json(result);
});

router.post('/getExpenses', async (req, res) => {
  const result = await executeTool('getExpenses', req.body, req.body?.toolCallId);
  res.json(result);
});

router.post('/getExpenseSummary', async (req, res) => {
  const result = await executeTool('getExpenseSummary', req.body, req.body?.toolCallId);
  res.json(result);
});

router.post('/deleteExpense', async (req, res) => {
  const result = await executeTool('deleteExpense', req.body, req.body?.toolCallId);
  res.json(result);
});

export default router;
