# RegulateAI — Transformation Plan

> Transform "AI Logger" into "RegulateAI" — an EU AI Act compliance logging platform.

---

## Architecture Overview

```mermaid
graph TB
    subgraph Clients
        SDK_NODE[Node.js SDK<br/>@regulateai/sdk]
        SDK_PY[Python SDK<br/>regulateai]
        DASH[Next.js Dashboard<br/>Vercel]
    end

    subgraph Backend - Express API
        AUTH[Auth Routes<br/>/auth/*]
        INGEST[Ingest Route<br/>/api/v1/ingest/logs]
        PROJECTS[Project Routes<br/>/api/v1/projects/*]
        ASSESS[Assessment Routes<br/>/api/v1/assessments/*]
        DOCS[Document Routes<br/>/api/v1/documents/*]
        ALERTS[Alert Routes<br/>/api/v1/alerts/*]
        DASHBOARD[Dashboard Routes<br/>/api/v1/dashboard/*]
        EXPORT[Export Routes<br/>/api/v1/projects/:id/export/*]
    end

    subgraph Middleware
        JWT[JWT Auth<br/>Dashboard routes]
        APIKEY[API Key Auth<br/>SDK ingest route]
    end

    subgraph PostgreSQL
        ORGS[organizations]
        USERS[users]
        PROJ[projects]
        KEYS[api_keys]
        LOGS[ai_logs]
        CDOCS[compliance_documents]
        RASS[risk_assessments]
        MCHG[model_changes]
        ALRT[alerts]
    end

    SDK_NODE -->|x-api-key header| APIKEY
    SDK_PY -->|x-api-key header| APIKEY
    APIKEY --> INGEST

    DASH -->|Bearer JWT| JWT
    JWT --> AUTH
    JWT --> PROJECTS
    JWT --> ASSESS
    JWT --> DOCS
    JWT --> ALERTS
    JWT --> DASHBOARD
    JWT --> EXPORT

    INGEST --> LOGS
    INGEST --> MCHG
    INGEST --> ALRT
    PROJECTS --> PROJ
    PROJECTS --> KEYS
    ASSESS --> RASS
    DOCS --> CDOCS
    ALERTS --> ALRT
    DASHBOARD --> LOGS
    AUTH --> USERS
    AUTH --> ORGS
```

---

## What Changes

### Files to DELETE
| File | Reason |
|---|---|
| `backend/src/routes/billing.js` | Stripe removed — everything free |
| `backend/src/middleware/planLimit.js` | No plan limits for now |
| `frontend/pages/billing.tsx` | No billing page |
| `sdk/node/index.js` | Replaced by TypeScript src/ |
| `sdk/node/index.d.ts` | Replaced by TypeScript src/ |
| `sdk/python/ai_logger/` | Replaced by regulateai/ package |

### Files to REWRITE
| File | What Changes |
|---|---|
| `database/schema.sql` | Entirely new schema — 10 tables, 3 views |
| `backend/src/index.js` | Remove billing/planLimit, add new route mounts |
| `backend/src/middleware/auth.js` | New api_keys table lookup with bcrypt hash comparison |
| `backend/src/routes/auth.js` | Signup creates org + project + API key |
| `backend/src/routes/logs.js` | Becomes ingest.js — batch insert, compliance fields |
| `backend/src/routes/dashboard.js` | Compliance-aware stats |
| `backend/.env.example` | Remove Stripe, add new vars |
| `frontend/lib/api.ts` | All new endpoints |
| `frontend/components/Layout.tsx` | Sidebar nav, remove plan badges |
| `frontend/pages/dashboard.tsx` | Compliance overview |
| `frontend/pages/logs.tsx` | New compliance columns |
| `frontend/pages/signup.tsx` | Add company name field |

