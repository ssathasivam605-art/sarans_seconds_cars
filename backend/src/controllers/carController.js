import fs from 'node:fs';
import path from 'node:path';
import { execute, query } from '../config/sqlite.js';
import { createId, escapeLike, isValidId, mapCar, toISOString } from '../db/ids.js';
import { logActivity } from '../services/activity.js';
import { uploadedPhotoPaths, verifyImageFiles } from '../middleware/upload.js';
import { validateCarInput } from '../validators/index.js';

const carColumns = `id AS _id, brand, model, year, price, mileage, fuel, transmission, owners,
  location, description, photos, seller_id AS seller, seller_name AS sellerName,
  seller_phone AS sellerPhone, status, featured, is_demo AS isDemo, created_at AS createdAt`;

function cleanUploadedFiles(files = []) {
  for (const file of files) {
    try { fs.unlinkSync(file.path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function serializeCar(car, { includeSellerPhone = false } = {}) {
  if (!car) return null;
  const row = mapCar(car);
  const result = {
    id: String(row._id), brand: row.brand, model: row.model, year: row.year, price: row.price,
    mileage: row.mileage, fuel: row.fuel, transmission: row.transmission, owners: row.owners,
    location: row.location, description: row.description, photos: row.photos || [],
    seller_id: row.seller ? String(row.seller._id || row.seller) : null,
    seller_name: row.sellerName, status: row.status, featured: Boolean(row.featured),
    is_demo: Boolean(row.isDemo), created_at: toISOString(row.createdAt)
  };
  if (includeSellerPhone) result.seller_phone = row.sellerPhone;
  return result;
}

function buildPublicFilter(params) {
  const where = ['status = ?'];
  const values = ['approved'];
  if (params.featured === 'true') where.push('featured = TRUE');
  if (params.q) {
    const search = `%${escapeLike(String(params.q).slice(0, 100))}%`;
    where.push(`(brand LIKE ? ESCAPE '!' OR model LIKE ? ESCAPE '!' OR (brand || ' ' || model) LIKE ? ESCAPE '!')`);
    values.push(search, search, search);
  }
  for (const [key, column] of [['brand', 'brand'], ['fuel', 'fuel'], ['transmission', 'transmission']]) {
    if (params[key]) {
      where.push(`${column} = ?`);
      values.push(params[key]);
    }
  }
  if (params.location) {
    where.push('LOWER(location) = LOWER(?)');
    values.push(String(params.location).slice(0, 80));
  }
  for (const [parameter, column, operator] of [
    ['minYear', 'year', '>='], ['maxYear', 'year', '<='],
    ['minPrice', 'price', '>='], ['maxPrice', 'price', '<='],
    ['minMileage', 'mileage', '>='], ['maxMileage', 'mileage', '<=']
  ]) {
    if (params[parameter] !== undefined && params[parameter] !== '' && Number.isFinite(Number(params[parameter]))) {
      where.push(`${column} ${operator} ?`);
      values.push(Number(params[parameter]));
    }
  }
  return { where: where.join(' AND '), values };
}

export async function listCars(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
  const { where, values } = buildPublicFilter(req.query);
  const order = {
    oldest: 'year ASC', newest: 'year DESC', recent: 'created_at DESC',
    price_asc: 'price ASC', price_desc: 'price DESC'
  }[req.query.sort] || 'year DESC';
  const [cars, [count]] = await Promise.all([
    query(`SELECT ${carColumns} FROM cars WHERE ${where} ORDER BY ${order}, id ASC LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]),
    query(`SELECT COUNT(*) AS total FROM cars WHERE ${where}`, values)
  ]);
  const total = Number(count.total);
  res.json({ cars: cars.map((car) => serializeCar(car)), total, page, pages: Math.ceil(total / limit) });
}

export async function getCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'This car is unavailable or could not be found.' });
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? AND status = 'approved' LIMIT 1`, [req.params.id]);
  if (!car) return res.status(404).json({ error: 'This car is unavailable or could not be found.' });
  const [similar] = await Promise.all([
    query(`SELECT ${carColumns} FROM cars WHERE id <> ? AND status = 'approved'
      AND (brand = ? OR price BETWEEN ? AND ?) ORDER BY featured DESC LIMIT 4`,
    [car._id, car.brand, car.price * 0.75, car.price * 1.25])
  ]);
  res.json({ car: serializeCar(car), similar: similar.map((item) => serializeCar(item)) });
}

export async function getOwnedCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? AND seller_id = ? LIMIT 1`, [req.params.id, req.user.id]);
  if (!car) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  res.json({ car: serializeCar(car, { includeSellerPhone: true }) });
}

export async function createCar(req, res) {
  if (!req.files?.length) return res.status(400).json({ error: 'Upload at least one car photo.' });
  let input;
  try {
    verifyImageFiles(req.files);
    input = validateCarInput({
      ...req.body, sellerName: req.body.seller_name || req.user.name,
      sellerPhone: req.body.seller_phone || req.user.phone
    });
  } catch (error) {
    cleanUploadedFiles(req.files);
    throw error;
  }
  const id = createId();
  const photos = uploadedPhotoPaths(req.files);
  try {
    await execute(`INSERT INTO cars
      (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
       seller_id, seller_name, seller_phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, input.brand, input.model, input.year, input.price, input.mileage, input.fuel, input.transmission,
      input.owners, input.location, input.description, JSON.stringify(photos), req.user.id, input.sellerName, input.sellerPhone]);
  } catch (error) {
    cleanUploadedFiles(req.files);
    throw error;
  }
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ?`, [id]);
  await logActivity('Listing submitted', `${req.user.name} submitted ${car.brand} ${car.model} for approval.`);
  res.status(201).json({ car: serializeCar(car, { includeSellerPhone: true }), message: 'Your listing was submitted for approval.' });
}

export async function listMyCars(req, res) {
  const cars = await query(`SELECT ${carColumns} FROM cars WHERE seller_id = ? ORDER BY created_at DESC`, [req.user.id]);
  res.json({ cars: cars.map((car) => serializeCar(car, { includeSellerPhone: true })) });
}

function retainedPhotoList(value, existing) {
  if (value === undefined) return existing;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => existing.includes(item));
  } catch { return existing.includes(value) ? [value] : []; }
  return [];
}

export async function updateMyCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  const [row] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? AND seller_id = ? LIMIT 1`, [req.params.id, req.user.id]);
  const car = mapCar(row);
  if (!car) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  if (car.isDemo) return res.status(403).json({ error: 'Sample listings cannot be edited.' });
  if (['sold', 'unavailable'].includes(car.status)) return res.status(409).json({ error: 'Sold or unavailable listings cannot be edited.' });
  let input;
  let photos;
  try {
    verifyImageFiles(req.files);
    input = validateCarInput({
      ...req.body, sellerName: req.body.seller_name || car.sellerName,
      sellerPhone: req.body.seller_phone || car.sellerPhone
    });
    const retained = retainedPhotoList(req.body.retainedPhotos, car.photos);
    const additions = uploadedPhotoPaths(req.files);
    if (retained.length + additions.length > 8) throw Object.assign(new Error('A listing can have up to 8 photos.'), { status: 400 });
    photos = [...retained, ...additions];
  } catch (error) {
    cleanUploadedFiles(req.files);
    throw error;
  }
  try {
    await execute(`UPDATE cars SET brand = ?, model = ?, year = ?, price = ?, mileage = ?, fuel = ?,
      transmission = ?, owners = ?, location = ?, description = ?, seller_name = ?, seller_phone = ?,
      photos = ?, status = 'pending' WHERE id = ?`,
    [input.brand, input.model, input.year, input.price, input.mileage, input.fuel, input.transmission,
      input.owners, input.location, input.description, input.sellerName, input.sellerPhone, JSON.stringify(photos), car._id]);
  } catch (error) {
    cleanUploadedFiles(req.files);
    throw error;
  }
  const [updated] = await query(`SELECT ${carColumns} FROM cars WHERE id = ?`, [car._id]);
  res.json({ car: serializeCar(updated, { includeSellerPhone: true }), message: 'Changes saved and sent for approval.' });
}

export async function deleteMyCar(req, res) {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  const [car] = await query(`SELECT ${carColumns} FROM cars WHERE id = ? AND seller_id = ? AND is_demo = FALSE LIMIT 1`, [req.params.id, req.user.id]);
  if (!car) return res.status(404).json({ error: 'Listing not found or you do not own it.' });
  await execute('DELETE FROM cars WHERE id = ?', [req.params.id]);
  await Promise.all(mapCar(car).photos.filter((photo) => photo.startsWith('/uploads/')).map((photo) =>
    fs.promises.unlink(path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'backend/uploads', path.basename(photo))).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    })
  ));
  res.json({ deleted: true });
}

export async function listFavourites(req, res) {
  const cars = await query(`SELECT ${carColumns.split(', ').map((column) => `cars.${column}`).join(', ')}
    FROM favourites JOIN cars ON cars.id = favourites.car_id
    WHERE favourites.user_id = ? AND cars.status = 'approved' ORDER BY cars.created_at DESC`, [req.user.id]);
  res.json({ cars: cars.map((car) => serializeCar(car)) });
}

export async function addFavourite(req, res) {
  if (!isValidId(req.params.carId)) return res.status(404).json({ error: 'This car is no longer available.' });
  const [car] = await query('SELECT id FROM cars WHERE id = ? AND status = ? LIMIT 1', [req.params.carId, 'approved']);
  if (!car) return res.status(404).json({ error: 'This car is no longer available.' });
  await execute('INSERT OR IGNORE INTO favourites (user_id, car_id) VALUES (?, ?)', [req.user.id, car.id]);
  res.json({ saved: true });
}

export async function removeFavourite(req, res) {
  if (isValidId(req.params.carId)) {
    await execute('DELETE FROM favourites WHERE user_id = ? AND car_id = ?', [req.user.id, req.params.carId]);
  }
  res.json({ saved: false });
}
