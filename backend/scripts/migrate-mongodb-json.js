import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeDatabase, getPool } from '../src/config/db.js';
import { mongoDate, mongoId } from '../src/db/ids.js';
import { initializeDatabase } from '../src/db/migrate.js';

const source = process.argv[2];
if (!source) throw new Error('Usage: node backend/scripts/migrate-mongodb-json.js <directory-of-mongoexport-json-files>');

async function load(name) {
  const file = path.resolve(source, `${name}.json`);
  try {
    const text = await fs.readFile(file, 'utf8');
    const documents = JSON.parse(text);
    if (!Array.isArray(documents)) throw new Error(`${file} must contain a JSON array (use mongoexport --jsonArray).`);
    return documents;
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Required MongoDB export file not found: ${file}`);
    throw error;
  }
}

try {
  await initializeDatabase();
  const [users, cars, enquiries, contacts, activities] = await Promise.all([
    load('users'), load('cars'), load('purchaseenquiries'), load('contactmessages'), load('activities')
  ]);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const user of users) {
      await connection.execute(`INSERT INTO users
        (id, name, email, phone, password_hash, role, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mongoId(user._id, 'user'), user.name, user.email, user.phone, user.passwordHash,
        user.role || 'user', user.active !== false, mongoDate(user.createdAt), mongoDate(user.updatedAt || user.createdAt)]);
    }
    for (const car of cars) {
      await connection.execute(`INSERT INTO cars
        (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
         seller_id, seller_name, seller_phone, status, featured, is_demo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mongoId(car._id, 'car'), car.brand, car.model, car.year, car.price, car.mileage, car.fuel,
        car.transmission, car.owners, car.location, car.description, JSON.stringify(car.photos || []),
        car.seller ? mongoId(car.seller, 'seller') : null, car.sellerName, car.sellerPhone,
        car.status || 'pending', Boolean(car.featured), Boolean(car.isDemo),
        mongoDate(car.createdAt), mongoDate(car.updatedAt || car.createdAt)]);
    }
    for (const user of users) {
      for (const favourite of user.favourites || []) {
        await connection.execute('INSERT INTO favourites (user_id, car_id) VALUES (?, ?)',
          [mongoId(user._id, 'user'), mongoId(favourite, 'favourite car')]);
      }
    }
    for (const enquiry of enquiries) {
      await connection.execute(`INSERT INTO purchase_enquiries
        (id, buyer_id, car_id, type, message, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mongoId(enquiry._id, 'enquiry'), mongoId(enquiry.buyer, 'buyer'), mongoId(enquiry.car, 'enquiry car'),
        enquiry.type || 'purchase', enquiry.message || '', enquiry.status || 'Pending',
        mongoDate(enquiry.createdAt), mongoDate(enquiry.updatedAt || enquiry.createdAt)]);
    }
    for (const contact of contacts) {
      await connection.execute(`INSERT INTO contact_messages (name, email, message, created_at)
        VALUES (?, ?, ?, ?)`, [contact.name, contact.email, contact.message, mongoDate(contact.createdAt)]);
    }
    for (const activity of activities) {
      await connection.execute(`INSERT INTO activities (action, detail, created_at)
        VALUES (?, ?, ?)`, [activity.action, activity.detail, mongoDate(activity.createdAt)]);
    }
    await connection.commit();
    console.log(`Imported ${users.length} users, ${cars.length} cars, ${enquiries.length} enquiries, ${contacts.length} contact messages, and ${activities.length} activities.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  console.error(`MongoDB data import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
