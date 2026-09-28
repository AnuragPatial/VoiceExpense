import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve a writable directory (supports local disk & Vercel /tmp serverless environment)
function resolveDbPath() {
  const localDataDir = path.resolve(__dirname, '../data');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

  if (!isServerless) {
    try {
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      fs.accessSync(localDataDir, fs.constants.W_OK);
      return path.join(localDataDir, 'expenses.db');
    } catch (err) {
      // Fallback to os.tmpdir() if local directory is read-only
    }
  }

  const tmpDataDir = path.join(os.tmpdir(), 'voice-expense-data');
  try {
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
  } catch (e) {
    // ignore
  }
  return path.join(tmpDataDir, 'expenses.db');
}

const dbPath = resolveDbPath();
const seedDbPath = path.resolve(__dirname, '../data/expenses.db');

let dbInstance = null;

// Persist the database to disk
export function saveDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.warn('Note: Could not persist SQLite database to disk (read-only filesystem):', err.message);
  }
}

// Locate sql-wasm.wasm across local node_modules and Vercel serverless environments
function findWasmBinary() {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch (e) {
      // continue checking candidates
    }
  }
  return null;
}

// Get or initialize SQLite Database
export async function getDatabase() {
  if (dbInstance) return dbInstance;

  const wasmBinary = findWasmBinary();
  const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);

  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      dbInstance = new SQL.Database();
    }
  } else if (fs.existsSync(seedDbPath)) {
    try {
      const fileBuffer = fs.readFileSync(seedDbPath);
      dbInstance = new SQL.Database(fileBuffer);
      saveDatabase();
    } catch (e) {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Always ensure table exists
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  return dbInstance;
}

// Execute SELECT query returning an array of row objects
export async function query(sql, params = []) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

// Execute SELECT query returning a single row object
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Execute INSERT / UPDATE / DELETE query
export async function run(sql, params = []) {
  const db = await getDatabase();
  db.run(sql, params);

  // Retrieve last insert row id
  const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
  let lastID = 0;
  if (lastIdResult.length > 0 && lastIdResult[0].values.length > 0) {
    lastID = lastIdResult[0].values[0][0];
  }

  // Persist immediately to file
  saveDatabase();

  return { lastID };
}

// Initialize tables automatically
export async function initDatabase() {
  await getDatabase();

  // Seed sample data if empty
  const countRow = await get('SELECT COUNT(*) as count FROM expenses');
  if (countRow && Number(countRow.count) === 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO expenses (amount, category, description, expense_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [450, 'Food', 'Dinner', today, new Date().toISOString()]
    );
    await run(
      `INSERT INTO expenses (amount, category, description, expense_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [250, 'Transport', 'Uber ride', today, new Date(Date.now() - 3600000).toISOString()]
    );
    await run(
      `INSERT INTO expenses (amount, category, description, expense_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [1500, 'Shopping', 'Shoes', yesterday, new Date(Date.now() - 86400000).toISOString()]
    );
  }
}

export default { query, get, run, initDatabase, saveDatabase, getDatabase };
