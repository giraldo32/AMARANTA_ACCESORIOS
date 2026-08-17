const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PRISMA_DATABASE_URL;

const isProduction =
  process.env.NODE_ENV === 'production' ||
  /sslmode=require/i.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool
};