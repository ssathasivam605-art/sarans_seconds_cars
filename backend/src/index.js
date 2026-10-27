import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import app from './app.js';
import { initializeDatabase } from './db/sqlite-migrate.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters. Copy .env.example to .env and set a unique secret.');
}

const port = Number(process.env.PORT || 4001);
export async function startServer(listenPort = port) {
  await initializeDatabase();
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(listenPort, () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  console.log(`Saran Cars API listening on http://localhost:${typeof address === 'object' ? address.port : listenPort}`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch((error) => {
    console.error(`Could not start Saran Cars: ${error.message}`);
    process.exitCode = 1;
  });
}
