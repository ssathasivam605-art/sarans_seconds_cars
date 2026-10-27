import 'dotenv/config';
import { closeDatabase, execute, query } from '../src/config/sqlite.js';
import { createId } from '../src/db/ids.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';
import demoCars from '../src/seed/demoCars.js';

try {
  await initializeDatabase();
  const existing = await query('SELECT brand, model, year FROM cars WHERE is_demo = TRUE');
  const existingKeys = new Set(existing.map(({ brand, model, year }) => `${brand}|${model}|${year}`));
  let inserted = 0;
  let updated = 0;
  for (const car of demoCars) {
    const matching = await query(
      'SELECT id FROM cars WHERE is_demo = TRUE AND brand = ? AND model = ? AND year = ? LIMIT 1',
      [car.brand, car.model, car.year]
    );
    if (matching.length) {
      const result = await execute('UPDATE cars SET photos = ? WHERE id = ?', [JSON.stringify(car.photos), matching[0].id]);
      updated += result.changedRows;
    } else if (!existingKeys.has(`${car.brand}|${car.model}|${car.year}`)) {
      await execute(`INSERT INTO cars
        (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
         seller_id, seller_name, seller_phone, status, featured, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, TRUE)`,
      [createId(), car.brand, car.model, car.year, car.price, car.mileage, car.fuel, car.transmission,
        car.owners, car.location, car.description, JSON.stringify(car.photos), car.sellerName, car.sellerPhone,
        car.status, car.featured]);
      inserted += 1;
    }
  }
  console.log(`Inserted ${inserted} missing sample cars and updated photos for ${updated} existing sample cars; other listing data was preserved.`);
} catch (error) {
  console.error(`Could not seed sample cars: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
