# SARAN CARS

SARAN CARS is a full-stack pre-owned car marketplace. The React/Vite frontend uses React Router and Axios. The Express API uses the SQLite database built into Node.js and stores local development data in `backend/data/saran-cars.sqlite`.

## Requirements

- Node.js 24 or newer and npm
- No MySQL or MongoDB server is required to run the application locally

The SQLite database file is created automatically, persists between restarts, and is excluded from Git. Existing MySQL connection code and schema are retained as migration backups; the running app does not connect to MySQL. `mysql2` is retained only for the optional MySQL-to-SQLite import script.

## Local setup

1. Install Node dependencies from the project root:

   ```powershell
   npm install
   ```

2. Set a private JWT secret in the root `.env` file. Keep any existing `.env`; do not overwrite it with `.env.example`. You can generate a secret in PowerShell with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Put the generated value in `JWT_SECRET`. The application uses an expiring JWT in an HTTP-only, SameSite cookie and does not store credentials or tokens in browser local storage. `SQLITE_PATH` is optional; it defaults to `./backend/data/saran-cars.sqlite`.

3. Create or update the SQLite schema:

   ```powershell
   npm run db:migrate
   ```

   This command creates the data directory and tables if needed. It does not remove or reset existing data. The server also applies the same idempotent schema during startup.

4. Optionally add clearly labelled demo car listings:

   ```powershell
   npm run seed:demo
   ```

   Re-running the seed only adds missing demo records and refreshes matching demo photo paths; it does not replace user listings or accounts.

5. Start the app:

   ```powershell
   npm run dev
   ```

   Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API listens on port 4001. If the frontend selects another port because 5173 is busy, use the URL it prints.

## Administrator setup

For an initial admin account, set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 14 characters), and optionally `ADMIN_PHONE` in the private `.env`, then run:

```powershell
npm run admin:create
```

The command refuses to overwrite an existing account. Remove `ADMIN_PASSWORD` from `.env` after setup. To reset an existing administrator password, set `ADMIN_EMAIL` and a new `ADMIN_PASSWORD` privately, then run:

```powershell
npm run admin:reset-password
```

## Import existing MySQL data (optional)

The app does not need MySQL to run. If you have an existing MySQL database and want to copy its data into SQLite, first back up the source. Configure `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` in your private `.env` for that existing database. The importer reads the source and does not modify it.

Make sure the SQLite target is new or empty. The importer checks all target tables and refuses to proceed if any contain rows; it never clears destination or source data.

```powershell
npm run db:import:mysql
```

The source MySQL schema must contain `users`, `cars`, `favourites`, `purchase_enquiries`, `contact_messages`, and `activities` using the project’s former schema. Imported password hashes remain usable. Keep a verified backup until you have checked the migrated data. The original MySQL connector and schema remain in `backend/src/config/db.js`, `backend/src/db/migrate.js`, and `backend/src/db/schema.sql`.

## Tests and checks

The API suite creates a new SQLite database and upload directory in the operating system temporary folder for each run, then removes only that test-created temporary folder when finished. It does not read, write, or clear your app database.

```powershell
npm run test:api
```

Other checks:

```powershell
npm run lint
npm run build
```

## Features

- Registration, login/logout, profile editing, bcrypt password hashing, JWT cookie sessions, and protected user/admin routes.
- Search, filter, sort, paginate, and view approved car listings; favourites and similar cars.
- Seller listing creation/editing/deletion with moderation and up to 8 validated JPG/PNG/WebP image uploads.
- Admin statistics, user activation, listing moderation, enquiries, and recent activity.
- Contact messages and purchase enquiries stored in SQLite. Enquiries are not payments; the app does not send email.

## Project areas

- `frontend/` — React/Vite app
- `backend/src/config/sqlite.js` — active SQLite connection
- `backend/src/db/sqlite-schema.sql` and `backend/src/db/sqlite-migrate.js` — active SQLite schema and initialization
- `backend/src/config/db.js`, `backend/src/db/migrate.js`, and `backend/src/db/schema.sql` — retained MySQL backup implementation
- `backend/src/controllers/`, `routes/`, `middleware/`, `validators/` — API and feature logic
- `backend/scripts/` — database/admin/demo setup and optional import commands
- `backend/data/` — persistent local data, ignored by Git
- `backend/uploads/` — uploaded listing images, ignored by Git

## Commands

- `npm run dev` — run frontend and backend together
- `npm run server:dev` — run the backend
- `npm run client:dev` — run the frontend only
- `npm run db:migrate` — create/update the SQLite schema
- `npm run db:import:mysql` — copy data from the configured MySQL source into an empty SQLite target
- `npm run seed:demo` — add demo listings
- `npm run admin:create` — create the initial administrator
- `npm run admin:reset-password` — reset the configured administrator password
- `npm run test:api` — run the API suite on an isolated temporary SQLite database
- `npm run lint` — run ESLint
- `npm run build` — build the frontend
