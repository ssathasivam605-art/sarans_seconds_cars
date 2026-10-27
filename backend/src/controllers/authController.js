import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { execute, query } from '../config/sqlite.js';
import { createId, safeUser } from '../db/ids.js';
import { logActivity } from '../services/activity.js';
import { validEmail, validPhone, validString } from '../validators/index.js';

function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('saran_session', token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000, path: '/'
  });
}

export async function register(req, res) {
  const { name, email, phone, password } = req.body || {};
  if (!validString(name, 80) || !validEmail(email) || !validPhone(phone) ||
      typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: 'Enter a name, valid email, phone number, and password with at least 8 characters.' });
  }
  try {
    const user = {
      id: createId(), name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(),
      role: 'user', active: true
    };
    const passwordHash = await bcrypt.hash(password, 12);
    await execute(
      'INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.phone, passwordHash]
    );
    await logActivity('User registered', `${user.name} created an account.`);
    setSessionCookie(res, user);
    res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (error.message?.startsWith('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw error;
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const [user] = await query(
    'SELECT id, name, email, phone, role, active, password_hash AS passwordHash FROM users WHERE email = ? LIMIT 1',
    [String(email || '').trim().toLowerCase()]
  );
  if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been deactivated. Contact support for help.' });
  setSessionCookie(res, user);
  res.json({ user: safeUser(user) });
}

export function me(req, res) {
  res.json({ user: safeUser(req.user) });
}

export function logout(_req, res) {
  res.clearCookie('saran_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ message: 'You have been signed out.' });
}

export async function updateProfile(req, res) {
  const { name, phone } = req.body || {};
  if (!validString(name, 80) || !validPhone(phone)) return res.status(400).json({ error: 'Enter a valid name and phone number.' });
  req.user.name = name.trim();
  req.user.phone = phone.trim();
  await execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [req.user.name, req.user.phone, req.user.id]);
  res.json({ user: safeUser(req.user) });
}
