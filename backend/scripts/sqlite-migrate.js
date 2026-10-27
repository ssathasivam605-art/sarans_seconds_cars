import 'dotenv/config';
import { closeDatabase } from '../src/config/sqlite.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';

try {
  await initializeDatabase();
} catch (error) {
  console.error(`SQLite migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
