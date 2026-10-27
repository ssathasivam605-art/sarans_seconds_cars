import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, execute, query } from '../config/sqlite.js';

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sqlite-schema.sql');

export async function initializeDatabase() {
  await connectDatabase();
  const schema = await fs.readFile(schemaPath, 'utf8');
  for (const statement of schema.split(';').map((item) => item.trim()).filter(Boolean)) {
    await execute(statement);
  }
  const columns = new Set(query('PRAGMA table_info(cars)').map(({ name }) => name));
  const additions = [
    ['variant', 'TEXT'],
    ['registration_year', 'INTEGER'],
    ['ex_showroom_price', 'INTEGER'],
    ['body_type', 'TEXT'],
    ['engine_capacity_cc', 'INTEGER'],
    ['battery_capacity_kwh', 'REAL'],
    ['range_km', 'INTEGER'],
    ['exterior_color', 'TEXT']
  ];
  for (const [name, type] of additions) {
    if (!columns.has(name)) await execute(`ALTER TABLE cars ADD COLUMN ${name} ${type}`);
  }
  console.log('SQLite schema is up to date.');
}
