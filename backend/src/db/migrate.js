import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, execute } from '../config/db.js';

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export async function initializeDatabase() {
  await connectDatabase();
  const schema = await fs.readFile(schemaPath, 'utf8');
  for (const statement of schema.split(';').map((item) => item.trim()).filter(Boolean)) {
    await execute(statement);
  }
  console.log('MySQL schema is up to date.');
}
