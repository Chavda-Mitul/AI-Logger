/**
 * RegulateAI — Express Entry Point
 * EU AI Act Compliance Logging Platform
 */
require('dotenv').config();

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');

const authRouter      = require('./routes/auth');
const projectsRouter  = require('./routes/projects');
const ingestRouter    = require('./routes/ingest');
const logsRouter      = require('./routes/logs');
const dashboardRouter = require('./routes/dashboard');
const alertsRouter    = require('./routes/alerts');
const assessmentsRouter = require('./routes/assessments');
const documentsRouter   = require('./routes/documents');
const exportsRouter      = require('./routes/exports');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Global rate limiter ───────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use(globalLimiter);

// Tighter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, try again later.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth routes (login, signup, me)
app.use('/auth', authLimiter, authRouter);

// API v1 routes
app.use('/api/v1/ingest', ingestRouter);    // Batch log ingestion from SDK (uses apiKeyAuth internally)
app.use('/api/v1/projects', projectsRouter);  // Project + API key management
app.use('/api/v1/logs', logsRouter);         // Log query/export
app.use('/api/v1/dashboard', dashboardRouter); // Dashboard stats
app.use('/api/v1/alerts', alertsRouter);      // Alert management
app.use('/api/v1/assessments', assessmentsRouter); // Risk assessments
app.use('/api/v1/documents', documentsRouter);   // Compliance documents
app.use('/api/v1', exportsRouter);              // Export routes

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ 
  status: 'ok', 
  service: 'regulateai',
  ts: new Date().toISOString() 
}));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`RegulateAI API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app; // for testing
