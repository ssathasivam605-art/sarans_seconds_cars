import 'dotenv/config';
import mysql from 'mysql2/promise';
import { closeDatabase, execute, query, transaction } from '../src/config/sqlite.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';

const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`${missing.join(', ')} must be set in .env to import from the existing MySQL database.`);

function timestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string' || !value) return new Date().toISOString();
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toISOString();
}

function photosJson(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error('A MySQL car photos value is not a JSON array.');
  return JSON.stringify(parsed);
}

let source;
try {
  source = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    timezone: 'Z'
  });
  const [users] = await source.query('SELECT * FROM users');
  const [cars] = await source.query('SELECT * FROM cars');
  const [favourites] = await source.query('SELECT * FROM favourites');
  const [enquiries] = await source.query('SELECT * FROM purchase_enquiries');
  const [contacts] = await source.query('SELECT * FROM contact_messages');
  const [activities] = await source.query('SELECT * FROM activities');

  await initializeDatabase();
  const tables = ['users', 'cars', 'favourites', 'purchase_enquiries', 'contact_messages', 'activities'];
  for (const table of tables) {
    const [row] = query(`SELECT COUNT(*) AS total FROM ${table}`);
    if (Number(row.total) !== 0) {
      throw new Error(`SQLite import target must be empty; table "${table}" already contains data. Nothing was imported.`);
    }
  }

  transaction(() => {
    for (const user of users) {
      execute(`INSERT INTO users (id, name, email, phone, password_hash, role, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.phone, user.password_hash, user.role, Boolean(user.active),
        timestamp(user.created_at), timestamp(user.updated_at)]);
    }
    for (const car of cars) {
      execute(`INSERT INTO cars
        (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
         seller_id, seller_name, seller_phone, status, featured, is_demo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [car.id, car.brand, car.model, car.year, car.price, car.mileage, car.fuel, car.transmission,
        car.owners, car.location, car.description, photosJson(car.photos), car.seller_id,
        car.seller_name, car.seller_phone, car.status, Boolean(car.featured), Boolean(car.is_demo),
        timestamp(car.created_at), timestamp(car.updated_at)]);
    }
    for (const favourite of favourites) {
      execute('INSERT INTO favourites (user_id, car_id, created_at) VALUES (?, ?, ?)',
        [favourite.user_id, favourite.car_id, timestamp(favourite.created_at)]);
    }
    for (const enquiry of enquiries) {
      execute(`INSERT INTO purchase_enquiries
        (id, buyer_id, car_id, type, message, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [enquiry.id, enquiry.buyer_id, enquiry.car_id, enquiry.type, enquiry.message,
        enquiry.status, timestamp(enquiry.created_at), timestamp(enquiry.updated_at)]);
    }
    for (const contact of contacts) {
      execute(`INSERT INTO contact_messages (id, name, email, message, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      [contact.id, contact.name, contact.email, contact.message, timestamp(contact.created_at)]);
    }
    for (const activity of activities) {
      execute('INSERT INTO activities (id, action, detail, created_at) VALUES (?, ?, ?, ?)',
        [activity.id, activity.action, activity.detail, timestamp(activity.created_at)]);
    }
  });
  console.log(`Imported ${users.length} users, ${cars.length} cars, ${favourites.length} favourites, ${enquiries.length} enquiries, ${contacts.length} contact messages, and ${activities.length} activities into ${process.env.SQLITE_PATH || 'backend/data/saran-cars.sqlite'}. The MySQL source was not changed.`);
} catch (error) {
  console.error(`MySQL-to-SQLite import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (source) await source.end();
  await closeDatabase();
}
