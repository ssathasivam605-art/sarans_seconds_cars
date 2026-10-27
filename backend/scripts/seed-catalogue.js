import 'dotenv/config';
import { closeDatabase, execute, query } from '../src/config/sqlite.js';
import { initializeDatabase } from '../src/db/sqlite-migrate.js';
import vehicleCatalogue from '../src/seed/vehicleCatalogue.js';

try {
  await initializeDatabase();
  for (const vehicle of vehicleCatalogue) {
    await execute(`INSERT INTO vehicle_catalogue
      (brand, model, body_type, available_from, available_through, market)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(brand, model, market) DO UPDATE SET
        body_type = excluded.body_type,
        available_from = excluded.available_from,
        available_through = excluded.available_through`,
    [vehicle.brand, vehicle.model, vehicle.bodyType, vehicle.availableFrom, vehicle.availableThrough, vehicle.market]);
  }
  const updated = await execute(`UPDATE cars SET body_type = (
      SELECT body_type FROM vehicle_catalogue
      WHERE vehicle_catalogue.brand = cars.brand
        AND cars.model LIKE vehicle_catalogue.model || '%'
      ORDER BY length(vehicle_catalogue.model) DESC LIMIT 1
    )
    WHERE body_type IS NULL AND EXISTS (
      SELECT 1 FROM vehicle_catalogue
      WHERE vehicle_catalogue.brand = cars.brand
        AND cars.model LIKE vehicle_catalogue.model || '%'
    )`);
  const [total] = query('SELECT COUNT(*) AS total FROM vehicle_catalogue');
  console.log(`Seeded ${total.total} India-market model records (${vehicleCatalogue.length} source models); updated ${updated.changedRows} listings with model body types. Existing listings and accounts were preserved.`);
} catch (error) {
  console.error(`Could not seed the vehicle catalogue: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
