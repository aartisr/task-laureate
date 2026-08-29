# Self-Hosting & Deployment Guide

This guide provides end-to-end instructions for deploying and self-hosting **Task-Laureate** in your own infrastructure, whether for personal privacy, team collaboration, or enterprise air-gapped environments.

---

## Architecture Overview

Task-Laureate is designed with a **local-first, cloud-synchronized** architecture:
- **Frontend SPA**: React 18, TanStack Router/Query, Vite (can be hosted on any static host, CDN, or container).
- **Backend & Database**: PostgreSQL with Row-Level Security (RLS), Supabase Auth (PKCE flow), Supabase Realtime, and Supabase Storage.
- **AI Decomposition Engine (Opt-in)**: Serverless or edge proxy calling Google Gemini for structured subtask decomposition.
- **Telemetry (Optional & Privacy-gated)**: PostHog with strict user consent gates.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser / PWA                   │
│  ┌───────────────────────┐       ┌────────────────────────┐ │
│  │   UI & TanStack Router│       │ Local Outbox & Storage │ │
│  └───────────┬───────────┘       └───────────┬────────────┘ │
└──────────────┼───────────────────────────────┼──────────────┘
               │ HTTPS (SPA Assets)            │ TLS / WebSockets
               ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│ Static Web CDN / Nginx / S3  │   │     Supabase Stack       │
│ - Vite Production Bundle     │   │ - PostgreSQL + RLS       │
│ - Service Worker (PWA)       │   │ - GoTrue Auth (PKCE)     │
│ - Asset Mirror               │   │ - Realtime Engine        │
└──────────────────────────────┘   │ - Storage S3 Bucket      │
                                   └──────────────────────────┘
```

---

## 1. Quick Start with Docker & Local Supabase

### Prerequisites
- Docker Engine 24+ and Docker Compose
- Node.js 20.19.0+ and npm 10+
- Git

### Step 1: Clone Repository
```bash
git clone https://github.com/aartisr/task-laureate.git
cd task-laureate
npm ci
```

### Step 2: Initialize Local Supabase
```bash
# Install Supabase CLI if not present
npx supabase start
```
This boots up an isolated PostgreSQL instance, Auth server, Realtime engine, and Storage bucket locally on ports:
- API Gateway / Kong: `http://localhost:54321`
- Supabase Studio Dashboard: `http://localhost:54323`
- PostgreSQL: `postgresql://postgres:postgres@localhost:54322/postgres`

### Step 3: Run Database Migrations
```bash
npm run verify:migrations
npx supabase db reset --local
```

### Step 4: Configure Local Environment
Create `.env.local` inside `apps/web/`:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # (Output from `supabase start`)
VITE_APP_URL=http://localhost:3000
VITE_ENABLE_COMMUNITY_FEATURES=true
VITE_AI_DECOMPOSITION_PREVIEW=false
```

### Step 5: Start Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` to start using your self-hosted Task-Laureate instance.

---

## 2. Cloud Production Deployment

### Option A: Supabase Cloud + Vercel / Cloudflare Pages

1. **Create Supabase Project**:
   - Go to [database.new](https://database.new) and create a project.
   - Run migrations via CLI:
     ```bash
     npx supabase link --project-ref your-project-ref
     npx supabase db push
     ```

2. **Configure Authentication in Supabase Dashboard**:
   - Enable Email / Password or Magic Link authentication.
   - Add your production URL to **Redirect URLs**:
     - `https://your-domain.com/auth/callback`
     - `https://your-domain.com/`

3. **Deploy Web Application**:
   - Link repository to Vercel, Cloudflare Pages, Netlify, or AWS Amplify.
   - Set Build Command: `npm run build`
   - Set Output Directory: `dist`
   - Configure Environment Variables:

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes | — |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anonymous API Key | Yes | — |
| `VITE_APP_URL` | Public canonical URL | Yes | Origin |
| `VITE_AI_DECOMPOSITION_PREVIEW` | Enable Gemini smart task decomposition | Optional | `false` |
| `GEMINI_API_KEY` | Google Gemini API key (server-side proxy) | Optional | — |
| `VITE_POSTHOG_KEY` | PostHog telemetry project key | Optional | — |
| `VITE_POSTHOG_HOST` | PostHog telemetry endpoint | Optional | — |

---

## 3. Database Schema & Security Verification

Task-Laureate enforces strict PostgreSQL Row-Level Security (RLS) policies:
- **`lists` Table**: Only list owners and invited collaborators (via `list_members`) can read/write lists.
- **`tasks` Table**: Scoped to the workspace owner and list permissions.
- **`invitations` Table**: Token-protected with 7-day expiration and automatic inviter email resolution.

To verify schema and security rules:
```bash
# Run security audit and test suite
npm run quality:gate
```

---

## 4. Web Push Notification Keys (VAPID)

To enable browser reminders and background notifications:
```bash
node scripts/generate-vapid-keys.mjs
```
Set the generated public and private keys in your notification delivery service.

---

## 5. Health Checks & Monitoring

- **Production Health Probe**: Visit `/` or inspect `window.__APP_SERVICES__` state.
- **Performance Budgets**: Run `npm run check:perf-budgets` to ensure bundle sizes stay within strict low-latency budgets.
- **Exception Reporting**: Built-in global error boundary and local-first diagnostics panel at `/support`.
