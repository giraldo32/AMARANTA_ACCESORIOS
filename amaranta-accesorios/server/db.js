require('dotenv').config();

const { Pool } = require('pg');

function buildSslConfig() {
  if (process.env.NODE_ENV === 'production' || /sslmode=require/i.test(process.env.DATABASE_URL || '')) {
    return { rejectUnauthorized: false };
  }

  return false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
});

pool.on('connect', () => {
  console.log('✅ Conexión a PostgreSQL establecida');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en la conexión de PostgreSQL:', err);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
