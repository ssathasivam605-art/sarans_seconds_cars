import fs from 'node:fs';
import path from 'node:path';
import { execute, query } from '../config/sqlite.js';
import { createId, escapeLike, isValidId, mapCar, safeUser, toISOString } from '../db/ids.js';
import { logActivity } from '../services/activity.js';
import { serializeCar } from './carController.js';
import { validateCarInput } from '../validators/index.js';
import { uploadedPhotoPaths, verifyImageFiles } from '../middleware/upload.js';

const carColumns = `id AS _id, brand, model, year, price, mileage, fuel, transmission, owners,
  location, description, photos, seller_id AS seller, seller_name AS sellerName,
  seller_phone AS sellerPhone, status, featured, is_demo AS isDemo, created_at AS createdAt`;

function removeUploadedFiles(files = []) {
  for (const file of files) {
    try { fs.unlinkSync(file.path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

async function removeStoredPhotos(photos = []) {
  await Promise.all(photos.filter((photo) => photo.startsWith('/uploads/')).map((photo) =>
    fs.promises.unlink(path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'backend/uploads', path.basename(photo))).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    })
  ));
}

export async function stats(_req, res) {
  const rows = await query(`SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
    (SELECT COUNT(*) FROM cars) AS listings,
    (SELECT COUNT(*) FROM cars WHERE status = 'pending') AS pendingCars,
    (SELECT COUNT(*) FROM cars WHERE status = 'approved') AS availableCars,
    (SELECT COUNT(*) FROM cars WHERE status = 'rejected') AS rejectedCars,
    (SELECT COUNT(*) FROM cars WHERE status = 'sold') AS soldCars,
    (SELECT COUNT(DISTINCT seller_id) FROM cars WHERE seller_id IS NOT NULL) AS sellers,
    (SELECT COUNT(*) FROM purchase_enquiries) AS enquiries,
    (SELECT COUNT(*) FROM purchase_enquiries WHERE status = 'Pending') AS pendingEnquiries`);
  res.json(Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)])));
}

export async function listCars(req, res) {
  const where = [];
  const values = [];
  if (['pending', 'approved', 'rejected', 'sold', 'unavailable'].includes(req.query.status)) {
    where.push('status = ?');
    values.push(req.query.status);
  }
  if (['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].includes(req.query.fuel)) {
    where.push('fuel = ?');
    values.push(req.query.fuel);
  }
  for (const [key, column, operator] of [
    ['minPrice', 'price', '>='], ['maxPrice', 'price', '<='], ['minYear', 'year', '>='], ['maxYear', 'year', '<=']
  ]) {
    if (req.query[key] !== undefined && Number.isFinite(Number(req.query[key]))) {
      where.push(`${column} ${operator} ?`);
      values.push(Number(req.query[key]));
    }
  }
  if (req.query.q) {
    const search = `%${escapeLike(String(req.query.q).slice(0, 80))}%`;
    where.push(`(brand LIKE ? ESCAPE '!' OR model LIKE ? ESCAPE '!' OR seller_name LIKE ? ESCAPE '!' OR location LIKE ? ESCAPE '!')`);
    values.push(search, search, search, search);
  }
  const cars = await query(`SELECT ${carColumns} FROM cars ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC`, values);
  res.json({ cars: cars.map((car) => serializeCar(car, { includeSellerPhone: true })) });
}

export async function createCar(req, res) {
  if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one car photo.' });
  let input;
  try {
    verifyImageFiles(req.files);
    input = validateCarInput({
      ...req.body,
      sellerName: req.body.sellerName || req.user.name,
      sellerPhone: req.body.sellerPhone || req.user.phone
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    throw error;
  }
  const id = createId();
  const photos = uploadedPhotoPaths(req.files);
  try {
    await execute(`INSERT INTO cars
      (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
       seller_id, seller_name, seller_phone, status, featured, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'approved', ?, FALSE)`,
    [id, input.brand, input.model, input.year, input.price, input.mileage, input.fuel, input.transmission,
      input.owners, input.location, input.description, JSON.stringify(photos), input.sellerName, input.sellerPhone,
      req.body.featured === 'true']);
  } catch (error) {
    removeUploadedFiles(req.files);
    throw error;
  }
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ?`, [id]);
  await logActivity('Listing created', `Admin added ${car.brand} ${car.model}.`);
  res.status(201).json({ car: serializeCar(car, { includeSellerPhone: true }) });
}

export async function updateCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Listing not found.' });
  const [row] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? LIMIT 1`, [req.params.id]);
  const car = mapCar(row);
  if (!car) return res.status(404).json({ error: 'Listing not found.' });
  const previousPhotos = [...car.photos];
  const { status, featured } = req.body || {};
  if (status !== undefined && !['pending', 'approved', 'rejected', 'sold', 'unavailable'].includes(status)) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Invalid listing status.' });
  }
  if (featured !== undefined && typeof featured !== 'boolean' && !['true', 'false'].includes(featured)) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Featured must be true or false.' });
  }
  let input;
  let photos = car.photos;
  try {
    const carFields = ['brand', 'model', 'year', 'price', 'mileage', 'fuel', 'transmission', 'owners', 'location', 'description', 'sellerName', 'sellerPhone'];
    if (carFields.some((key) => Object.hasOwn(req.body, key))) {
      input = validateCarInput({
        ...car, ...req.body,
        sellerName: req.body.sellerName ?? car.sellerName,
        sellerPhone: req.body.sellerPhone ?? car.sellerPhone
      });
    }
    if (req.files?.length || req.body?.retainedPhotos !== undefined) {
      verifyImageFiles(req.files || []);
      let requestedPhotos = car.photos;
      if (req.body.retainedPhotos !== undefined) {
        try { requestedPhotos = JSON.parse(req.body.retainedPhotos); }
        catch { throw Object.assign(new Error('The retained photo list is invalid.'), { status: 400 }); }
        if (!Array.isArray(requestedPhotos) || requestedPhotos.some((photo) => typeof photo !== 'string')) {
          throw Object.assign(new Error('The retained photo list is invalid.'), { status: 400 });
        }
      }
      const retained = requestedPhotos.filter((photo) => car.photos.includes(photo));
      const additions = uploadedPhotoPaths(req.files || []);
      if (retained.length + additions.length > 8) throw Object.assign(new Error('A listing can have up to 8 photos.'), { status: 400 });
      if (retained.length + additions.length < 1) throw Object.assign(new Error('A listing must have at least one photo.'), { status: 400 });
      photos = [...retained, ...additions];
    }
  } catch (error) {
    removeUploadedFiles(req.files);
    throw error;
  }
  const values = [
    input?.brand ?? car.brand, input?.model ?? car.model, input?.year ?? car.year,
    input?.price ?? car.price, input?.mileage ?? car.mileage, input?.fuel ?? car.fuel,
    input?.transmission ?? car.transmission, input?.owners ?? car.owners,
    input?.location ?? car.location, input?.description ?? car.description,
    input?.sellerName ?? car.sellerName, input?.sellerPhone ?? car.sellerPhone,
    JSON.stringify(photos), status ?? car.status,
    featured === undefined ? car.featured : featured === true || featured === 'true',
    car._id
  ];
  try {
    await execute(`UPDATE cars SET brand = ?, model = ?, year = ?, price = ?, mileage = ?, fuel = ?,
      transmission = ?, owners = ?, location = ?, description = ?, seller_name = ?, seller_phone = ?,
      photos = ?, status = ?, featured = ? WHERE id = ?`, values);
  } catch (error) {
    removeUploadedFiles(req.files);
    throw error;
  }
  const [updated] = await query(`SELECT ${carColumns} FROM cars WHERE id = ?`, [car._id]);
  const updatedCar = mapCar(updated);
  await removeStoredPhotos(previousPhotos.filter((photo) => !updatedCar.photos.includes(photo)));
  await logActivity('Listing updated', `Admin updated ${updatedCar.brand} ${updatedCar.model}${status ? ` to ${status}` : ''}.`);
  res.json({ car: serializeCar(updatedCar, { includeSellerPhone: true }) });
}

