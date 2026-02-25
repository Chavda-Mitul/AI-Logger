/**
 * Risk Assessment Routes
 *
 * POST /api/v1/assessments
 * GET /api/v1/assessments/:id
 * GET /api/v1/projects/:id/assessment
 */
const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

const assessmentSchema = Joi.object({
  project_id: Joi.string().uuid().allow(null),
  email: Joi.string().email(),
  company_name: Joi.string(),
  answers: Joi.object().required(),
  risk_tier: Joi.string().valid('PROHIBITED', 'HIGH', 'LIMITED', 'MINIMAL').required(),
  compliance_score: Joi.number().integer().min(0).max(100).required(),
  matched_articles: Joi.array().items(Joi.string()),
  obligations: Joi.object().required(),
  documents_required: Joi.array().items(Joi.string()),
  dpdp_applicable: Joi.boolean().default(false),
  dpdp_obligations: Joi.object(),
  estimated_effort: Joi.string(),
  urgency: Joi.string().valid('immediate', '3_months', '6_months'),
});

// ── POST /api/v1/assessments ─────────────────────────────────────────────

router.post('/', requireJwt, async (req, res) => {
  const { error, value } = assessmentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { project_id, answers, risk_tier, compliance_score, matched_articles, obligations, documents_required, dpdp_applicable, dpdp_obligations, estimated_effort, urgency } = value;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // If project_id is provided, update the project with assessment results
    if (project_id) {
      // Verify project belongs to org
      const projectCheck = await client.query(
        'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
        [project_id, req.user.orgId]
      );

      if (projectCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update project with risk tier and score
      await client.query(
        `UPDATE projects 
         SET risk_tier = $1, compliance_score = $2, risk_assessment_data = $3, risk_assessed_at = NOW(), updated_at = NOW()
         WHERE id = $4`,
        [risk_tier, compliance_score, JSON.stringify({ answers, matched_articles, obligations, documents_required }), project_id]
      );
    }

    // Save assessment
    const { rows } = await client.query(
      `INSERT INTO risk_assessments 
       (org_id, project_id, email, company_name, answers, risk_tier, compliance_score, matched_articles, obligations, documents_required, dpdp_applicable, dpdp_obligations, estimated_effort, urgency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, risk_tier, compliance_score, created_at`,
      [req.user.orgId, project_id || null, req.body.email || null, req.body.company_name || null, JSON.stringify(answers), risk_tier, compliance_score, matched_articles, JSON.stringify(obligations), documents_required, dpdp_applicable, dpdp_obligations ? JSON.stringify(dpdp_obligations) : null, estimated_effort, urgency]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      id: rows[0].id,
      risk_tier: rows[0].risk_tier,
      compliance_score: rows[0].compliance_score,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /assessments error:', err);
    return res.status(500).json({ error: 'Failed to save assessment' });
  } finally {
    client.release();
  }
});

// ── GET /api/v1/assessments/:id ─────────────────────────────────────────

router.get('/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT ra.*, p.name as project_name
       FROM risk_assessments ra
       LEFT JOIN projects p ON p.id = ra.project_id
       WHERE ra.id = $1 AND (ra.org_id = $2 OR ra.org_id IS NULL)`,
      [id, req.user.orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    return res.json({ assessment: rows[0] });
  } catch (err) {
    console.error('GET /assessments/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// ── GET /api/v1/projects/:id/assessment ────────────────────────────────

router.get('/project/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT ra.*
       FROM risk_assessments ra
       WHERE ra.project_id = $1
       ORDER BY ra.created_at DESC
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No assessment found for this project' });
    }

    return res.json({ assessment: rows[0] });
  } catch (err) {
    console.error('GET /project/:id/assessment error:', err);
    return res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

module.exports = router;
