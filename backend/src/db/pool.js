/**
 * PostgreSQL connection pool
 * Uses the `pg` library with a single pool shared across the app.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production (Railway / Render) the DB URL already includes SSL params.
  // Uncomment the line below if your provider requires SSL:
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,               // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
