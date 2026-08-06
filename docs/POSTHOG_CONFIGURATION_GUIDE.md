# PostHog Configuration & Usage Guide

**Task-Laureate PostHog Integration — Production Reference**

---

## Table of contents

1. [Implementation overview](#implementation-overview)
2. [Design patterns used](#design-patterns-used)
3. [Production readiness checklist](#production-readiness-checklist)
4. [Step-by-step activation](#step-by-step-activation)
5. [Self-hosted & EU cloud setup](#self-hosted--eu-cloud-setup)
6. [Event catalog with PostHog query examples](#event-catalog-with-posthog-query-examples)
7. [PostHog dashboards to build](#posthog-dashboards-to-build)
8. [Advanced PostHog features — when to enable each](#advanced-posthog-features--when-to-enable-each)
9. [Consent & GDPR workflow](#consent--gdpr-workflow)
10. [Testing the integration](#testing-the-integration)
11. [Rollback procedure](#rollback-procedure)
12. [Architecture decisions log](#architecture-decisions-log)

---

## Implementation overview

```
Product feature / lifecycle hook
         │
         ▼  trackGrowthEvent('event_name', { scalar_properties })
         │  ← only approved event names + scalar properties pass through
         ▼
  growthTelemetry.ts        (privacy filter — strips nested objects, emails, IDs)
         │
         ▼
  AnalyticsDispatcher       (analytics.ts — fan-out with per-sink error isolation)
    ├── CustomEvent          (window 'task-laureate:growth-event' — local observability)
    └── PostHogSink          (posthogSink.ts — consent-gated, vendor-specific)
              │
              ├── config.isValid = false  ──→  no-op (stub or disabled)
              ├── consent = unknown/denied ──→ queued events dropped, opt_out_capturing()
              └── consent = granted  ──────→  opt_in_capturing() → posthog.capture()
```

### Files added / modified

| File | Role | Pattern |
|---|---|---|
| `analytics.ts` | `AnalyticsSink` contract + `createAnalyticsDispatcher` | Strategy + Composite |
| `analyticsConfig.ts` | Env-var parsing and validation | Validated Value Object |
| `analyticsSetup.ts` | Composition root — ONE place to wire sinks | Composition Root |
| `posthogClient.ts` | Singleton state store — zero vendor dependency | Singleton + State |
| `posthogSink.ts` | PostHog vendor adapter | Adapter + Null Object |
| `posthogStub.ts` | Build-time no-op when package absent | Null Object |
| `noopSink.ts` | Runtime no-op for disabled/test/consent-denied | Null Object |
| `analyticsConsent.ts` | Versioned, storage-backed consent | Event-driven State |
| `AnalyticsConsentControl.tsx` | Accessible UI — grant, deny, withdraw | Controlled Component |
| `vite.config.ts` | Alias resolves stub↔real package | Build-time Strategy |

---

## Design patterns used

### 1. Strategy pattern — `AnalyticsSink`
Every analytics vendor implements the same six-method interface. Swapping PostHog for Plausible, Amplitude, or an internal collector is a one-line change in `analyticsSetup.ts`.

### 2. Composite + Null Object — `createAnalyticsDispatcher`
The dispatcher fans events to all registered sinks. Each sink is wrapped in an error boundary. A broken or disabled sink never affects another sink or product behaviour. `createNoopSink()` / `posthogStub.ts` are canonical Null Objects.

### 3. Composition Root — `analyticsSetup.ts`
All wiring happens in exactly one place. Features, tests, and pages never construct sinks or know vendor names. This is the "one installation point" invariant from the plan.

### 4. Validated Value Object — `AnalyticsConfig`
Config is parsed once and immutable. Invalid config immediately returns `isValid: false` with a human-readable reason. `phx_` personal keys are structurally rejected. No invalid configuration ever reaches PostHog.

### 5. Adapter — `posthogSink.ts`
Translates the application's `ApprovedGrowthEvent` vocabulary into PostHog's `posthog.capture()` API. The application never speaks PostHog's language directly.

### 6. Build-time Strategy — `vite.config.ts` alias
`posthog-js` resolves to the real package when installed (Vercel, CI after `npm ci`) or to `posthogStub.ts` when absent (local dev, offline CI). The build is unconditionally green.

### 7. Event sourcing for consent — `analyticsConsent.ts`
Consent is versioned. Bumping `VITE_POSTHOG_CONSENT_VERSION` from `1` to `2` makes any stored decision `'unknown'`, triggering a re-prompt. Historical decisions for the old version are never silently reused for new data practices.

---

## Production readiness checklist

### Before enabling `VITE_POSTHOG_ENABLED=true`

- [ ] Complete the decision record table in `POSTHOG_INTEGRATION_PLAN.md`
- [ ] Update the Privacy Notice to describe the event catalog and retention period
- [ ] Create PostHog projects: separate **production**, **preview**, and optionally **development** projects
- [ ] Confirm the ingest region (US Cloud, EU Cloud, or self-hosted) aligns with where users are
- [ ] Document the deletion procedure (see [Consent & GDPR workflow](#consent--gdpr-workflow))
- [ ] Set `VITE_POSTHOG_ENABLED=false` for preview deployments (or use a preview-only project key)
- [ ] Add the verification script guard (already wired in `verify:production` npm script):
  - The existing `verify-production-config.mjs` should reject builds with enabled PostHog but no valid key
- [ ] Smoke-test with PostHog Live Events on a non-production account (see [Testing](#testing-the-integration))
- [ ] Confirm `posthog-js` version is pinned after review (update `^1.200.0` to an exact version)

### Technical invariants (already implemented)

- [x] `tsc --noEmit` passes with zero errors — types compile before and after `npm install`
- [x] `npm run build` succeeds when `posthog-js` is absent (stub alias in `vite.config.ts`)
- [x] No event reaches PostHog before consent (`consentGranted` gate in sink)
- [x] `phx_` personal API keys rejected at config parse time
- [x] Non-HTTPS hosts rejected at config parse time
- [x] PostHog SDK starts in `opt_out_capturing_by_default: true` mode
- [x] `persistence: 'memory'` until consent — no cookies or localStorage before opt-in
- [x] `reset()` called before workspace cache clears on sign-out (wired in `AppProviders.tsx`)
- [x] `identify()` uses `user.id` (UUID) only — never email, display name, or phone
- [x] All six privacy-dangerous PostHog features disabled (autocapture, pageview, pageleave, exceptions, session recording, heatmaps)
- [x] Analytics dispatcher error isolation: a PostHog exception never rejects a mutation or navigation
- [x] Rollback is one env-var change: `VITE_POSTHOG_ENABLED=false`

---

## Step-by-step activation

### 1. Create a PostHog project

1. Go to [app.posthog.com](https://app.posthog.com) (US) or [eu.posthog.com](https://eu.posthog.com) (EU)
2. Create an organization and a **Production** project
3. Copy the **Project API key** — it begins with `phc_`
4. (Optional) Create a separate **Preview** project for staging

### 2. Set Vercel environment variables

In the Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Environment |
|---|---|---|
| `VITE_POSTHOG_ENABLED` | `true` | Production only |
| `VITE_POSTHOG_KEY` | `phc_your_production_token` | Production only |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` | Production only |
| `VITE_POSTHOG_CONSENT_VERSION` | `1` | Production only |

> **Never** set `VITE_POSTHOG_ENABLED=true` for Preview or Development environments unless you have a separate project key for those. Mixing environments contaminates production analytics.

### 3. Pin the SDK version

After `npm install` installs posthog-js, run:

```bash
# Find the installed version
cat node_modules/posthog-js/package.json | grep '"version"'

# Pin it in package.json (replace 1.240.x with the installed version)
npm install posthog-js@1.240.x --save-exact
```

### 4. Redeploy

Push to `master` — Vercel will run `npm ci` (installs posthog-js from the public registry), build, and deploy.

### 5. Verify in PostHog Live Events

1. Open PostHog → Live Events
2. Open the production app in a private browser window
3. Sign in and grant consent in Settings → Product Analytics
4. Navigate to the home page — you should see `landing_viewed` appear within seconds

---

## Self-hosted & EU cloud setup

### PostHog Cloud EU

Set one environment variable:

```
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

No other change required. Data stays in the EU. Required if any users are EU residents and you need GDPR data residency.

### Self-hosted PostHog

1. Deploy PostHog using their [self-hosted guide](https://posthog.com/docs/self-host)
2. Set:
   ```
   VITE_POSTHOG_HOST=https://posthog.your-company.com
   ```
3. The project token (`phc_...`) comes from your self-hosted PostHog instance's project settings
4. All PostHog data stays on your infrastructure — no data leaves your network

### Reverse proxy (recommended for production)

To avoid adblockers intercepting PostHog calls, proxy through your own domain:

```nginx
# nginx example
location /ingest/ {
  proxy_pass https://us.i.posthog.com/;
  proxy_set_header Host us.i.posthog.com;
}
```

Then set:
```
VITE_POSTHOG_HOST=https://your-app.com/ingest
```

This dramatically improves capture rates (adblockers block `posthog.com` but not your domain).

---

## Event catalog with PostHog query examples

### Full approved event catalog (v1)

| Event | Trigger | Properties |
|---|---|---|
| `landing_viewed` | Public landing/home opens | `surface: string` |
| `demo_started` | `/sample` route opens | `surface: string` |
| `signup_started` | Sign-up flow opened or submitted | `source: string`, `method: 'password' \| 'oauth'` |
| `signup_completed` | Authentication succeeds | `method: 'password' \| 'oauth'` |
| `first_list_created` | First persisted list for account | _(none)_ |
| `first_task_created` | First persisted task for account | _(none)_ |
| `first_due_date_set` | First persisted due date for account | _(none)_ |
| `first_task_completed` | First task completion for account | _(none)_ |
| `first_list_shared` | First invitation created | `role: 'editor' \| 'viewer'` |
| `invite_accepted` | Invitation accepted | `resource_type: 'list' \| 'task'`, `role: string` |
| `reminder_enabled` | Reminder rule enabled | `offset_minutes: number` |
| `sync_failed` | Persistence enters error state | `surface: string` |

### HogQL queries for PostHog

```sql
-- Activation funnel: landing → signup → first list
SELECT
  countIf(event = 'landing_viewed')     AS landed,
  countIf(event = 'signup_completed')   AS signed_up,
  countIf(event = 'first_list_created') AS created_list,
  countIf(event = 'first_task_created') AS created_task
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY

-- Weekly retention (users active on 2+ separate calendar weeks)
SELECT
  person_id,
  count(DISTINCT toStartOfWeek(timestamp)) AS active_weeks
FROM events
WHERE event IN ('first_task_created', 'first_task_completed')
  AND timestamp >= now() - INTERVAL 90 DAY
GROUP BY person_id
HAVING active_weeks >= 2

-- Collaboration conversion rate
SELECT
  countIf(event = 'first_list_shared')  AS shared,
  countIf(event = 'invite_accepted')    AS accepted,
  round(countIf(event = 'invite_accepted') / countIf(event = 'first_list_shared') * 100, 1) AS accept_rate_pct
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY

-- Reliability: sync_failed rate by week
SELECT
  toStartOfWeek(timestamp) AS week,
  count() AS sync_failures
FROM events
WHERE event = 'sync_failed'
GROUP BY week
ORDER BY week DESC

-- Reminder adoption: offset distribution
SELECT
  properties.offset_minutes AS offset,
  count() AS count
FROM events
WHERE event = 'reminder_enabled'
GROUP BY offset
ORDER BY count DESC
```

---

## PostHog dashboards to build

Build these five dashboards immediately after enabling production collection:

### Dashboard 1: Activation funnel
**Insight type:** Funnel  
**Steps (in order):**
1. `landing_viewed`
2. `signup_started`
3. `signup_completed`
4. `first_list_created`
5. `first_task_created`
6. `first_due_date_set`

**Conversion window:** 14 days  
**Purpose:** Identify where users drop off in the activation journey.

### Dashboard 2: Retention (weekly)
**Insight type:** Retention  
**Starting event:** `signup_completed`  
**Returning event:** `first_task_completed` OR `first_task_created`  
**Granularity:** Weekly  
**Purpose:** Are users coming back to do meaningful work?

### Dashboard 3: Collaboration funnel
**Insight type:** Funnel  
**Steps:**
1. `first_list_shared`
2. `invite_accepted`

**Purpose:** What fraction of invitations are accepted? Track over time.

### Dashboard 4: Reliability
**Insight type:** Trend  
**Event:** `sync_failed`  
**Breakdown by:** `properties.surface`  
**Filter:** Last 30 days  
**Purpose:** Catch regressions in sync reliability after each release.

### Dashboard 5: Data quality (required from day 1)
**Insights to include:**
- Event volume by environment tag (should be 0 from dev/preview if disabled correctly)
- Consent grant rate: `users who granted` / `users who saw the consent control`
- `sync_failed` count (should trend toward 0 after fixes)
- Distinct identity count over time (should match auth sign-ups)

---

## Advanced PostHog features — when to enable each

These are **off by default** and require separate privacy review before enabling.

### Feature flags
**What:** Server-side flags to control feature rollout by user cohort.  
**Enable when:** You want to ship to 5% of users before full rollout.  
**Privacy:** Flags require identifying the user — only enable for consented, authenticated users.  
**Code change needed:** Add `posthog.isFeatureEnabled('flag-name')` calls + a separate PR reviewing which user data is sent to evaluate flags.

### Session replay
**What:** Records user sessions for debugging UX issues.  
**Enable when:** You need to diagnose specific support tickets — NOT for general analytics.  
**Privacy concern:** This captures everything visible on screen. Task-Laureate shows task content — session replay would record private task titles and notes. **Do not enable without masking all input fields and task content elements.**  
**Configuration needed:**
```ts
// If ever enabled, mask everything by default:
session_recording: {
  maskAllInputs: true,
  maskTextSelector: '[data-task-content], [data-note-content]',
}
```

### Autocapture
**What:** Automatically captures every click, input, and form submission.  
**Enable when:** Never for Task-Laureate in its current form.  
**Privacy concern:** Captures button text, input values, URLs with resource IDs, and query strings. Incompatible with the event allow-list model.

### Surveys
**What:** In-product survey popups.  
**Enable when:** You want to ask NPS or qualitative questions.  
**Privacy:** Safe — surveys are initiated by PostHog on your schedule and users can decline.  
**Requires:** Consent must already be granted. Surveys should be shown only to `identified_only` users.

### A/B testing (experiments)
**What:** Ship two variants and measure which converts better on a funnel.  
**Enable when:** You have enough volume (>500 users/week) to reach statistical significance.  
**Code change needed:** Wrap variant logic around the feature flag evaluation. Add the variant as a property to activation events.

### Exception capture / error tracking
**What:** Automatically captures unhandled JavaScript errors with stack traces.  
**Privacy concern:** Stack traces can contain function arguments that include user data if user input reaches the call stack. **Not safe for Task-Laureate without sanitization.**

---

## Consent & GDPR workflow

### User-facing flow

1. User opens Settings → "Product Analytics" section
2. Card shows exactly what IS and IS NOT collected (no dark patterns)
3. User clicks "Enable analytics" → `setConsentDecision('granted', version)` → PostHog `opt_in_capturing()`
4. User clicks "Withdraw consent" → `withdrawConsent(version)` → PostHog `opt_out_capturing()` + `reset()` — identity is disassociated

### Operator deletion procedure

When a user requests deletion of their analytics data:

1. Go to PostHog → Persons → search by the user's Supabase `user.id` (the distinct ID used for identification)
2. Click the person → "Delete person" → confirm
3. This deletes all events associated with that distinct ID from PostHog's storage
4. The user's tasks and data in Supabase are unaffected — PostHog and Supabase are independent

### Bumping the consent version

When data practices change (e.g., adding a new event, new properties, or new PostHog features):

1. Increment `VITE_POSTHOG_CONSENT_VERSION` in Vercel environment variables (e.g., `1` → `2`)
2. Update the consent card copy in `AnalyticsConsentControl.tsx` to describe the change
3. Update the Privacy Notice
4. Deploy — all users will see `getConsentDecision(2)` return `'unknown'` and be prompted again

---

## Testing the integration

### Unit tests
```bash
cd apps/web && npm test -- --reporter=verbose posthog
```

Covers: config validation, dispatcher error isolation, consent gate, identify/reset, consent versioning.

### Manual smoke test (pre-production)

1. Set `VITE_POSTHOG_ENABLED=true`, `VITE_POSTHOG_KEY=phc_preview_token`, `VITE_POSTHOG_HOST=https://us.i.posthog.com` in `.env.local`
2. Also set `VITE_POSTHOG_FORCE_LOCAL=true` to bypass the localhost guard
3. Open PostHog → Live Events (filter by your project)
4. Open the app, sign in, open Settings → Product Analytics → click "Enable analytics"
5. Navigate to the home page
6. **Verify:** you see `landing_viewed` in Live Events with only `surface` property — no task data, no email, no IDs
7. Sign out
8. **Verify:** no further events are captured after sign-out (identity reset)
9. Go to PostHog → Persons → confirm the person entry shows only the UUID, not email/name

### Verifying the disabled path (Vercel)

After deploying with `VITE_POSTHOG_ENABLED=false`:

1. Open the deployed app and inspect the Network tab
2. **Verify:** zero requests to `posthog.com`, `us.i.posthog.com`, `eu.i.posthog.com`, or your self-hosted host
3. Open the browser Console
4. **Verify:** no PostHog-related errors

---

## Rollback procedure

PostHog is fully isolated from product behaviour. Rollback is instant:

1. In Vercel → Environment Variables → set `VITE_POSTHOG_ENABLED=false`
2. Trigger a redeploy (or use Vercel's "Instant Rollback" to the previous deployment)
3. The app returns to full functionality with zero analytics
4. No code changes, no database migrations, no feature flag changes required

---

## Architecture decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Static vs dynamic import | Dynamic (via alias) | Build succeeds without posthog-js installed; disabled builds deliver zero PostHog bytes |
| Consent storage | `localStorage` | Survives page refresh; no server round-trip; survives cookie clearing |
| Consent version | Integer in env var | Owner controls re-prompting by bumping the version; no code change required |
| Identity field | `user.id` (UUID) | Stable across sessions; never leaks PII; maps 1:1 to Supabase auth |
| Persistence before consent | `'memory'` | PostHog writes no cookies or localStorage until opt-in |
| localhost guard | Skip initialization | Prevents dev traffic contaminating production funnels |
| Sink error isolation | `Promise.allSettled` | One broken vendor never rejects a React event handler or mutation |
| Vendor swap | Change `analyticsSetup.ts` only | Composition root is the single source of truth for all vendor wiring |
| Rollback | One env-var change | No deployment risk; Vercel instant rollback covers the rest |
