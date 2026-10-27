import 'dotenv/config';
import { closeDatabase } from '../src/config/db.js';
import { initializeDatabase } from '../src/db/migrate.js';

try {
  await initializeDatabase();
} catch (error) {
  console.error(`MySQL migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
