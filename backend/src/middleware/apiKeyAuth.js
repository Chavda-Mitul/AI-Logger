/**
 * API Key Authentication Middleware
 * 
 * Used for SDK ingestion endpoints.
 * Reads the `x-api-key` header, looks up the key in the api_keys table,
 * and attaches org_id, project_id to req for downstream handlers.
 */
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

async function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key. Pass it in the x-api-key header.',
    });
  }

  try {
    // Extract prefix from the key (e.g., "rl_live_a8f3" from "rl_live_a8f3d9...")
    const prefix = apiKey.substring(0, 15);
    
    // Look up by prefix to find the key record
    const { rows } = await pool.query(
      `SELECT ak.id, ak.org_id, ak.project_id, ak.key_hash, ak.is_active, p.name as project_name
       FROM api_keys ak
       JOIN projects p ON p.id = ak.project_id
       WHERE ak.key_prefix = $1 AND ak.is_active = TRUE`,
      [prefix]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    const keyRecord = rows[0];

    // Verify the full key against the hash
    const valid = await bcrypt.compare(apiKey, keyRecord.key_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    // Attach info to request
    req.apiKey = {
      id: keyRecord.id,
      orgId: keyRecord.org_id,
      projectId: keyRecord.project_id,
      projectName: keyRecord.project_name,
    };

    // Update last_used_at
    await pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyRecord.id]
    );

    next();
  } catch (err) {
    console.error('API Key Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// Apply this middleware to routes that need it
module.exports = requireApiKey;
