const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL no está configurada');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString
    ? {
        rejectUnauthorized: false
      }
    : false,

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('❌ Error PostgreSQL:', error.message);
    throw error;
  }
}

module.exports = {
  query,
  pool
};