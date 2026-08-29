# PostHog Integration Guide (Canonical)

This document is the source of truth for Task-Laureate PostHog analytics integration.

## 1) Scope and guarantees

This integration is intentionally narrow and privacy-safe:

- Only approved, typed growth events are emitted.
- No task content, notes, list titles, free-form text, tokens, IDs, URLs, or emails are sent.
- Collection is consent-gated.
- Product behavior is never coupled to analytics success/failure.

Design outcomes:

- Plug-and-play: analytics vendor can be replaced from one composition point.
- Maintainable: feature code never imports PostHog directly.
- Performant: lazy SDK load, no autocapture, no replay.
- Safe by default: disabled mode is first-class and tested.

## 2) Runtime architecture

```text
UI / route lifecycle
   -> trackGrowthEvent(name, properties)
   -> growthTelemetry.ts (event + property allow-listing)
   -> analytics.ts dispatcher (fan-out, error isolation)
   -> posthogSink.ts (consent gate + adapter)
   -> posthog-js capture()
```

Key invariants:

1. Feature code only calls `trackGrowthEvent`.
2. Sink wiring only happens in `analyticsSetup.ts`.
3. PostHog config is parsed once in `analyticsConfig.ts`.
4. Consent and auth lifecycle can reset/reapply identity/opt-in without feature involvement.

## 3) Exact file inventory (all integration touchpoints)

### Core analytics contracts and wiring

- `apps/web/src/infrastructure/analytics/analytics.ts`
- `apps/web/src/infrastructure/analytics/analyticsSetup.ts`
- `apps/web/src/infrastructure/analytics/growthTelemetry.ts`
- `apps/web/src/infrastructure/analytics/growthTelemetry.test.ts`

### PostHog adapter and client state

- `apps/web/src/infrastructure/analytics/posthogSink.ts`
- `apps/web/src/infrastructure/analytics/posthogClient.ts`
- `apps/web/src/infrastructure/analytics/posthog.test.ts`
- `apps/web/src/infrastructure/analytics/posthogStub.ts`

### Consent and Settings UI

- `apps/web/src/core/privacy/analyticsConsent.ts`
- `apps/web/src/components/AnalyticsConsentControl.tsx`
- `apps/web/src/pages/SettingsPage.tsx`

### Lifecycle emitters / identify boundaries

- `apps/web/src/app/providers/AppProviders.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/pages/SignInPage.tsx`
- `apps/web/src/pages/AuthCallbackPage.tsx`
- `apps/web/src/pages/SampleWorkspacePage.tsx`

### Build, type, and dependency plumbing

- `apps/web/vite.config.ts`
- `apps/web/src/types/posthog-js.d.ts`
- `apps/web/src/vite-env.d.ts`
- `apps/web/package.json`

### Documentation

- `docs/POSTHOG_CONFIGURATION_GUIDE.md` (this file)
- `docs/POSTHOG_INTEGRATION_PLAN.md` (planning history)

## 4) Environment contract

Required Vercel environment variables for production:

- `VITE_POSTHOG_ENABLED=true`
- `VITE_POSTHOG_KEY=phc_...`
- `VITE_POSTHOG_HOST=https://us.i.posthog.com` (or EU/self-hosted host)
- `VITE_POSTHOG_CONSENT_VERSION=1` (increment for re-consent)

Validation behavior:

- Missing/invalid values set config `isValid=false` and analytics stays no-op.
- `phx_` keys are rejected.
- Non-HTTPS host is rejected.

## 5) Build-time resolution (important)

`vite.config.ts` resolves `posthog-js` as follows:

- If module resolution finds `posthog-js` (local or hoisted workspace install), real SDK is used.
- If not found, alias falls back to `posthogStub.ts` so build remains green.

This prevents local/offline build failures while preserving production correctness.

## 6) Consent + auth lifecycle behavior

### Consent states

- `unknown`: no capture
- `denied`: no capture, opt-out enforced
- `granted`: opt-in enforced, capture allowed

### Auth transition safety

On account/session transitions:

1. dispatcher reset is invoked
2. stored consent is reapplied
3. identify is reapplied for signed-in user

This prevents stale identity and prevents "stuck opted_out" drift.

## 7) Event catalog (v1)

Approved events:

- `landing_viewed`
- `demo_started`
- `signup_started`
- `signup_completed`
- `first_list_created`
- `first_task_created`
- `first_due_date_set`
- `first_task_completed`
- `first_list_shared`
- `invite_accepted`
- `reminder_enabled`
- `sync_failed`

Do not add new events/properties directly in pages; extend `growthTelemetry.ts` first.

## 8) Operational verification runbook

Use this sequence in production:

1. Redeploy latest master after any env/config change.
2. In app: Settings -> Product Analytics -> Refresh diagnostics.
3. Expected diagnostics for healthy state:
   - Consent decision: `granted`
   - Config valid: `true`
   - Should init now: `true`
   - Cached PostHog client: `true`
   - Opted out: `false`
   - Distinct ID: not `noop`
4. Navigate to `/` and verify `landing_viewed` in PostHog Live Events.

## 9) Diagnostics interpretation

From the in-app diagnostics panel:

- `Distinct ID: noop`
  - Meaning: stub client is active; real SDK not loaded.
  - Causes: missing install in build environment, old deployment, or fallback alias path.
  - Action: ensure latest deployment and successful dependency install; verify build log includes posthog-js resolution.

- `Opted out: true` with `granted`
  - Meaning: consent/state drift or reset without reapply.
  - Action: current code reasserts consent automatically when granted; refresh diagnostics after redeploy.

- `Config valid: false`
  - Meaning: env configuration issue.
  - Action: fix `VITE_POSTHOG_*` vars and redeploy.

## 10) Performance and privacy defaults

Current defaults in `posthogSink.ts`:

- `autocapture: false`
- `capture_pageview: false`
- `capture_pageleave: false`
- `capture_exceptions: false`
- `disable_session_recording: true`
- `person_profiles: 'identified_only'`
- `opt_out_capturing_by_default: true`
- `persistence: 'memory'` until consent

These defaults are deliberate and should not be relaxed without explicit review.

## 11) Extension patterns (generic, maintainable)

### Add a new analytics vendor

1. Implement `AnalyticsSink` for vendor X.
2. Register sink in `analyticsSetup.ts`.
3. Do not modify pages/components.

### Add a new event safely

1. Add event name/type in `growthTelemetry.ts`.
2. Add allow-listed properties only.
3. Add tests in `growthTelemetry.test.ts` and `posthog.test.ts`.
4. Update this guide's event catalog.

### Toggle analytics off instantly

Set `VITE_POSTHOG_ENABLED=false` and redeploy.

## 12) Release checklist

Before enabling in production:

- Confirm env vars are set for the correct project/region.
- Confirm diagnostics panel healthy values.
- Confirm Live Events receives only allow-listed events.
- Confirm no blocked app flow when PostHog host is unreachable.
- Confirm no PII/secret fields in any event payload.

## 13) Notes on compatibility

- This integration is Vite + React + typed dispatcher based.
- It remains vendor-neutral at feature layer.
- It supports US cloud, EU cloud, or self-hosted PostHog via host var.

