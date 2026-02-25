/**
 * Compliance Document Routes
 *
 * GET /api/v1/projects/:id/documents
 * POST /api/v1/projects/:id/documents
 * GET /api/v1/documents/:id
 * PUT /api/v1/documents/:id
 * GET /api/v1/documents/:id/versions
 */
const express = require('express');
const Joi = require('joi');
const pool = require('../db/pool');
const { requireJwt } = require('../middleware/jwtAuth');

const router = express.Router();

const documentSchema = Joi.object({
  document_type: Joi.string().valid('technical_doc', 'risk_plan', 'bias_assessment', 'human_oversight', 'data_governance', 'declaration_conformity').required(),
  title: Joi.string().required(),
  content: Joi.object().required(),
  form_data: Joi.object(),
  status: Joi.string().valid('draft', 'review', 'final').default('draft'),
});

// ── GET /api/v1/projects/:id/documents ───────────────────────────────────

router.get('/projects/:id/documents', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, document_type, title, version, status, created_at, updated_at
       FROM compliance_documents
       WHERE project_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [id, req.user.orgId]
    );

    return res.json({ documents: rows });
  } catch (err) {
    console.error('GET /projects/:id/documents error:', err);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ── POST /api/v1/projects/:id/documents ─────────────────────────────────

router.post('/projects/:id/documents', requireJwt, async (req, res) => {
  const { id } = req.params;
  const { error, value } = documentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { document_type, title, content, form_data, status } = value;

  // Verify project belongs to org
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND org_id = $2',
    [id, req.user.orgId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get next version number
    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM compliance_documents WHERE project_id = $1 AND document_type = $2',
      [id, document_type]
    );
    const version = versionResult.rows[0].next_version;

    // Insert document
    const { rows } = await client.query(
      `INSERT INTO compliance_documents (org_id, project_id, document_type, title, version, content, form_data, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, document_type, title, version, status, created_at`,
      [req.user.orgId, id, document_type, title, version, JSON.stringify(content), form_data ? JSON.stringify(form_data) : null, status, req.user.userId]
    );

    // Create first version record
    await client.query(
      `INSERT INTO document_versions (document_id, version, content, changed_by, change_summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [rows[0].id, version, JSON.stringify(content), req.user.userId, 'Initial version']
    );

    await client.query('COMMIT');

    return res.status(201).json({ document: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /projects/:id/documents error:', err);
    return res.status(500).json({ error: 'Failed to create document' });
  } finally {
    client.release();
  }
});

// ── GET /api/v1/documents/:id ─────────────────────────────────────────

router.get('/documents/:id', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT cd.*, p.name as project_name
       FROM compliance_documents cd
       JOIN projects p ON p.id = cd.project_id
       WHERE cd.id = $1 AND cd.org_id = $2`,
      [id, req.user.orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json({ document: rows[0] });
  } catch (err) {
    console.error('GET /documents/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ── PUT /api/v1/documents/:id ─────────────────────────────────────────

router.put('/documents/:id', requireJwt, async (req, res) => {
  const { id } = req.params;
  const { title, content, status } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current document
    const current = await client.query(
      'SELECT * FROM compliance_documents WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Document not found' });
    }

    const currentDoc = current.rows[0];
    const newVersion = currentDoc.version + 1;

    // Update document
    await client.query(
      `UPDATE compliance_documents 
       SET title = $1, content = $2, status = $3, version = $4, updated_at = NOW()
       WHERE id = $5`,
      [title || currentDoc.title, JSON.stringify(content), status || currentDoc.status, newVersion, id]
    );

    // Create version record
    await client.query(
      `INSERT INTO document_versions (document_id, version, content, changed_by, change_summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, newVersion, JSON.stringify(content), req.user.userId, req.body.change_summary || 'Updated']
    );

    await client.query('COMMIT');

    return res.json({ success: true, version: newVersion });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /documents/:id error:', err);
    return res.status(500).json({ error: 'Failed to update document' });
  } finally {
    client.release();
  }
});

// ── GET /api/v1/documents/:id/versions ────────────────────────────────

router.get('/documents/:id/versions', requireJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT dv.id, dv.version, dv.change_summary, dv.created_at, u.name as changed_by_name
       FROM document_versions dv
       LEFT JOIN users u ON u.id = dv.changed_by
       WHERE dv.document_id = $1
       ORDER BY dv.version DESC`,
      [id]
    );

    return res.json({ versions: rows });
  } catch (err) {
    console.error('GET /documents/:id/versions error:', err);
    return res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

module.exports = router;
