const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ DATABASE_URL no está configurada');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool,
};