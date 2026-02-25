/**
 * API Key Authentication Middleware
 *
 * Reads the `x-api-key` header, looks up the user in PostgreSQL,
 * and attaches `req.user` for downstream handlers.
 */
const pool = require('../db/pool');

async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key. Pass it in the x-api-key header.',
    });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, plan, logs_used_this_month, billing_cycle_start FROM users WHERE api_key = $1',
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { requireApiKey };
