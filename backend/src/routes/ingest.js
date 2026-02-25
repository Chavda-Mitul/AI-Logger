/**
 * Log Ingestion Routes
 *
 * POST /api/v1/ingest/logs — Batch log ingestion from SDK
 */
const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const requireApiKey = require('../middleware/apiKeyAuth');

const router = express.Router();

// Validation schema for a single log entry
const logEntrySchema = Joi.object({
  prompt: Joi.string().allow(null, ''),
  output: Joi.string().allow(null, ''),
  model: Joi.string().allow(null, ''),
  model_version: Joi.string().allow(null, ''),
  confidence: Joi.number().min(0).max(1).allow(null),
  latency_ms: Joi.number().integer().min(0).allow(null),
  tokens_input: Joi.number().integer().min(0).allow(null),
  tokens_output: Joi.number().integer().min(0).allow(null),
  human_reviewed: Joi.boolean().default(false),
  human_reviewer_id: Joi.string().allow(null, ''),
  human_review_notes: Joi.string().allow(null, ''),
  framework: Joi.string().default('custom'),
  status: Joi.string().valid('success', 'error', 'timeout').default('success'),
  error_message: Joi.string().allow(null, ''),
  session_id: Joi.string().allow(null, ''),
  user_identifier: Joi.string().allow(null, ''),
  metadata: Joi.object().default({}),
  sdk_version: Joi.string().allow(null, ''),
  sdk_language: Joi.string().valid('node', 'python').allow(null, ''),
  timestamp: Joi.date().iso().allow(null),
});

// ── POST /api/v1/ingest/logs ─────────────────────────────────────────────────

router.post('/logs', requireApiKey, async (req, res) => {
  const { logs } = req.body;
  const { orgId, projectId, id: apiKeyId } = req.apiKey;

  // Validate input
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: 'logs must be a non-empty array' });
  }

  if (logs.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 logs per batch' });
  }

  let accepted = 0;
  let rejected = 0;
  const errors = [];

  // Get the last log for model change detection
  let lastLog = null;
  try {
    const lastResult = await pool.query(
      `SELECT model, model_version FROM ai_logs 
       WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    lastLog = lastResult.rows[0] || null;
  } catch (e) {
    // Ignore - model detection is best-effort
  }

  // Process each log entry
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const { error, value } = logEntrySchema.validate(log);

    if (error) {
      rejected++;
      errors.push({ index: i, error: error.details[0].message });
      continue;
    }

    // Use SDK-provided timestamp or default to now
    const timestamp = value.timestamp || new Date().toISOString();

    placeholders.push(`(
      $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4},
      $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9},
      $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14},
      $${paramIndex + 15}, $${paramIndex + 16}, $${paramIndex + 17}, $${paramIndex + 18}, $${paramIndex + 19}
    )`);

    values.push(
      orgId,                                // 1: org_id
      projectId,                            // 2: project_id
      apiKeyId,                             // 3: api_key_id
      value.prompt,                         // 4: prompt
      value.output,                         // 5: output
      value.model,                          // 6: model
      value.model_version,                  // 7: model_version
      value.confidence,                     // 8: confidence
      value.latency_ms,                     // 9: latency_ms
      value.tokens_input,                   // 10: tokens_input
      value.tokens_output,                  // 11: tokens_output
      value.human_reviewed,                 // 12: human_reviewed
      value.framework,                      // 13: framework
      value.status,                         // 14: status
      value.error_message,                  // 15: error_message
      value.session_id,                     // 16: session_id
      value.user_identifier,                 // 17: user_identifier
      JSON.stringify(value.metadata || {}), // 18: metadata
      value.sdk_version,                    // 19: sdk_version
      timestamp                            // 20: created_at (override)
    );

    paramIndex += 20;
    accepted++;
  }

  // Bulk insert
  if (placeholders.length > 0) {
    const insertQuery = `
      INSERT INTO ai_logs (
        org_id, project_id, api_key_id, prompt, output, model, model_version,
        confidence, latency_ms, tokens_input, tokens_output, human_reviewed,
        framework, status, error_message, session_id, user_identifier,
        metadata, sdk_version, created_at
      ) VALUES ${placeholders.join(', ')}
    `;

    try {
      await pool.query(insertQuery, values);
    } catch (err) {
      console.error('Bulk insert error:', err);
      return res.status(500).json({ error: 'Failed to insert logs' });
    }
  }

  // Check for model changes
  if (accepted > 0 && lastLog) {
    const firstLog = logs[0];
    if (firstLog.model && firstLog.model_version &&
        (firstLog.model !== lastLog.model || firstLog.model_version !== lastLog.model_version)) {
      
      try {
        // Insert model change record
        await pool.query(
          `INSERT INTO model_changes (org_id, project_id, previous_model, previous_version, new_model, new_version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orgId, projectId, lastLog.model, lastLog.model_version, firstLog.model, firstLog.model_version]
        );

        // Create alert
        await pool.query(
          `INSERT INTO alerts (org_id, project_id, type, severity, title, message)
           VALUES ($1, $2, 'model_change', 'warning', 'Model Version Changed', $3)`,
          [orgId, projectId, `Model changed from ${lastLog.model} (${lastLog.model_version}) to ${firstLog.model} (${firstLog.model_version}). Review for Art. 12 compliance.`]
        );
      } catch (e) {
        console.error('Model change detection error:', e);
      }
    }
  }

  res.json({
    accepted,
    rejected,
    errors,
    project_id: projectId,
  });
});

module.exports = router;
