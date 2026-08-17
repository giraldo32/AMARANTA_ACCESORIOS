const { query, pool } = require('./db');

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: No existe una variable de conexión PostgreSQL.');
}

const pool = new Pool({
  connectionString,

  ssl: {
    rejectUnauthorized: false
  },

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