export async function deleteCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Listing not found.' });
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? LIMIT 1`, [req.params.id]);
  if (!car) return res.status(404).json({ error: 'Listing not found.' });
  await execute('DELETE FROM cars WHERE id = ?', [req.params.id]);
  await removeStoredPhotos(mapCar(car).photos);
  await logActivity('Listing deleted', `Admin removed ${car.brand} ${car.model}.`);
  res.json({ deleted: true });
}

export async function listUsers(req, res) {
  const queryText = String(req.query.q || '').slice(0, 80);
  const search = `%${escapeLike(queryText)}%`;
  const users = await query(`SELECT users.id, users.name, users.email, users.phone, users.role, users.active,
    users.created_at AS createdAt, COUNT(cars.id) AS listingCount
    FROM users LEFT JOIN cars ON cars.seller_id = users.id
    WHERE users.role = 'user' AND (? = '' OR users.name LIKE ? ESCAPE '!' OR users.email LIKE ? ESCAPE '!' OR users.phone LIKE ? ESCAPE '!')
    GROUP BY users.id ORDER BY users.created_at DESC LIMIT 200`,
  [queryText, search, search, search]);
  res.json({ users: users.map((user) => ({
    ...safeUser(user),
    isSeller: Number(user.listingCount) > 0,
    listingCount: Number(user.listingCount),
    created_at: toISOString(user.createdAt)
  })) });
}

export async function listUserCars(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'User not found.' });
  const [user] = await query('SELECT id, name, email, phone, role, active FROM users WHERE id = ? AND role = ? LIMIT 1', [req.params.id, 'user']);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const cars = await query(`SELECT ${carColumns} FROM cars WHERE seller_id = ? ORDER BY created_at DESC`, [user.id]);
  res.json({ user: safeUser(user), cars: cars.map((car) => serializeCar(car, { includeSellerPhone: true })) });
}

export async function updateUser(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'User not found or cannot be changed.' });
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'An account active state is required.' });
  const [user] = await query('SELECT id, name, role, active FROM users WHERE id = ? AND role = ? LIMIT 1', [req.params.id, 'user']);
  if (!user) return res.status(404).json({ error: 'User not found or cannot be changed.' });
  const wasActive = Boolean(user.active);
  await execute('UPDATE users SET active = ? WHERE id = ?', [req.body.active, user.id]);
  if (wasActive !== req.body.active) {
    await logActivity(`User account ${req.body.active ? 'activated' : 'deactivated'}`, `Admin ${req.body.active ? 'activated' : 'deactivated'} ${user.name}'s account.`);
  }
  res.json({ active: req.body.active });
}

export async function recentActivities(_req, res) {
  const activities = await query('SELECT id, action, detail, created_at AS createdAt FROM activities ORDER BY created_at DESC LIMIT 12');
  res.json({ activities: activities.map((activity) => ({
    id: String(activity.id), action: activity.action, detail: activity.detail,
    created_at: toISOString(activity.createdAt)
  })) });
}
