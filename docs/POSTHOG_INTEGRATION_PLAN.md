# PostHog Integration Plan (Historical)

## Status and scope

**Status: implemented.** This file is retained as planning history.

Use [docs/POSTHOG_CONFIGURATION_GUIDE.md](docs/POSTHOG_CONFIGURATION_GUIDE.md) as the canonical, current-state integration and operations reference.

This plan adds PostHog product analytics to Task-Laureate without weakening its privacy promise. The product handles inherently sensitive task titles, notes, tags, due dates, collaborator information, and invitation links. PostHog must therefore receive only a small, explicitly allowed event vocabulary—never general UI autocapture or session replay by default.

The existing [`growthTelemetry.ts`](../apps/web/src/infrastructure/analytics/growthTelemetry.ts) module is the integration boundary. Product features should continue to emit its typed, privacy-filtered events; the PostHog adapter becomes one optional delivery sink. Do not import `posthog-js` directly from pages, components, repositories, or mutations.

## Plug-and-play and maintainability contract

The PostHog integration is a plugin, not an application dependency spread through the codebase. It must satisfy these invariants:

1. **One installation point:** registering or removing the PostHog plugin changes only the analytics composition root.
2. **One configuration point:** all PostHog settings come from a typed `AnalyticsConfig`, derived from Vite environment variables once and validated once.
3. **One product event API:** feature code calls `trackGrowthEvent`; it never knows which vendor receives an event.
4. **One lifecycle owner:** the application provider owns startup, consent changes, authenticated identity, and logout/reset. No page initializes or resets PostHog.
5. **Vendor replacement is mechanical:** a future self-hosted PostHog, Plausible, or internal collector can implement the same sink interface without changing product features or event names.
6. **Disabled is a first-class mode:** the no-op plugin is the default in tests, local development, previews, missing configuration, and non-consented sessions.
7. **Contract tests protect the boundary:** all sinks must pass the same privacy, lifecycle, and failure-isolation test suite.

The target composition looks like this:

```ts
export interface AnalyticsSink {
  start(context: AnalyticsContext): void | Promise<void>;
  capture(event: ApprovedGrowthEvent): void;
  identify(identity: AnalyticsIdentity): void;
  reset(): void;
  setConsent(consent: AnalyticsConsent): void;
  stop(): void;
}

const analytics = createAnalyticsDispatcher([
  createBrowserEventSink(),       // local, testable event stream
  createEndpointSink(config),     // optional existing collector
  createPostHogSink(config),      // optional PostHog plugin
]);
```

`createPostHogSink()` returns a no-op sink when PostHog is disabled, configuration is invalid, consent is absent, or the runtime is non-browser. The dispatcher isolates each sink with error boundaries so one vendor cannot affect another or the product.

## Non-negotiable privacy and reliability rules

1. **Analytics is off until a valid project configuration and the chosen consent condition are both satisfied.** Missing or malformed configuration must make analytics a no-op, not crash startup.
2. **Never capture task titles, list titles, notes, tags, descriptions, due dates, email addresses, invitation tokens, query text, URLs containing IDs/tokens, free-form error messages, IP-derived properties, or auth tokens.**
3. **Disable PostHog autocapture, pageview autocapture, session replay, heatmaps, surveys, exception capture, and feature flags for the initial launch.** Each can collect more information than the approved event contract and needs its own privacy review.
4. **Use a stable authenticated UUID only after sign-in; never identify people by email or display name.** Call `reset()` immediately after logout/account change.
5. **Do not make task creation, sign-in, mutation, navigation, or error recovery depend on analytics success.** Capture failures are swallowed and recorded only in development diagnostics.
6. **Treat PostHog project tokens (`phc_…`) as public browser configuration, but never expose a personal API key (`phx_…`).**
7. **Do not enable production collection until the Privacy Notice, consent design, retention policy, and deletion process have been reviewed by the owner and, where applicable, qualified legal counsel.** This plan is technical guidance, not legal advice.

