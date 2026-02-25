/**
 * Projects Routes
 *
 * CRUD for projects and API keys
 * GET/POST /api/v1/projects
 * GET/PUT/DELETE /api/v1/projects/:id
 * GET/POST /api/v1/projects/:id/api-keys
 * DELETE /api/v1/api-keys/:id
 */
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const projectSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('', null).optional(),
});

const apiKeySchema = Joi.object({
  name: Joi.string().max(100).default('Default'),
});

// ── GET /api/v1/projects ──────────────────────────────────────────────────────

router.get('/', requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.description, p.risk_tier, p.compliance_score, 
              p.status, p.created_at, p.updated_at,
              (SELECT COUNT(*) FROM ai_logs WHERE project_id = p.id) as total_logs
       FROM projects p
       WHERE p.org_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.orgId]
    );

    return res.json({ projects: rows });
  } catch (err) {
    console.error('GET /projects error:', err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ── POST /api/v1/projects ─────────────────────────────────────────────────────

router.post('/', requireJwt, async (req, res) => {
  const { error, value } = projectSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (org_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, risk_tier, compliance_score, status, created_at`,
      [req.user.orgId, value.name, value.description || null]
    );

    return res.status(201).json({ project: rows[0] });
  } catch (err) {
    console.error('POST /projects error:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// ── GET /api/v1/projects/:id ─────────────────────────────────────────────────

router.get('/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM ai_logs WHERE project_id = p.id) as total_logs
       FROM projects p
       WHERE p.id = $1 AND p.org_id = $2`,
      [id, req.user.orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project: rows[0] });
  } catch (err) {
    console.error('GET /projects/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ── PUT /api/v1/projects/:id ─────────────────────────────────────────────────

router.put('/:id', requireJwt, async (req, res) => {
  const { id } = req.params;
  const { error, value } = projectSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const { rows } = await pool.query(
      `UPDATE projects 
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING id, name, description, risk_tier, compliance_score, status`,
      [value.name, value.description || null, id, req.user.orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project: rows[0] });
  } catch (err) {
    console.error('PUT /projects/:id error:', err);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

// ── DELETE /api/v1/projects/:id ─────────────────────────────────────────────

router.delete('/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE projects SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /projects/:id error:', err);
    return res.status(500).json({ error: 'Failed to archive project' });
  }
});

// ── GET /api/v1/projects/:id/api-keys ─────────────────────────────────────────

router.get('/:id/api-keys', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, key_prefix, name, is_active, last_used_at, created_at
       FROM api_keys
       WHERE project_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [id, req.user.orgId]
    );

    return res.json({ api_keys: rows });
  } catch (err) {
    console.error('GET /projects/:id/api-keys error:', err);
    return res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// ── POST /api/v1/projects/:id/api-keys ─────────────────────────────────────

router.post('/:id/api-keys', requireJwt, async (req, res) => {
  const { id } = req.params;
  const { error, value } = apiKeySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
    [id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const rawKey = 'rl_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = await bcrypt.hash(rawKey, 12);
    const keyPrefix = rawKey.substring(0, 15);

    const { rows } = await pool.query(
      `INSERT INTO api_keys (org_id, project_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, key_prefix, name, is_active, created_at`,
      [req.user.orgId, id, keyHash, keyPrefix, value.name]
    );

    return res.status(201).json({
      api_key: rows[0],
      raw_key: rawKey, // Only returned once!
    });
  } catch (err) {
    console.error('POST /projects/:id/api-keys error:', err);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
});

// ── DELETE /api/v1/api-keys/:id ─────────────────────────────────────────────

router.delete('/api-keys/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE api_keys SET is_active = FALSE
       WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api-keys/:id error:', err);
    return res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
