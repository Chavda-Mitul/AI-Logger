/**
 * Alert Routes
 *
 * GET /api/v1/alerts?project_id=xxx
 * PUT /api/v1/alerts/:id/read
 * PUT /api/v1/alerts/:id/resolve
 */
const express = require('express');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

// ── GET /api/v1/alerts ───────────────────────────────────────────────────────

router.get('/', requireJwt, async (req, res) => {
  const { project_id, unread_only, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  let query = `
    SELECT a.id, a.type, a.severity, a.title, a.message, 
           a.is_read, a.is_resolved, a.created_at,
           p.name as project_name
    FROM alerts a
    LEFT JOIN projects p ON p.id = a.project_id
    WHERE a.org_id = $1
  `;
  const params = [req.user.orgId];
  let paramIdx = 2;

  if (project_id) {
    query += ` AND a.project_id = $${paramIdx++}`;
    params.push(project_id);
  }

  if (unread_only === 'true') {
    query += ` AND a.is_read = FALSE`;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(parseInt(limit, 10), offset);

  try {
    const { rows } = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM alerts WHERE org_id = $1`;
    const countParams = [req.user.orgId];
    if (project_id) {
      countQuery += ` AND project_id = $2`;
      countParams.push(project_id);
    }
    if (unread_only === 'true') {
      countQuery += ` AND is_read = FALSE`;
    }

    const totalResult = await pool.query(countQuery, countParams);
    const total = parseInt(totalResult.rows[0].count, 10);

    return res.json({
      alerts: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    console.error('GET /alerts error:', err);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ── PUT /api/v1/alerts/:id/read ────────────────────────────────────────────

router.put('/:id/read', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE alerts SET is_read = TRUE WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /alerts/:id/read error:', err);
    return res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// ── PUT /api/v1/alerts/:id/resolve ─────────────────────────────────────────

router.put('/:id/resolve', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE alerts SET is_resolved = TRUE, resolved_by = $1 WHERE id = $2 AND org_id = $3 RETURNING id`,
      [req.user.userId, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /alerts/:id/resolve error:', err);
    return res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

module.exports = router;
