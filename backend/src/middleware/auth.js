import jwt from 'jsonwebtoken';
import { query } from '../config/sqlite.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.saran_session;
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await query(
      'SELECT id, name, email, phone, role, active FROM users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    if (!user || !user.active) return res.status(401).json({ error: 'This account is not available.' });
    user.active = Boolean(user.active);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
  next();
}
