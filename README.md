# RegulateAI — EU AI Act Compliance Platform

> A compliance-focused AI interaction logging platform for EU AI Act readiness.

---

## 🎯 What is RegulateAI?

RegulateAI helps AI startups achieve **EU AI Act compliance** by:

- **Logging every AI interaction** (prompt + output + model metadata)
- **Tracking human oversight** (Art. 14)
- **Monitoring performance metrics** (Art. 15)
- **Auto-detecting model changes**
- **Generating compliance documents**

---

## 🏗️ Architecture

```
ai-logger/
├── backend/           # Node.js + Express REST API
├── frontend/         # Next.js dashboard
├── sdk/
│   ├── node/         # @regulateai/sdk (Node.js)
│   └── python/      # regulateai (Python)
├── database/
│   └── schema.sql    # PostgreSQL schema
└── docs/
    └── deployment.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup

```bash
psql -U postgres -c "CREATE DATABASE regulateai;"
psql -U postgres -d regulateai -f database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

---

## 📦 SDK Usage

### Node.js

```js
const { ComplianceLogger } = require('@regulateai/sdk');

const logger = new ComplianceLogger({
  apiKey: 'rl_live_xxxxx',
  batchSize: 50,
  flushIntervalMs: 5000,
});

// Manual logging
logger.log({
  prompt: "What is the capital of France?",
  output: "Paris",
  model: "gpt-4o",
  model_version: "gpt-4o-2024-08-06",
  confidence: 0.94,
  latency_ms: 234,
  framework: "openai",
});

// Or wrap OpenAI calls
const result = await logger.wrap(
  openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  })
);
```

### Python

```python
from regulateai import ComplianceLogger

logger = ComplianceLogger(api_key="rl_live_xxxxx")

logger.log(
    prompt="What is the capital of France?",
    output="Paris",
    model="gpt-4o",
    confidence=0.94,
)
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create account + org + project + API key |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Get current user info |
| POST | `/api/v1/ingest/logs` | Batch log ingestion (SDK) |
| GET/POST | `/api/v1/projects` | List/create projects |
| GET/POST | `/api/v1/projects/:id/api-keys` | Manage API keys |
| GET | `/api/v1/logs` | Query logs with filters |
| GET | `/api/v1/dashboard/stats` | Compliance dashboard stats |
| GET/POST | `/api/v1/alerts` | Manage alerts |

---

## 📋 Features

### Compliance Tracking
- Risk tier assessment (PROHIBITED/HIGH/LIMITED/MINIMAL)
- Compliance score (0-100)
- Human review rate tracking
- Model change detection

### Document Generation
- Technical documentation
- Risk management plans
- Bias assessments
- Human oversight protocols

### Audit Readiness
- Full log history with timestamps
- Session-based traceability
- CSV export
- Version control for documents

---

## 🌍 EU AI Act Articles Covered

- **Art. 6 & 9** — Risk classification
- **Art. 12** — Record-keeping & traceability
- **Art. 14** — Human oversight
- **Art. 15** — Accuracy & robustness

---

## 📖 Documentation

- [Deployment Guide](docs/deployment.md)
- [SDK Documentation](sdk/node/README.md)
- [Python SDK](sdk/python/README.md)

---

## License

MIT
