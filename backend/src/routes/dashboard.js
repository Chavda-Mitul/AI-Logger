/**
 * Dashboard Routes (JWT-protected)
 *
 * GET /api/v1/dashboard/stats?project_id=xxx
 * GET /api/v1/dashboard/daily-counts?project_id=xxx&days=30
 * GET /api/v1/dashboard/model-distribution?project_id=xxx
 */
const express = require('express');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

// ── GET /api/v1/dashboard/stats ─────────────────────────────────────────────

router.get('/stats', requireJwt, async (req, res) => {
  const { project_id } = req.query;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id, name, risk_tier, compliance_score FROM projects WHERE id = $1 AND org_id = $2',
    [project_id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const project = projectCheck.rows[0];

    // Get log stats
    const logStats = await pool.query(
      `SELECT 
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as logs_today,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as logs_this_week,
         ROUND(AVG(latency_ms)) as avg_latency,
         AVG(confidence) FILTER (WHERE confidence IS NOT NULL) as avg_confidence,
         ROUND(
           COUNT(*) FILTER (WHERE status = 'error')::NUMERIC / 
           NULLIF(COUNT(*), 0) * 100, 1
         ) as error_rate,
         COUNT(*) FILTER (WHERE human_reviewed = TRUE) as human_reviewed_count,
         ROUND(
           COUNT(*) FILTER (WHERE human_reviewed = TRUE)::NUMERIC / 
           NULLIF(COUNT(*), 0) * 100, 1
         ) as human_review_rate
       FROM ai_logs
       WHERE project_id = $1`,
      [project_id]
    );

    // Get model changes this month
    const modelChanges = await pool.query(
      `SELECT COUNT(*) as changes
       FROM model_changes
       WHERE project_id = $1 AND detected_at >= NOW() - INTERVAL '30 days'`,
      [project_id]
    );

    // Get documents count
    const docs = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'final') as finalized
       FROM compliance_documents
       WHERE project_id = $1`,
      [project_id]
    );

    // Get unread alerts
    const alerts = await pool.query(
      `SELECT COUNT(*) as unread
       FROM alerts
       WHERE project_id = $1 AND is_read = FALSE`,
      [project_id]
    );

    // Get models in use
    const modelsResult = await pool.query(
      `SELECT DISTINCT model FROM ai_logs WHERE project_id = $1 AND model IS NOT NULL`,
      [project_id]
    );
    const modelsInUse = modelsResult.rows.map(r => r.model);

    // Get documents required from risk assessment
    const riskAssessment = await pool.query(
      `SELECT documents_required FROM risk_assessments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [project_id]
    );
    const documentsRequired = riskAssessment.rows[0]?.documents_required?.length || 0;

    // Calculate compliance score
    const scoreResult = await pool.query(
      'SELECT calculate_compliance_score($1) as score',
      [project_id]
    );

    const stats = logStats.rows[0];

    return res.json({
      // Project info
      project: {
        id: project.id,
        name: project.name,
        risk_tier: project.risk_tier,
        compliance_score: scoreResult.rows[0].score,
      },

      // Log stats
      total_logs: parseInt(stats.total_logs, 10),
      logs_today: parseInt(stats.logs_today, 10),
      logs_this_week: parseInt(stats.logs_this_week, 10),

      // Performance (Art. 15)
      avg_latency_ms: stats.avg_latency ? parseInt(stats.avg_latency, 10) : null,
      avg_confidence: stats.avg_confidence ? parseFloat(stats.avg_confidence) : null,
      error_rate: stats.error_rate ? parseFloat(stats.error_rate) : 0,

      // Human oversight (Art. 14)
      human_review_rate: stats.human_review_rate ? parseFloat(stats.human_review_rate) : 0,
      human_reviewed_count: parseInt(stats.human_reviewed_count, 10),

      // Model info
      model_changes_this_month: parseInt(modelChanges.rows[0].changes, 10),

      // Models
      models_in_use: modelsInUse,

      // Documents
      documents_created: parseInt(docs.rows[0].total, 10),
      documents_required: documentsRequired,
      documents_finalized: parseInt(docs.rows[0].finalized, 10),

      // Alerts
      unread_alerts: parseInt(alerts.rows[0].unread, 10),
    });
  } catch (err) {
    console.error('GET /dashboard/stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/v1/dashboard/daily-counts ─────────────────────────────────────

router.get('/daily-counts', requireJwt, async (req, res) => {
  const { project_id, days = 30 } = req.query;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE human_reviewed = TRUE) as human_reviewed_count,
         COUNT(*) FILTER (WHERE status = 'error') as error_count,
         ROUND(AVG(latency_ms)) as avg_latency
       FROM ai_logs
       WHERE project_id = $1 AND created_at >= NOW() - INTERVAL '2 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [project_id]
    );

    return res.json({ daily_counts: rows });
  } catch (err) {
    console.error('GET /dashboard/daily-counts error:', err);
    return res.status(500).json({ error: 'Failed to fetch daily counts' });
  }
});

// ── GET /api/v1/dashboard/model-distribution ────────────────────────────────

router.get('/model-distribution', requireJwt, async (req, res) => {
  const { project_id } = req.query;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT 
         model,
         model_version,
         COUNT(*) as usage_count,
         ROUND(AVG(latency_ms)) as avg_latency,
         AVG(confidence) FILTER (WHERE confidence IS NOT NULL) as avg_confidence
       FROM ai_logs
       WHERE project_id = $1
       GROUP BY model, model_version
       ORDER BY usage_count DESC`,
      [project_id]
    );

    return res.json({ models: rows });
  } catch (err) {
    console.error('GET /dashboard/model-distribution error:', err);
    return res.status(500).json({ error: 'Failed to fetch model distribution' });
  }
});

module.exports = router;
