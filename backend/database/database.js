import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'expenses.db');

let dbInstance = null;

// Persist the database to disk
export function saveDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

// Get or initialize SQLite Database
export async function getDatabase() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
      console.log(`Loaded existing SQLite database from ${dbPath}`);
    } catch (e) {
      console.warn('Could not read existing db, initializing fresh:', e.message);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
    console.log(`Created new SQLite database at ${dbPath}`);
  }

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
  const db = await getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  saveDatabase();

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
    console.log('Seeded initial sample expenses into SQLite');
  }
}

export default { query, get, run, initDatabase, saveDatabase, getDatabase };
