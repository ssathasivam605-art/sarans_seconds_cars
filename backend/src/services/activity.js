import { execute } from '../config/sqlite.js';

export async function logActivity(action, detail) {
  try {
    await execute('INSERT INTO activities (action, detail) VALUES (?, ?)', [action, detail]);
  } catch (error) {
    console.error(`Could not record activity "${action}": ${error.message}`);
  }
}