These boundaries align with PostHog’s distinction between public project tokens and private personal API keys, and its recommendation to use stable IDs after login and reset on logout. [PostHog JavaScript web docs](https://posthog.com/docs/libraries/js), [PostHog privacy guidance](https://posthog.com/docs/privacy)

## Decision record required before implementation

Complete this table in the pull request before installing the SDK.

| Decision | Recommended launch choice | Owner decision required |
| --- | --- | --- |
| Hosting region | PostHog Cloud EU for EU-person data, otherwise a documented region; self-host only if operations can support it | Yes |
| Consent | Explicit opt-in for non-essential analytics, default off | Yes |
| SDK features | Manual custom events only | Yes |
| Person identity | Supabase `user.id` after consent and sign-in; no person properties initially | Yes |
| Session replay | Off | Yes |
| Data retention | Shortest plan-supported period that answers the approved questions | Yes |
| Production project | Separate production, preview, and development projects—or production only with preview/dev disabled | Yes |
| Deletion requests | Documented owner-run procedure, including PostHog person/event deletion | Yes |

## Architecture

```text
Product feature or lifecycle
        │
        ▼
trackGrowthEvent(name, allowListedProperties)
        │  validates event name and scalar properties
        ▼
Telemetry dispatcher
   ├── CustomEvent (local observability / tests)
   ├── optional existing endpoint sink
   └── PostHog sink (only after consent + configuration)
             │
             ▼
        posthog.capture(name, properties)
```

### Modules to add

| Module | Responsibility |
| --- | --- |
| `src/infrastructure/analytics/analytics.ts` | Vendor-neutral dispatcher, `AnalyticsSink` contract, lifecycle ownership, and per-sink error isolation. |
| `src/infrastructure/analytics/posthogClient.ts` | Lazy, singleton PostHog initialization; validates Vite configuration; exposes a private implementation detail behind the sink. |
| `src/infrastructure/analytics/posthogSink.ts` | Implements `AnalyticsSink`; forwards only typed events after consent. |
| `src/infrastructure/analytics/noopSink.ts` | Stable disabled implementation used by tests, local development, previews, missing configuration, and consent denial. |
| `src/infrastructure/analytics/analyticsConfig.ts` | Parses, validates, and documents all public environment variables in one place. |
| `src/core/privacy/analyticsConsent.ts` | Storage-backed, versioned consent state; supports `unknown`, `granted`, and `denied`; never reads/writes task data. |
| `src/components/AnalyticsConsentControl.tsx` | Accessible Settings control explaining exactly what is and is not collected. No dark patterns, prechecked boxes, or blocked access. |
| `src/infrastructure/analytics/posthog*.test.ts` | Tests configuration, consent, allow-listing, identify/reset, and no-failure guarantees. |

### Initialization design

1. Add `posthog-js` to `apps/web` with a pinned, reviewed version; keep it inside the PostHog plugin module so disabled builds can avoid loading it eagerly.
2. Create the client only in the browser and only when all conditions hold:
   - `VITE_POSTHOG_KEY` is non-empty and begins with `phc_`.
   - `VITE_POSTHOG_HOST` is an approved HTTPS host.
   - The build is allowed to collect (`VITE_POSTHOG_ENABLED=true`).
   - The person granted the current consent version.
   - The host is not localhost, a test host, or an unapproved preview deployment.
3. Initialize with explicit safe options:

```ts
posthog.init(key, {
  api_host: host,
  defaults: '<current PostHog documented defaults date>',
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_exceptions: false,
  disable_session_recording: true,
  person_profiles: 'identified_only',
  opt_out_capturing_by_default: true,
});
```

4. On consent grant, call `opt_in_capturing()` and initialize/flush the sink. On denial or withdrawal, call `opt_out_capturing()`, `reset()`, and prevent any future forwarding.
5. During auth transitions, the application-level analytics lifecycle calls `identify(session.user.id)` only for consented users. On sign-out, it calls `reset()` before the workspace cache is cleared.
6. Do not pass email, provider name, redirect path, or exception text to PostHog.

PostHog documents its browser package installation, CSP needs, user identification/reset pattern, and opt-out APIs. [PostHog JavaScript web docs](https://posthog.com/docs/libraries/js)

## Environment and Vercel configuration

Add these values to `.env.example` (with placeholders only) and Vercel’s Environment Variables UI:

```dotenv
# Public browser configuration; safe only for a PostHog project token, never phx_.
VITE_POSTHOG_ENABLED=false
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_CONSENT_VERSION=1
```

Rules:

- Use separate keys/projects for production and preview, or disable preview collection.
- Set `VITE_POSTHOG_ENABLED=false` for local development and automated tests.
- Do not put secrets in `VITE_*` variables.
- If a Content-Security-Policy is added later, include PostHog’s current required `script-src`, `connect-src`, and `worker-src` allowances. PostHog warns that missing CSP allowances can silently block capture. [CSP guidance](https://posthog.com/docs/libraries/js)
- Add a Vercel deployment check that rejects production builds with `VITE_POSTHOG_ENABLED=true` but no valid `VITE_POSTHOG_KEY` or host.

## Approved event catalog (v1)

Use lowercase snake_case names. Properties must be scalar, documented, and safe.

| Event | When | Approved properties |
| --- | --- | --- |
| `landing_viewed` | Public home/workspace landing surface opens | `surface` |
| `demo_started` | `/sample` opens | `surface` |
| `signup_started` | Person intentionally opens or submits sign-up/sign-in flow | `source`, `method` (`password` or `oauth`) |
| `signup_completed` | Authentication succeeds | `method` |
| `first_list_created` | First successfully persisted list for an account | none |
| `first_task_created` | First successfully persisted task for an account | none |
| `first_due_date_set` | First successfully persisted due date for an account | none |
| `first_task_completed` | First successful task completion for an account | none |
| `first_list_shared` | First invitation created successfully | `role` |
| `invite_accepted` | Invitation accepted successfully | `resource_type`, `role` |
| `reminder_enabled` | Reminder rule enabled successfully | `offset_minutes` |
| `sync_failed` | Persistence enters a failure state | `surface` |

Forbidden event properties include all resource identifiers, user identifiers, text, URLs, timestamps other than PostHog’s own event time, provider errors, and device identifiers added by application code.

## Implementation sequence

### Step 1: Establish privacy and project controls

- Complete the decision record.
- Create PostHog projects and least-privilege team access.
- Document retention, deletion, regional hosting, and incident ownership.
- Update public privacy information before switching collection on.
- Decide whether existing Vercel Analytics is also covered by the same consent setting; do not silently create two inconsistent policies.

**Exit gate:** owner approval of the event catalog and consent copy.

### Step 2: Add the SDK behind a no-op client

- Install `posthog-js` only in `apps/web`.
- Implement the `AnalyticsSink` contract and dispatcher before the PostHog-specific code.
- Implement configuration parsing with no import-time side effects.
- Create a disabled client for SSR/tests/missing config/localhost/preview.
- Prove that removing `createPostHogSink(config)` from the composition root leaves every feature, event contract, and test intact.
- Add exact configuration validation tests, including rejection of `phx_` values.

**Exit gate:** application behavior and bundle build remain unchanged when PostHog is disabled.

### Step 3: Wire consent and identity lifecycle

- Add Settings control with clear grant, deny, and withdraw actions.
- Store a versioned consent decision locally; re-prompt only when the stated data practice changes.
- Bind `identify` and `reset` to the existing auth subscription in `AppProviders`.
- Test sign-in, sign-out, session switch, failed authentication, and consent withdrawal.

**Exit gate:** no capture occurs before consent; no prior identity survives sign-out or account switching.

### Step 4: Attach the sink to existing telemetry

- Subscribe the PostHog sink to the existing typed `growthTelemetry` custom event.
- Do not modify each page to call PostHog directly.
- Add the remaining first-success events at mutation success boundaries, guarded so each fires once per account and event version.
- Add invitation and reminder events only after the corresponding repository mutation succeeds.

**Exit gate:** every event can be traced to a defined success boundary and passes property allow-list tests.

### Step 5: Build the initial PostHog analysis workspace

Create, version, and document:

1. **Activation funnel:** landing/demo → sign-up start → sign-up complete → first list → first task → first due date.
2. **Retention insight:** users who complete/update meaningful work on two separate days, weekly and monthly cohorts.
3. **Collaboration funnel:** first share → invitation accepted → recipient first task action.
4. **Reliability dashboard:** `sync_failed` rate by release version and surface.
5. **Data quality dashboard:** event volume by environment, consent rate, unknown properties (should be zero), and identity reset rate.

**Exit gate:** dashboards answer one product question each; no vanity dashboard is used as a release criterion.

### Step 6: Controlled rollout

1. Deploy with `VITE_POSTHOG_ENABLED=false` and verify disabled-path behavior.
2. Enable only on a protected preview deployment using a preview project.
3. Verify event payloads in PostHog Live Events using non-production test accounts.
4. Verify consent grant/withdrawal, login/logout, and network failure behavior.
5. Enable production for a small, consented cohort first.
6. Review data quality after 24 hours and 7 days before wider rollout.

Rollback is one environment-variable change: set `VITE_POSTHOG_ENABLED=false` and redeploy. The app must remain fully functional.

## Test plan

### Unit tests

- Missing/invalid configuration returns a no-op client.
- The dispatcher keeps forwarding to healthy sinks when one sink throws or rejects.
- The PostHog plugin can be omitted from composition without changes to feature code.
- `phx_` is rejected; `phc_` is accepted only with an approved HTTPS host.
- No event reaches PostHog before consent.
- The entire event catalog forwards exactly its approved properties.
- Nested objects, text fields, URLs, emails, tokens, and unknown keys are dropped.
- Consent withdrawal opts out, resets identity, and blocks later events.
- Logout/session changes reset the prior identity.
- A thrown PostHog error never rejects a mutation, router transition, or auth flow.

### Integration tests

- First-success events fire once, not on every subsequent mutation.
- Invite and reminder events fire only after a successful repository response.
- Sign-up flow has one completed event per successful session.
- Analytics-disabled builds preserve current user behavior.

### Manual release checks

- Confirm no task text, email, token, or resource ID appears in PostHog Live Events.
- Confirm preview and production projects are distinct.
- Confirm consent control is keyboard accessible, readable at 320px, and does not block the product.
- Confirm PostHog network failure does not affect save, undo, sign-in, or sign-out.
- Confirm deletion/withdrawal operating procedures are documented and owned.

## Explicitly out of scope for v1

- Session replay, heatmaps, autocapture, survey popups, feature flags, experiments, error tracking, and LLM analytics.
- Capturing task content or user-entered text in any form.
- Replacing the existing privacy-safe telemetry API with direct PostHog calls.
- Claiming legal compliance merely because PostHog is configured.

Each requires a separate design, data inventory, consent review, and rollout plan.

## References

- [PostHog JavaScript web SDK](https://posthog.com/docs/libraries/js)
- [PostHog privacy compliance guidance](https://posthog.com/docs/privacy)
- [Task-Laureate growth implementation plan](GROWTH_IMPLEMENTATION_PLAN.md)
- [Task-Laureate architecture guide](ARCHITECTURE_GUIDE.md)
