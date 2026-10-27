import { randomBytes } from 'node:crypto';

export function createId() {
  return randomBytes(12).toString('hex');
}

export function isValidId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

export function escapeLike(value) {
  return value.replace(/[!%_]/g, '!$&');
}

export function mapCar(row) {
  if (!row) return null;
  return {
    ...row,
    photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : row.photos,
    featured: Boolean(row.featured),
    isDemo: Boolean(row.isDemo),
    seller: row.seller ?? null,
    createdAt: row.createdAt
  };
}

export function safeUser(row) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    active: Boolean(row.active)
  };
}

export function toISOString(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return value;
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized).toISOString();
}

export function mongoId(value, label) {
  const id = typeof value === 'string' ? value : value?.$oid;
  if (!isValidId(id)) throw new Error(`Invalid MongoDB ${label} id in export.`);
  return id.toLowerCase();
}

export function mongoDate(value, fallback = new Date()) {
  let date = value?.$date ?? value ?? fallback;
  if (typeof date === 'object' && date?.$numberLong) date = Number(date.$numberLong);
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) throw new Error('Invalid timestamp in MongoDB export.');
  return normalized;
}