### Files to CREATE
| File | Purpose |
|---|---|
| `backend/src/routes/ingest.js` | POST /api/v1/ingest/logs — batch log ingestion |
| `backend/src/routes/projects.js` | CRUD for projects + API keys |
| `backend/src/routes/assessments.js` | Risk assessment save/retrieve |
| `backend/src/routes/documents.js` | Compliance document CRUD + versioning |
| `backend/src/routes/alerts.js` | Alert list/read/resolve |
| `backend/src/routes/exports.js` | CSV + audit JSON export |
| `backend/src/helpers/modelDetection.js` | Model change detection logic |
| `sdk/node/src/index.ts` | Main entry — exports |
| `sdk/node/src/logger.ts` | ComplianceLogger class |
| `sdk/node/src/buffer.ts` | LogBuffer — in-memory batch buffer |
| `sdk/node/src/transport.ts` | HttpTransport — HTTP with retry |
| `sdk/node/src/types.ts` | TypeScript type definitions |
| `sdk/node/tsconfig.json` | TypeScript config |
| `sdk/python/regulateai/__init__.py` | New package entry |
| `sdk/python/regulateai/logger.py` | ComplianceLogger class |
| `frontend/pages/projects.tsx` | Project list/management |
| `frontend/pages/projects/[id].tsx` | Single project detail |
| `frontend/pages/api-keys.tsx` | API key management |
| `frontend/components/Sidebar.tsx` | New sidebar navigation |
| `frontend/components/ComplianceChecklist.tsx` | Compliance progress checklist |
| `frontend/components/ModelDistribution.tsx` | Pie chart of model usage |
| `frontend/components/AlertsList.tsx` | Recent alerts widget |

---

## Execution Order

Following the priority from the requirements, grouped into implementation sessions:

### Session 1: Foundation — Schema + Cleanup + Core Backend

1. **Delete billing/plan files** — Remove `billing.js`, `planLimit.js`, `billing.tsx`
2. **Replace database schema** — Full new schema with all 10 tables
3. **Update auth middleware** — New `api_keys` table lookup with bcrypt
4. **Update auth routes** — Signup creates org + project + API key
5. **Create ingest route** — Batch log ingestion with compliance fields + model change detection
6. **Update index.js** — Mount new routes, remove old ones

### Session 2: Node.js SDK Rewrite

7. **Create TypeScript SDK structure** — `src/types.ts`, `src/buffer.ts`, `src/transport.ts`, `src/logger.ts`, `src/index.ts`
8. **Implement ComplianceLogger** — `log()`, `wrap()`, `markReviewed()`, `flush()`, `shutdown()`
9. **Implement LogBuffer** — In-memory batch with timer + size-based flush
10. **Implement HttpTransport** — fetch-based with exponential backoff retry

### Session 3: Additional Backend Routes

11. **Project management routes** — CRUD + API key management
12. **Dashboard stats route** — Compliance-aware stats
13. **Logs query route** — Updated filters for compliance fields
14. **Assessment routes** — Save/retrieve risk assessments
15. **Document routes** — CRUD with versioning
16. **Alert routes** — List/read/resolve
17. **Export routes** — CSV + audit JSON

### Session 4: Frontend Transformation

18. **Update Layout** — Sidebar navigation, remove billing
19. **Rewrite dashboard** — Compliance overview with checklist, charts, alerts
20. **Update logs page** — New compliance columns and filters
21. **Add projects page** — List and manage projects
22. **Add API keys page** — Manage keys per project
23. **Update API client** — All new endpoints

### Session 5: Python SDK + Docs

24. **Rewrite Python SDK** — ComplianceLogger with wrap, buffering, threading
25. **Update README** — RegulateAI branding and docs
26. **Update deployment guide** — Remove Stripe, add new env vars
27. **Update .env files** — New variable set

---

## Key Technical Decisions

### API Key Authentication — New Flow

The old system stored `api_key` as plaintext on the `users` table. The new system:

1. Stores **hashed** keys in `api_keys` table (bcrypt)
2. Stores a **prefix** for display: `rl_live_a8f3...`
3. One project can have multiple keys
4. Keys are scoped to org + project
5. Raw key shown ONCE at creation — user must save it

**Auth middleware change**: Instead of `WHERE api_key = $1`, we need to:
- Extract the prefix from the incoming key
- Look up by prefix
- bcrypt.compare the full key against the hash

