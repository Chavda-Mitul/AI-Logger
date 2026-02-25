/**
 * Logs Routes (JWT-protected)
 *
 * GET /api/v1/logs?project_id=xxx&filters...
 * GET /api/v1/logs/:id
 */
const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

const listLogsSchema = Joi.object({
  project_id: Joi.string().uuid().required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  model: Joi.string(),
  status: Joi.string().valid('success', 'error', 'timeout'),
  human_reviewed: Joi.boolean(),
  session_id: Joi.string(),
  user_identifier: Joi.string(),
  search: Joi.string().max(500),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
});

// ── GET /api/v1/logs ───────────────────────────────────────────────────────

router.get('/', requireJwt, async (req, res) => {
  const { error, value } = listLogsSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { project_id, page, limit, model, status, human_reviewed, session_id, user_identifier, search, from, to } = value;
  const offset = (page - 1) * limit;

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
    [project_id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Build WHERE clause
  const conditions = ['l.project_id = $1'];
  const params = [project_id];
  let paramIdx = 2;

  if (model) { conditions.push(`l.model = $${paramIdx++}`); params.push(model); }
  if (status) { conditions.push(`l.status = $${paramIdx++}`); params.push(status); }
  if (human_reviewed !== undefined) { conditions.push(`l.human_reviewed = $${paramIdx++}`); params.push(human_reviewed); }
  if (session_id) { conditions.push(`l.session_id = $${paramIdx++}`); params.push(session_id); }
  if (user_identifier) { conditions.push(`l.user_identifier = $${paramIdx++}`); params.push(user_identifier); }
  if (from) { conditions.push(`l.created_at >= $${paramIdx++}`); params.push(from); }
  if (to) { conditions.push(`l.created_at <= $${paramIdx++}`); params.push(to); }
  if (search) {
    conditions.push(`to_tsvector('english', l.prompt) @@ plainto_tsquery('english', $${paramIdx++})`);
    params.push(search);
  }

  const whereClause = conditions.join(' AND ');

  try {
    // Total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_logs l WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginated results
    const { rows } = await pool.query(
      `SELECT l.id, l.prompt, l.output, l.model, l.model_version,
              l.confidence, l.latency_ms, l.tokens_input, l.tokens_output,
              l.human_reviewed, l.human_reviewer_id, l.human_review_notes,
              l.framework, l.status, l.error_message,
              l.session_id, l.user_identifier, l.metadata,
              l.sdk_version, l.created_at
       FROM ai_logs l
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GET /logs error:', err);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ── GET /api/v1/logs/export ────────────────────────────────────────────────

router.get('/export', requireJwt, async (req, res) => {
  const { error, value } = listLogsSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { project_id, model, status, human_reviewed, from, to } = value;

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
    [project_id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Build WHERE clause (simpler than list query)
  const conditions = ['l.project_id = $1'];
  const params = [project_id];
  let paramIdx = 2;

  if (model) { conditions.push(`l.model = $${paramIdx++}`); params.push(model); }
  if (status) { conditions.push(`l.status = $${paramIdx++}`); params.push(status); }
  if (human_reviewed !== undefined) { conditions.push(`l.human_reviewed = $${paramIdx++}`); params.push(human_reviewed); }
  if (from) { conditions.push(`l.created_at >= $${paramIdx++}`); params.push(from); }
  if (to) { conditions.push(`l.created_at <= $${paramIdx++}`); params.push(to); }

  const whereClause = conditions.join(' AND ');

  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.model, l.model_version, l.confidence, l.latency_ms,
              l.tokens_input, l.tokens_output, l.human_reviewed, l.framework,
              l.status, l.session_id, l.user_identifier, l.created_at,
              l.prompt, l.output
       FROM ai_logs l
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT 10000`,
      params
    );

    // Build CSV
    const headers = ['id', 'model', 'model_version', 'confidence', 'latency_ms', 'tokens_input', 'tokens_output', 'human_reviewed', 'framework', 'status', 'session_id', 'user_identifier', 'created_at', 'prompt', 'output'];
    const csvHeader = headers.join(',') + '\n';
    
    const csvRows = rows.map(r => {
      const escape = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') 
          ? `"${s.replace(/"/g, '""')}"` 
          : s;
      };
      return headers.map(h => escape(r[h])).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-logs.csv"');
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    console.error('GET /logs/export error:', err);
    return res.status(500).json({ error: 'Failed to export logs' });
  }
});

// ── GET /api/v1/logs/:id ───────────────────────────────────────────────────

router.get('/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT l.*, p.name as project_name
       FROM ai_logs l
       JOIN projects p ON p.id = l.project_id
       WHERE l.id = $1 AND p.org_id = $2`,
      [id, req.user.orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    return res.json({ log: rows[0] });
  } catch (err) {
    console.error('GET /logs/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch log' });
  }
});

module.exports = router;
