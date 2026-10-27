import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) throw new Error(`${missing.join(', ')} must be configured in the root .env file.`);
    const port = Number(process.env.MYSQL_PORT || 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MYSQL_PORT must be a valid TCP port.');
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
  }
  return pool;
}

export async function query(sql, values = []) {
  const [rows] = await getPool().execute(sql, values);
  return rows;
}

export async function execute(sql, values = []) {
  const [result] = await getPool().execute(sql, values);
  return result;
}

export async function connectDatabase() {
  const connection = await getPool().getConnection();
  try {
    await connection.ping();
    console.log(`Connected to MySQL database "${process.env.MYSQL_DATABASE}".`);
  } finally {
    connection.release();
  }
}

export async function closeDatabase() {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
