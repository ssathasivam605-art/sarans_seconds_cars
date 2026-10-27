CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY CHECK (length(id) = 24),
  name TEXT NOT NULL CHECK (length(name) <= 80),
  email TEXT NOT NULL UNIQUE CHECK (length(email) <= 254),
  phone TEXT NOT NULL CHECK (length(phone) <= 20),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS users_role_created ON users(role, created_at);

CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY CHECK (length(id) = 24),
  brand TEXT NOT NULL CHECK (length(brand) <= 60),
  model TEXT NOT NULL CHECK (length(model) <= 80),
  variant TEXT CHECK (variant IS NULL OR length(variant) <= 100),
  year INTEGER NOT NULL CHECK (year BETWEEN 1950 AND 65535),
  registration_year INTEGER CHECK (registration_year IS NULL OR registration_year BETWEEN 1950 AND 65535),
  price INTEGER NOT NULL CHECK (price BETWEEN 10000 AND 100000000),
  ex_showroom_price INTEGER CHECK (ex_showroom_price IS NULL OR ex_showroom_price BETWEEN 10000 AND 100000000),
  mileage INTEGER NOT NULL CHECK (mileage BETWEEN 0 AND 2000000),
  fuel TEXT NOT NULL CHECK (fuel IN ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid')),
  transmission TEXT NOT NULL CHECK (transmission IN ('Manual', 'Automatic')),
  body_type TEXT CHECK (body_type IS NULL OR body_type IN ('Hatchback', 'Sedan', 'SUV', 'MPV', 'Coupe', 'Convertible', 'Wagon', 'Pickup', 'Sports')),
  engine_capacity_cc INTEGER CHECK (engine_capacity_cc IS NULL OR engine_capacity_cc BETWEEN 1 AND 20000),
  battery_capacity_kwh REAL CHECK (battery_capacity_kwh IS NULL OR battery_capacity_kwh BETWEEN 1 AND 500),
  range_km INTEGER CHECK (range_km IS NULL OR range_km BETWEEN 1 AND 3000),
  owners INTEGER NOT NULL CHECK (owners BETWEEN 1 AND 10),
  location TEXT NOT NULL CHECK (length(location) <= 80),
  exterior_color TEXT CHECK (exterior_color IS NULL OR length(exterior_color) <= 60),
  description TEXT NOT NULL CHECK (length(description) <= 2000),
  photos TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(photos)),
  seller_id TEXT,
  seller_name TEXT NOT NULL CHECK (length(seller_name) <= 80),
  seller_phone TEXT NOT NULL CHECK (length(seller_phone) <= 20),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sold', 'unavailable')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS cars_status_year ON cars(status, year);
CREATE INDEX IF NOT EXISTS cars_status_price ON cars(status, price);
CREATE INDEX IF NOT EXISTS cars_brand_model ON cars(brand, model);
CREATE INDEX IF NOT EXISTS cars_seller_created ON cars(seller_id, created_at);
CREATE INDEX IF NOT EXISTS cars_demo_lookup ON cars(is_demo, brand, model, year);

CREATE TABLE IF NOT EXISTS vehicle_catalogue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL CHECK (length(brand) <= 60),
  model TEXT NOT NULL CHECK (length(model) <= 80),
  body_type TEXT NOT NULL CHECK (body_type IN ('Hatchback', 'Sedan', 'SUV', 'MPV', 'Coupe', 'Convertible', 'Wagon', 'Pickup', 'Sports')),
  available_from INTEGER NOT NULL CHECK (available_from BETWEEN 2015 AND 2026),
  available_through INTEGER NOT NULL CHECK (available_through BETWEEN available_from AND 2026),
  market TEXT NOT NULL DEFAULT 'India' CHECK (market = 'India'),
  UNIQUE (brand, model, market)
);
CREATE INDEX IF NOT EXISTS vehicle_catalogue_year ON vehicle_catalogue(available_from, available_through, brand);

CREATE TABLE IF NOT EXISTS favourites (
  user_id TEXT NOT NULL,
  car_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, car_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_enquiries (
  id TEXT PRIMARY KEY CHECK (length(id) = 24),
  buyer_id TEXT NOT NULL,
  car_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'purchase' CHECK (type IN ('purchase', 'contact')),
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Contacted', 'Approved', 'Completed', 'Cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS enquiries_buyer_created ON purchase_enquiries(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS enquiries_status_created ON purchase_enquiries(status, created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) <= 80),
  email TEXT NOT NULL CHECK (length(email) <= 254),
  message TEXT NOT NULL CHECK (length(message) <= 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK (length(action) <= 255),
  detail TEXT NOT NULL CHECK (length(detail) <= 1000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activities_created ON activities(created_at);
