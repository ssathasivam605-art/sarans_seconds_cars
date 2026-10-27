import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let database;
let databasePath;

function normalizeValues(values) {
  return values.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

export function getDatabasePath() {
  return path.resolve(process.env.SQLITE_PATH || 'backend/data/saran-cars.sqlite');
}

export function getDatabase() {
  const requestedPath = getDatabasePath();
  if (database && databasePath !== requestedPath) {
    throw new Error('SQLite database path changed while the database is open. Close the current connection before changing SQLITE_PATH.');
  }
  if (!database) {
    fs.mkdirSync(path.dirname(requestedPath), { recursive: true });
    database = new DatabaseSync(requestedPath);
    databasePath = requestedPath;
    database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }
  return database;
}

export function query(sql, values = []) {
  return getDatabase().prepare(sql).all(...normalizeValues(values));
}

export function execute(sql, values = []) {
  const result = getDatabase().prepare(sql).run(...normalizeValues(values));
  return {
    insertId: Number(result.lastInsertRowid),
    affectedRows: Number(result.changes),
    changedRows: Number(result.changes)
  };
}

export async function connectDatabase() {
  getDatabase().prepare('SELECT 1 AS connected').get();
  console.log(`Connected to SQLite database "${getDatabasePath()}".`);
}

export function transaction(callback) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function closeDatabase() {
  if (!database) return;
  const currentDatabase = database;
  database = undefined;
  databasePath = undefined;
  currentDatabase.close();
}
