import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closeDatabase, execute, query } from '../src/config/sqlite.js';
import { createId } from '../src/db/ids.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';
import { validEmail, validPhone, validString } from '../src/validators/index.js';

try {
  await initializeDatabase();
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!validString(ADMIN_NAME, 80) || !validEmail(ADMIN_EMAIL) || typeof ADMIN_PASSWORD !== 'string' || ADMIN_PASSWORD.length < 14) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and a unique ADMIN_PASSWORD of at least 14 characters in the root .env file.');
  }
  if (!validPhone(process.env.ADMIN_PHONE || '+910000000000')) throw new Error('ADMIN_PHONE must be a valid phone number.');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length) throw new Error('That email already has an account. Use a different email or manage the existing account securely.');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await execute(
    'INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [createId(), ADMIN_NAME.trim(), email, process.env.ADMIN_PHONE || '+910000000000', passwordHash, 'admin']
  );
  console.log(`Administrator account created for ${email}. Remove ADMIN_PASSWORD from .env after setup.`);
} catch (error) {
  console.error(`Administrator setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
