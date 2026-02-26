# RegulateAI — Deployment Guide

> Deploy the full stack in under 30 minutes.

---

## Architecture

```
Browser → Vercel (Next.js frontend)
              ↓ REST API calls
         Railway / Render (Express backend)
              ↓ SQL queries
         Railway PostgreSQL / Supabase / Neon
```

---

## 1. PostgreSQL Database

### Option A — Railway (recommended, free tier available)

1. Go to [railway.app](https://railway.app) → New Project → Add PostgreSQL
2. Copy the `DATABASE_URL` from the Variables tab
3. Run the schema:
   ```bash
   psql "$DATABASE_URL" -f database/schema.sql
   ```

### Option B — Neon (serverless, generous free tier)

1. Go to [neon.tech](https://neon.tech) → Create project
2. Copy the connection string (use the **pooled** URL for production)
3. Run the schema the same way

### Option C — Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Go to SQL Editor → paste contents of `database/schema.sql` → Run

---

## 2. Backend — Railway

### Steps

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Select the `backend/` directory as the root (or set `RAILWAY_DOCKERFILE_PATH`)
4. Add environment variables (see below)
5. Railway auto-detects Node.js and runs `npm start`

### Environment Variables (Railway → Variables tab)

```
PORT=4000
NODE_ENV=production
DATABASE_URL=<your PostgreSQL URL>
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-app.vercel.app
```

### Alternative: Render

1. Go to [render.com](https://render.com) → New Web Service
2. Connect GitHub repo, set root directory to `backend/`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the same environment variables

### Alternative: Fly.io

```bash
cd backend
fly launch
fly secrets set DATABASE_URL="..." JWT_SECRET="..."
fly deploy
```

---

## 3. Frontend — Vercel

### Steps

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set **Root Directory** to `frontend/`
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

5. Click Deploy

Vercel handles builds, CDN, and HTTPS automatically.

---

## 4. Custom Domain

### Backend (Railway)
Settings → Domains → Add custom domain → point your DNS CNAME to Railway

### Frontend (Vercel)
Project Settings → Domains → Add → follow DNS instructions

---

## 5. Environment Variables Summary

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `JWT_SECRET` | Backend | Random 32-byte hex string |
| `JWT_EXPIRES_IN` | Backend | Token expiry (e.g. `7d`) |
| `CORS_ORIGIN` | Backend | Your Vercel URL (for CORS) |
| `NEXT_PUBLIC_API_URL` | Frontend | Your Railway backend URL |

---

## 6. Health Check

After deployment, verify:

```bash
curl https://your-backend.railway.app/health
# → {"status":"ok","service":"regulateai","ts":"2024-..."}
```

---

## 7. Estimated Monthly Cost (MVP)

| Service | Cost |
|---|---|
| Railway (backend + DB) | ~$5–10/month |
| Vercel (frontend) | Free |
| **Total** | **~$5–10/month** |
