import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closeDatabase, execute, query } from '../src/config/sqlite.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';

try {
  await initializeDatabase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 14) {
    throw new Error('Check ADMIN_EMAIL and ADMIN_PASSWORD in the root .env file.');
  }

  const users = await query('SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1', [email, 'admin']);
  if (!users.length) throw new Error('Admin account was not found.');
  const passwordHash = await bcrypt.hash(password, 12);
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, users[0].id]);
  console.log('Admin password updated successfully.');
} catch (error) {
  console.error('Password update failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
