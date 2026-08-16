require('dotenv').config();

const { Pool } = require('pg');

const isProduction =
  process.env.VERCEL === '1' ||
  process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: isProduction
    ? {
        rejectUnauthorized: false
      }
    : false,

  max: 5,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000
});

pool.on('connect', () => {
  console.log('✅ Conexión a PostgreSQL establecida');
});

pool.on('error', (err) => {
  console.error(
    '❌ Error inesperado en PostgreSQL:',
    err
  );
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

module.exports = {
  query,
  getClient,
  pool
};