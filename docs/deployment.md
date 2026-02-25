# AI Logger — Deployment Guide

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
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
FRONTEND_URL=https://your-app.vercel.app
FREE_PLAN_LIMIT=1000
PRO_PLAN_LIMIT=50000
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
fly secrets set DATABASE_URL="..." JWT_SECRET="..." STRIPE_SECRET_KEY="..."
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

## 4. Stripe Setup

### Create Products

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Products → Add product
   - Name: **AI Logger Pro**
   - Price: **$29.00 / month** (recurring)
3. Copy the **Price ID** → set as `STRIPE_PRO_PRICE_ID`

### Webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://your-backend.railway.app/billing/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET`

### Test locally with Stripe CLI

```bash
stripe listen --forward-to localhost:4000/billing/webhook
```

---

## 5. Monthly Usage Reset (Cron Job)

The `reset_monthly_usage()` PostgreSQL function resets log counters on the 1st of each month.

### Option A — pg_cron (if your DB supports it)

```sql
SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT reset_monthly_usage()');
```

### Option B — Railway Cron Job

Add a separate Railway service that runs:
```bash
node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT reset_monthly_usage()')"
```
Set schedule: `0 0 1 * *`

### Option C — The middleware handles it automatically

The `planLimit.js` middleware already checks if the billing cycle has rolled over and resets the counter on the next API call. No cron needed for MVP.

---

## 6. Custom Domain

### Backend (Railway)
Settings → Domains → Add custom domain → point your DNS CNAME to Railway

### Frontend (Vercel)
Project Settings → Domains → Add → follow DNS instructions

---

## 7. Environment Variables Summary

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `JWT_SECRET` | Backend | Random 32-byte hex string |
| `JWT_EXPIRES_IN` | Backend | Token expiry (e.g. `7d`) |
| `STRIPE_SECRET_KEY` | Backend | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Backend | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Backend | Stripe Price ID for Pro plan |
| `FRONTEND_URL` | Backend | Your Vercel URL (for CORS + redirects) |
| `FREE_PLAN_LIMIT` | Backend | Max logs/month on free plan |
| `PRO_PLAN_LIMIT` | Backend | Max logs/month on pro plan |
| `NEXT_PUBLIC_API_URL` | Frontend | Your Railway backend URL |

---

## 8. Health Check

After deployment, verify:

```bash
curl https://your-backend.railway.app/health
# → {"status":"ok","ts":"2024-..."}
```

---

## 9. Estimated Monthly Cost (MVP)

| Service | Cost |
|---|---|
| Railway (backend + DB) | ~$5–10/month |
| Vercel (frontend) | Free |
| Stripe | 2.9% + 30¢ per transaction |
| **Total** | **~$5–10/month** |
