import { execute } from '../config/sqlite.js';
import { logActivity } from '../services/activity.js';
import { validEmail, validString } from '../validators/index.js';

export async function createContactMessage(req, res) {
  const { name, email, message } = req.body || {};
  if (!validString(name, 80) || !validEmail(email) || !validString(message, 2000)) {
    return res.status(400).json({ error: 'Enter your name, a valid email address, and a message.' });
  }
  await execute(
    'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), message.trim()]
  );
  await logActivity('Contact message received', `A message was submitted by ${name.trim()}.`);
  res.status(201).json({ message: 'Your message was received and saved. The Saran Cars team will follow up.' });
}