### Batch Log Ingestion

The old system accepted single logs. The new system:
- Accepts arrays of up to 100 logs per request
- Uses bulk INSERT for performance
- Detects model changes by comparing with previous logs
- Creates alerts automatically on model version changes

### SDK Buffering

Both Node.js and Python SDKs now buffer logs in memory:
- Default batch size: 50 logs
- Default flush interval: 5 seconds
- Whichever threshold hits first triggers a flush
- `shutdown()` method for graceful cleanup
- Timer uses `unref()` in Node.js so it does not prevent process exit

### Compliance Score Calculation

Score is 0-100, calculated from:
- Risk assessment completed: 20 points
- Documents finalized: 40 points (proportional to required docs)
- SDK logging active: 20 points (tiered by volume)
- Human review rate: 20 points (tiered by percentage)

---

## Database Schema Summary

| Table | Purpose | Key Fields |
|---|---|---|
| `organizations` | Multi-tenant root | name, country_code |
| `users` | Auth + org membership | org_id, email, role |
| `projects` | AI systems being monitored | org_id, risk_tier, compliance_score |
| `api_keys` | SDK authentication | project_id, key_hash, key_prefix |
| `ai_logs` | Core logging table | prompt, output, model, confidence, human_reviewed |
| `compliance_documents` | Generated docs | project_id, document_type, content JSONB |
| `document_versions` | Audit trail for docs | document_id, version, content |
| `risk_assessments` | Wizard results | answers JSONB, risk_tier, obligations |
| `model_changes` | Auto-detected changes | previous_model, new_model |
| `alerts` | Compliance notifications | type, severity, is_read |

3 Views: `daily_log_counts`, `model_distribution`, `project_compliance_summary`

---

## New API Route Map

```
Auth:
  POST /auth/signup              → Create user + org + project + API key
  POST /auth/login               → Return JWT
  GET  /auth/me                  → User + org details

Ingest - SDK sends here:
  POST /api/v1/ingest/logs       → Batch log ingestion

Projects:
  GET    /api/v1/projects
  POST   /api/v1/projects
  GET    /api/v1/projects/:id
  PUT    /api/v1/projects/:id
  DELETE /api/v1/projects/:id

API Keys:
  GET    /api/v1/projects/:id/api-keys
  POST   /api/v1/projects/:id/api-keys
  DELETE /api/v1/api-keys/:id

Logs:
  GET    /api/v1/logs?project_id=...&filters...

Assessments:
  POST   /api/v1/assessments
  GET    /api/v1/assessments/:id
  GET    /api/v1/projects/:id/assessment

Documents:
  GET    /api/v1/projects/:id/documents
  POST   /api/v1/projects/:id/documents
  GET    /api/v1/documents/:id
  PUT    /api/v1/documents/:id
  GET    /api/v1/documents/:id/versions

Alerts:
  GET    /api/v1/alerts
  PUT    /api/v1/alerts/:id/read
  PUT    /api/v1/alerts/:id/resolve

Dashboard:
  GET    /api/v1/dashboard/stats?project_id=...
  GET    /api/v1/dashboard/daily-counts?project_id=...&days=30
  GET    /api/v1/dashboard/model-distribution?project_id=...
  GET    /api/v1/dashboard/human-review-rate?project_id=...&days=30

Export:
  GET    /api/v1/projects/:id/export/logs
  GET    /api/v1/projects/:id/export/audit
```

---

## Frontend Page Map

```
/login                → Login form
/signup               → Signup form - adds company name field
/dashboard            → Compliance overview - risk tier, score, checklist, charts, alerts
/projects             → Project list + create
/projects/[id]        → Project detail + compliance summary
/logs                 → Log viewer with compliance filters
/api-keys             → API key management per project
/settings             → Org settings
```

Removed: `/billing`

---

## Environment Variables — Updated

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/regulateai

# Auth
JWT_SECRET=replace_with_a_long_random_secret_string
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Removed: All Stripe variables, plan limits.
