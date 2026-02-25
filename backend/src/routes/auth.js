/**
 * Auth Routes (Dashboard login/signup)
 *
 * POST /auth/signup  — create account + org + project + API key
 * POST /auth/login   — verify credentials, return JWT
 * GET  /auth/me      — return current user + org info
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().max(255).optional(),
  company: Joi.string().max(255).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, orgId: user.org_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /auth/signup ─────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { email, password, name, company } = value;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check duplicate email
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // 1. Create organization
    const orgName = company || (name ? `${name}'s Organization` : 'My Organization');
    const orgResult = await client.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [orgName]
    );
    const orgId = orgResult.rows[0].id;

    // 2. Create user linked to org
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (org_id, email, name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [orgId, email, name || email.split('@')[0], passwordHash]
    );
    const user = userResult.rows[0];

    // 3. Create default project
    const projectResult = await client.query(
      `INSERT INTO projects (org_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, status`,
      [orgId, 'My AI System', 'Default project for AI compliance logging']
    );
    const project = projectResult.rows[0];

    // 4. Create API key for the project
    const rawKey = 'rl_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = await bcrypt.hash(rawKey, 12);
    const keyPrefix = rawKey.substring(0, 15);
    
    await client.query(
      `INSERT INTO api_keys (org_id, project_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, project.id, keyHash, keyPrefix, 'Default']
    );

    await client.query('COMMIT');

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId,
      },
      organization: {
        id: orgId,
        name: orgName,
      },
      project: {
        id: project.id,
        name: project.name,
      },
      apiKey: rawKey, // ONLY returned once!
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /auth/signup error:', err);
    return res.status(500).json({ error: 'Signup failed.' });
  } finally {
    client.release();
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { email, password } = value;

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.password_hash, u.role, u.org_id
       FROM users u WHERE u.email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Get org info
    const orgResult = await pool.query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [user.org_id]
    );

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.org_id,
      },
      organization: orgResult.rows[0],
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', requireJwt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.org_id, u.created_at,
              o.name as org_name
       FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.id = $1`,
      [req.userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = rows[0];

    // Get projects
    const projectsResult = await pool.query(
      'SELECT id, name, risk_tier, compliance_score, status FROM projects WHERE org_id = $1',
      [user.org_id]
    );

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: user.org_id,
        name: user.org_name,
      },
      projects: projectsResult.rows,
    });
  } catch (err) {
    console.error('GET /auth/me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

module.exports = router;
