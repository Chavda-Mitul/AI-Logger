/**
 * Export Routes
 *
 * GET /api/v1/projects/:id/export/logs
 * GET /api/v1/projects/:id/export/audit
 */
const express = require('express');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

// ── GET /api/v1/projects/:id/export/logs ─────────────────────────────────

router.get('/projects/:id/export/logs', requireJwt, async (req, res) => {
  const { id } = req.params;
  const { from, to, model, limit = 10000 } = req.query;

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id, name FROM projects WHERE id = $1 AND org_id = $2',
    [id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    let query = `
      SELECT l.id, l.prompt, l.output, l.model, l.model_version,
             l.confidence, l.latency_ms, l.tokens_input, l.tokens_output,
             l.human_reviewed, l.framework, l.status, l.session_id, 
             l.user_identifier, l.created_at
      FROM ai_logs l
      WHERE l.project_id = $1
    `;
    const params = [id];
    let paramIdx = 2;

    if (from) {
      query += ` AND l.created_at >= $${paramIdx++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND l.created_at <= $${paramIdx++}`;
      params.push(to);
    }
    if (model) {
      query += ` AND l.model = $${paramIdx++}`;
      params.push(model);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${paramIdx}`;
    params.push(parseInt(limit, 10));

    const { rows } = await pool.query(query, params);

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
    res.setHeader('Content-Disposition', `attachment; filename="logs-${projectCheck.rows[0].name}.csv"`);
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    console.error('GET /export/logs error:', err);
    return res.status(500).json({ error: 'Failed to export logs' });
  }
});

// ── GET /api/v1/projects/:id/export/audit ───────────────────────────────

router.get('/projects/:id/export/audit', requireJwt, async (req, res) => {
  const { id } = req.params;

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id, name, risk_tier, compliance_score, created_at FROM projects WHERE id = $1 AND org_id = $2',
    [id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const project = projectCheck.rows[0];

    // Get logs summary
    const logsSummary = await pool.query(
      `SELECT 
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE human_reviewed = TRUE) as human_reviewed,
         COUNT(*) FILTER (WHERE status = 'error') as errors,
         MIN(created_at) as first_log,
         MAX(created_at) as last_log
       FROM ai_logs WHERE project_id = $1`,
      [id]
    );

    // Get documents
    const documents = await pool.query(
      `SELECT document_type, title, version, status, created_at
       FROM compliance_documents WHERE project_id = $1`,
      [id]
    );

    // Get recent alerts
    const alerts = await pool.query(
      `SELECT type, severity, title, message, is_resolved, created_at
       FROM alerts WHERE project_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [id]
    );

    // Get model changes
    const modelChanges = await pool.query(
      `SELECT previous_model, new_model, detected_at, acknowledged
       FROM model_changes WHERE project_id = $1
       ORDER BY detected_at DESC LIMIT 50`,
      [id]
    );

    // Get recent logs sample
    const recentLogs = await pool.query(
      `SELECT id, model, status, human_reviewed, created_at
       FROM ai_logs WHERE project_id = $1
       ORDER BY created_at DESC LIMIT 1000`,
      [id]
    );

    const auditPackage = {
      export_date: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        risk_tier: project.risk_tier,
        compliance_score: project.compliance_score,
        created_at: project.created_at,
      },
      logs_summary: logsSummary.rows[0],
      documents: documents.rows,
      alerts: alerts.rows,
      model_changes: modelChanges.rows,
      recent_logs_sample: recentLogs.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${project.name}.json"`);
    return res.json(auditPackage);
  } catch (err) {
    console.error('GET /export/audit error:', err);
    return res.status(500).json({ error: 'Failed to export audit package' });
  }
});

module.exports = router;
