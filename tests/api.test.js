import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import 'dotenv/config';

let server;
let baseUrl;
let demoCars;
let database;
const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'saran-cars-api-test-'));
const uploadDir = path.join(testDirectory, 'uploads');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv2sAAAAASUVORK5CYII=', 'base64');

before(async () => {
  process.env.JWT_SECRET = 'api-test-only-secret-with-more-than-thirty-two-characters';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.UPLOAD_DIR = uploadDir;
  process.env.SQLITE_PATH = path.join(testDirectory, 'api-test.sqlite');
  const [serverModule, dbModule, idModule, seedModule, bcryptModule] = await Promise.all([
    import('../backend/src/index.js'),
    import('../backend/src/config/sqlite.js'),
    import('../backend/src/db/ids.js'),
    import('../backend/src/seed/demoCars.js'),
    import('bcryptjs')
  ]);
  database = dbModule;
  demoCars = seedModule.default;
  server = await serverModule.startServer(0);
  for (const car of demoCars) {
    await database.execute(`INSERT INTO cars
      (id, brand, model, year, price, mileage, fuel, transmission, owners, location, description, photos,
       seller_id, seller_name, seller_phone, status, featured, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    [idModule.createId(), car.brand, car.model, car.year, car.price, car.mileage, car.fuel, car.transmission,
      car.owners, car.location, car.description, JSON.stringify(car.photos), car.sellerName, car.sellerPhone,
      car.status, car.featured, car.isDemo]);
  }
  await database.execute(`INSERT INTO users (id, name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)`, [
    idModule.createId(), 'Integration Admin', 'api-admin@example.test', '+14155550100',
    await bcryptModule.default.hash('Test-Admin-Password-2026!', 12), 'admin'
  ]);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (database) await database.closeDatabase();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

async function request(route, { method = 'GET', cookie, json, form } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api${route}`, {
    method, headers, body: form || (json === undefined ? undefined : JSON.stringify(json))
  });
  const data = await response.json();
  return { response, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('SQLite schema initializes the complete application data model', () => {
  const tables = database.query(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?) ORDER BY name`,
  ['users', 'cars', 'favourites', 'purchase_enquiries', 'contact_messages', 'activities']);
  assert.deepEqual(tables.map((row) => row.name), [
    'activities', 'cars', 'contact_messages', 'favourites', 'purchase_enquiries', 'users'
  ]);
});

test('registration, sessions, listing moderation, search, favourites, uploads, and enquiries', async () => {
  const health = await request('/health');
  assert.equal(health.response.status, 200);
  assert.match(health.response.headers.get('content-security-policy'), /img-src 'self' data:/);

  const deniedAdmin = await request('/admin/stats');
  assert.equal(deniedAdmin.response.status, 401);

  const registration = await request('/auth/register', {
    method: 'POST',
    json: { name: 'Test Seller', email: 'seller@example.test', phone: '+14155550101', password: 'Test-User-Password-2026!' }
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.data.user.role, 'user');
  assert.match(registration.cookie, /^saran_session=/);
  const currentUser = await request('/auth/me', { cookie: registration.cookie });
  assert.equal(currentUser.response.status, 200);
  assert.equal(currentUser.data.user.id, registration.data.user.id);

  const login = await request('/auth/login', {
    method: 'POST', json: { email: 'seller@example.test', password: 'Test-User-Password-2026!' }
  });
  assert.equal(login.response.status, 200);
  const sellerCookie = login.cookie;
  const buyerRegistration = await request('/auth/register', {
    method: 'POST',
    json: { name: 'Test Buyer', email: 'buyer@example.test', phone: '+14155550102', password: 'Test-Buyer-Password-2026!' }
  });
  assert.equal(buyerRegistration.response.status, 201);
  const buyerLogin = await request('/auth/login', {
    method: 'POST', json: { email: 'buyer@example.test', password: 'Test-Buyer-Password-2026!' }
  });
  assert.equal(buyerLogin.response.status, 200);
  const userCookie = buyerLogin.cookie;

  const demoList = await request('/cars?limit=1');
  assert.equal(demoList.response.status, 200);
  assert.equal(demoList.data.total, 50);
  assert.equal(demoList.data.cars[0].is_demo, true);
  assert.equal('seller_phone' in demoList.data.cars[0], false);
  for (const car of demoCars) {
    assert.equal(car.photos.length, 1, `${car.brand} ${car.model} should have a model-specific image`);
    assert.match(car.photos[0], /^\/cars\/[a-z0-9-]+\.(?:jpg|png|svg)$/);
    assert.equal(fs.existsSync(path.resolve('public', car.photos[0].slice(1))), true, `Missing image asset for ${car.brand} ${car.model}`);
  }
  assert.equal(new Set(demoCars.slice(0, 33).map((car) => car.photos[0])).size, 33);
  assert.equal(demoCars.find((car) => car.model.startsWith('Thar')).photos[0], '/cars/mahindra-thar.jpg');
  assert.equal(demoCars.find((car) => car.model.startsWith('Wagon R')).photos[0], '/cars/maruti-wagon-r.png');
  const expectedModels = [
    'Glanza', 'Innova Crysta', 'Fortuner', 'Urban Cruiser Hyryder', 'Rumion',
    'Thar', 'Scorpio-N', 'XUV700', 'Bolero', 'XUV 3XO', 'Swift', 'Baleno', 'Wagon R',
    'Brezza', 'Dzire', 'Creta', 'Venue', 'i20', 'Grand i10 Nios', 'Verna',
    'Nexon', 'Punch', 'Harrier', 'Safari', 'Tiago', 'Nexon EV', 'Punch EV',
    'Windsor EV', 'BE 6', 'Creta Electric'
  ];
  for (const model of expectedModels) {
    assert.ok(demoCars.some((car) => car.model.includes(model)), `Missing demo model ${model}`);
  }
  assert.equal(demoCars.filter((car) => car.fuel === 'Electric').length, 5);
  assert.ok(demoCars.every((car) => car.isDemo === true));
  assert.equal((await request('/cars?brand=Toyota&limit=30')).data.total, 6);
  assert.equal((await request('/cars?brand=Tata&fuel=Electric&limit=30')).data.total, 2);
  assert.equal((await request('/cars?fuel=Electric&limit=30')).data.total, 5);
  const mileageRange = await request('/cars?minMileage=50000&maxMileage=60000&limit=30');
  assert.ok(mileageRange.data.cars.length > 0);
  assert.ok(mileageRange.data.cars.every((car) => car.mileage >= 50000 && car.mileage <= 60000));
  const thar = await request('/cars?q=Thar&limit=10');
  assert.equal(thar.data.cars.find((car) => car.model.includes('Thar')).photos[0], '/cars/mahindra-thar.jpg');
  const wagonR = await request('/cars?q=Wagon%20R&limit=10');
  assert.equal(wagonR.data.cars.find((car) => car.model.includes('Wagon R')).photos[0], '/cars/maruti-wagon-r.png');
  const cretaElectric = await request('/cars?q=Creta%20Electric&limit=10');
  const evDetails = await request(`/cars/${cretaElectric.data.cars[0].id}`);
  assert.equal(evDetails.data.car.fuel, 'Electric');
  assert.equal(evDetails.data.car.photos[0], '/cars/hyundai-creta-electric.jpg');
  const oldest = await request('/cars?sort=oldest&limit=1');
  const newest = await request('/cars?sort=newest&limit=1');
  assert.equal(oldest.data.cars[0].year, 2005);
  assert.equal(newest.data.cars[0].year, 2026);
  const brandSearch = await request('/cars?q=Creta&limit=10');
  assert.ok(brandSearch.data.cars.some((car) => car.model.includes('Creta')));

  const form = new FormData();
  for (const [key, value] of Object.entries({
    brand: 'Honda', model: 'City Test Edition', year: '2021', price: '950000',
    mileage: '28000', fuel: 'Petrol', transmission: 'Automatic', owners: '1',
    location: 'Chennai', description: 'Carefully maintained test listing for API verification.',
    seller_name: 'Test Buyer', seller_phone: '+14155550101'
  })) form.append(key, value);
  form.append('images', new Blob([png], { type: 'image/png' }), 'test-car.png');
  const submission = await request('/cars', { method: 'POST', cookie: sellerCookie, form });
  assert.equal(submission.response.status, 201);
  assert.equal(submission.data.car.status, 'pending');
  assert.match(submission.data.car.photos[0], /^\/uploads\//);
  const hiddenPending = await request('/cars?q=City%20Test%20Edition');
  assert.equal(hiddenPending.data.total, 0);

  const adminLogin = await request('/auth/login', {
    method: 'POST', json: { email: 'api-admin@example.test', password: 'Test-Admin-Password-2026!' }
  });
  assert.equal(adminLogin.response.status, 200);
  const adminCookie = adminLogin.cookie;
  const forbiddenAdmin = await request('/admin/stats', { cookie: userCookie });
  assert.equal(forbiddenAdmin.response.status, 403);
  assert.equal((await request('/admin/cars', { method: 'POST', cookie: userCookie })).response.status, 403);
  const adminStats = await request('/admin/stats', { cookie: adminCookie });
  assert.equal(adminStats.response.status, 200);
  assert.equal(adminStats.data.pendingCars, 1);
  assert.equal(adminStats.data.users, 2);
  const adminUsers = await request('/admin/users', { cookie: adminCookie });
  assert.equal(adminUsers.response.status, 200);
  assert.equal(adminUsers.data.users.length, 2);
  const activities = await request('/admin/activities', { cookie: adminCookie });
  assert.equal(activities.response.status, 200);
  assert.ok(activities.data.activities.length > 0);

  const adminCarForm = new FormData();
  for (const [key, value] of Object.entries({
    brand: 'Kia', model: 'Admin Added Seltos', year: '2023', price: '1650000',
    mileage: '18000', fuel: 'Diesel', transmission: 'Automatic', owners: '1',
    location: 'Chennai', description: 'Admin-created test car with all required listing details.',
    sellerName: 'Saran Cars Admin', sellerPhone: '+14155550100'
  })) adminCarForm.append(key, value);
  adminCarForm.append('images', new Blob([png], { type: 'image/png' }), 'admin-car.png');
  const adminCar = await request('/admin/cars', { method: 'POST', cookie: adminCookie, form: adminCarForm });
  assert.equal(adminCar.response.status, 201);
  assert.equal(adminCar.data.car.status, 'approved');
  const adminPhotoPath = path.join(uploadDir, path.basename(adminCar.data.car.photos[0]));
  assert.equal(fs.existsSync(adminPhotoPath), true);
  const adminCarPublic = await request('/cars?q=Admin%20Added%20Seltos&limit=30');
  assert.equal(adminCarPublic.data.total, 1);
  const filteredAdminCars = await request('/admin/cars?status=approved&fuel=Diesel&minYear=2023&maxYear=2023&minPrice=1600000&maxPrice=1700000', { cookie: adminCookie });
  assert.ok(filteredAdminCars.data.cars.some((car) => car.id === adminCar.data.car.id));
  const userCarDetails = await request(`/admin/users/${registration.data.user.id}/cars`, { cookie: adminCookie });
  assert.equal(userCarDetails.response.status, 200);
  assert.equal(userCarDetails.data.cars.length, 1);
  const featuredAdminCar = await request(`/admin/cars/${adminCar.data.car.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { featured: true }
  });
  assert.equal(featuredAdminCar.response.status, 200);
  assert.equal(featuredAdminCar.data.car.featured, true);
  const featuredPublic = await request('/cars?featured=true&q=Admin%20Added%20Seltos&limit=30');
  assert.equal(featuredPublic.data.total, 1);
  const imageEdit = new FormData();
  imageEdit.append('retainedPhotos', '[]');
  imageEdit.append('images', new Blob([png], { type: 'image/png' }), 'replacement-car.png');
  const replacedImage = await request(`/admin/cars/${adminCar.data.car.id}`, {
    method: 'PATCH', cookie: adminCookie, form: imageEdit
  });
  assert.equal(replacedImage.response.status, 200);
  assert.equal(replacedImage.data.car.photos.length, 1);
  const replacementPhotoPath = path.join(uploadDir, path.basename(replacedImage.data.car.photos[0]));
  assert.equal(fs.existsSync(adminPhotoPath), false);
  assert.equal(fs.existsSync(replacementPhotoPath), true);
  const deletedAdminCar = await request(`/admin/cars/${adminCar.data.car.id}`, { method: 'DELETE', cookie: adminCookie });
  assert.equal(deletedAdminCar.response.status, 200);
  assert.equal(fs.existsSync(replacementPhotoPath), false);
  assert.equal((await request('/cars?q=Admin%20Added%20Seltos&limit=30')).data.total, 0);

  const approval = await request(`/admin/cars/${submission.data.car.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { status: 'approved' }
  });
  assert.equal(approval.response.status, 200);
  const searchable = await request('/cars?q=City%20Test%20Edition');
  assert.equal(searchable.data.total, 1);
  const favourite = await request(`/favourites/${submission.data.car.id}`, { method: 'PUT', cookie: userCookie, json: {} });
  assert.equal(favourite.response.status, 200);
  const saved = await request('/favourites', { cookie: userCookie });
  assert.equal(saved.data.cars[0].id, submission.data.car.id);

  const enquiry = await request(`/cars/${submission.data.car.id}/enquiries`, { method: 'POST', cookie: userCookie, json: { type: 'purchase' } });
  assert.equal(enquiry.response.status, 201);
  const adminEnquiries = await request('/admin/enquiries', { cookie: adminCookie });
  assert.equal(adminEnquiries.data.enquiries.length, 1);
  const myEnquiries = await request('/enquiries', { cookie: userCookie });
  assert.equal(myEnquiries.response.status, 200);
  assert.equal(myEnquiries.data.enquiries.length, 1);
  const statusUpdate = await request(`/admin/enquiries/${enquiry.data.enquiry.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { status: 'Contacted' }
  });
  assert.equal(statusUpdate.data.status, 'Contacted');

  const edited = await request(`/cars/${submission.data.car.id}`, {
    method: 'PATCH', cookie: sellerCookie,
    form: (() => {
      const edit = new FormData();
      for (const [key, value] of Object.entries({
        brand: 'Honda', model: 'City Updated Edition', year: '2021', price: '940000',
        mileage: '29000', fuel: 'Petrol', transmission: 'Automatic', owners: '1',
        location: 'Chennai', description: 'Updated carefully maintained test listing for API verification.',
        seller_name: 'Test Buyer', seller_phone: '+14155550101',
        retainedPhotos: JSON.stringify(submission.data.car.photos)
      })) edit.append(key, value);
      return edit;
    })()
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.data.car.status, 'pending');
  assert.equal((await request(`/admin/cars/${submission.data.car.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { status: 'approved' }
  })).response.status, 200);

  const completed = await request(`/admin/enquiries/${enquiry.data.enquiry.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { status: 'Completed' }
  });
  assert.equal(completed.response.status, 200);
  const blocked = await request(`/cars/${submission.data.car.id}/enquiries`, { method: 'POST', cookie: userCookie, json: { type: 'purchase' } });
  assert.equal(blocked.response.status, 409);

  const disabled = await request(`/admin/users/${registration.data.user.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { active: false }
  });
  assert.equal(disabled.response.status, 200);
  assert.equal((await request('/auth/me', { cookie: sellerCookie })).response.status, 401);
  const enabled = await request(`/admin/users/${registration.data.user.id}`, {
    method: 'PATCH', cookie: adminCookie, json: { active: true }
  });
  assert.equal(enabled.response.status, 200);
});
