# Remaining work and launch readiness

This is the operational source of truth for work that remains after the
anti-backlog implementation. It distinguishes an implemented experience from
an external integration that still needs credentials, an operational decision,
or production evidence.

**Last reviewed:** 2026-08-12
**Scope:** application integrations, credentials, production validation, and
launch operations. It does not replace the product design in
[ANTI_BACKLOG_IMPLEMENTATION_PLAN.md](ANTI_BACKLOG_IMPLEMENTATION_PLAN.md).

## Status legend

| Status | Meaning |
| --- | --- |
| Complete | Built and available without an external provider. |
| Ready for connection | Contracts, safe fallback, or UI exist; an external setup is still required. |
| Needs implementation | A production-quality capability is not yet built. |
| Needs verification | Code and/or migration exists, but it has not been proven in the target environment. |

## Current product position

The core task experience is usable now: quick capture, natural-language
parsing, local-safe capture delivery, template task decomposition, execution
views, energy/time recommendations, reflection, share-target capture, and a
configurable browser-extension scaffold are in place.

The following features deliberately do **not** pretend to be connected:

- AI decomposition uses a reliable local template fallback; real AI is off.
- Calendar sync is off and its provider rejects requests until OAuth is
  configured.
- Product analytics is opt-in and off unless configured.
- Browser push, email, SMS, and social sign-in are optional integrations that
  require operator configuration.

No private credential belongs in this repository or in any `VITE_*` browser
variable.

## Remaining work, in recommended order

| Priority | Work item | Status | External prerequisite / decision | Evidence of completion |
| --- | --- | --- | --- | --- |
| P0 | Production Supabase smoke test | Needs verification | A non-production test-user JWT and deployed environment values | Run `npm run test:supabase -w apps/web`; prove authenticated CRUD and RLS with at least two accounts. |
| P0 | Production authentication | Ready for connection | Choose initial provider(s), configure Supabase Auth and provider-console credentials | Complete the checklist in [CONFIGURING_LOGIN.md](CONFIGURING_LOGIN.md) on desktop, mobile, and production. |
| P0 | Production environment and delivery setup | Ready for connection | Vercel project/domain, Supabase URL/key, public app URL; choose which delivery channels are enabled | Complete [OPERATIONS.md](OPERATIONS.md) day-0 and release checks. |
| P0 | External capture distribution | Ready for connection | Production app URL, manual browser-extension packaging and install testing | Load the extension, configure its Options URL to `/capture`, and test selected text, link, and page capture. |
| P1 | Real AI task decomposition | Needs implementation | Select an approved AI provider and data-handling policy; provision server-side credentials | Validate structured proposals, fallback behavior, cost controls, and release the feature flag gradually. |
| P1 | One-way calendar scheduling | Needs implementation | Choose Google Calendar, Microsoft 365, or a first provider; create an OAuth application | Create, update, disconnect, and retry task blocks using encrypted server-side tokens. |
| P1 | Calendar reconciliation / two-way sync | Needs implementation | Provider webhook or polling design, conflict policy, and subscription credentials | Prove rescheduling, cancellation, duplicate prevention, and conflict resolution. |
| P1 | Durable remote offline sync | Needs implementation | Remote replay protocol and conflict-resolution product decisions | Pass offline → reconnect end-to-end tests without data loss or silent overwrites. |
| P1 | Execution actions and proposal review | Needs implementation | Final behavior decisions for delegate/archive and editing generated steps | Ship clarify, snooze, park, delegate, archive, and proposal accept/edit/discard flows with tests. |
| P1 | Event-backed retrospective | Needs implementation | Confirm retention and privacy requirements | Persist task events and show the weekly retrospective from those events. |
| P2 | Notifications | Ready for connection | Decide which of push, email, and SMS are offered; provision the relevant vendors | Test opt-in, unsubscribe, retries, and real-device delivery. |
| P2 | Product analytics | Ready for connection | Consent language, analytics host, and a PostHog project token | Enable only after consent is recorded and events are validated in the chosen analytics environment. |
| P2 | Release hardening | Needs verification | Target deployment, representative devices/browsers, accessibility reviewers | Complete performance, accessibility, visual, keyboard-only, and failure-path checks. |

## Credential and configuration inventory

Set these only in the deployment platform or the owning provider console. Keep
server-only values out of the browser build and out of Git.

| Capability | Required configuration | Where it belongs | Current state |
| --- | --- | --- | --- |
| Core cloud sync | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_SUPABASE_WORKSPACE_ID` | Browser-safe deployment variables | Required to use the cloud workspace; verify in the target environment. |
| Social sign-in | Provider client ID/secret, Supabase provider setup, `VITE_AUTH_PROVIDERS` | Secrets in provider console/Supabase; public provider list in deployment variables | Not enabled until an operator chooses and configures providers. |
| AI decomposition | Provider API credential, model/version settings, server-side endpoint, rate limit and budget policy | Server-only secret store and server function | Not configured; do not expose an AI key in `VITE_*`. |
| Calendar | OAuth client ID/secret, exact redirect URIs, encrypted refresh-token storage, webhook secret if applicable | Provider console, server secret store, database encryption/key management | Not configured; the in-app calendar provider is intentionally unconfigured. |
| Browser push | `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Public key in browser configuration; private values server-only | Optional and not active without keys. |
| Email invitations/reminders | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional reply-to, `PUBLIC_APP_URL` | Server-only deployment variables | Optional; needs verified sending domain and test delivery. |
| SMS reminders | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Server-only deployment variables | Optional; keep disabled unless explicitly offered. |
| Product analytics | `VITE_POSTHOG_ENABLED`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_CONSENT_VERSION` | Browser-safe deployment variables after consent/legal approval | Off by default. The PostHog project token is public instrumentation configuration, never a personal API key. |
| Scheduled server work | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | Server-only deployment variables | Needed only for privileged cron workflows; rotate and restrict access. |

## AI: safe path to a real implementation

The existing template decomposer is the required fallback. Do not enable
`VITE_FEATURE_AI_DECOMPOSITION=true` until all items below are complete.

1. Choose the approved provider, data residency, retention policy, and model
   budget. Decide whether task text may leave the Supabase/Vercel boundary.
2. Build a server-side AI adapter; the browser calls the app endpoint, never a
   model vendor directly with a private key.
3. Define and validate a versioned response schema: proposed steps, estimates,
   energy, assumptions, warnings, provider/model/prompt versions, and source
   provenance.
4. Add per-user and per-workspace rate limits, request-size limits, timeout,
   retry policy, cost telemetry, and a cache keyed by an appropriate safe
   input fingerprint.
5. Preserve human control: every proposal must be reviewable, selectively
   accepted, editable, or discarded. A provider failure must return to the
   template fallback without losing the original task.
6. Test malformed output, harmful or irrelevant output, timeout, quota
   exhaustion, opt-out, and privacy deletion. Release first to an internal
   cohort, then measure proposal acceptance and failures before widening.

## Calendar: safe path to a real implementation

Start with one provider and **one-way scheduling**. Two-way sync should only
follow after its conflict rules are proven.

1. Choose the first provider (Google Calendar or Microsoft 365 is usually the
   clearest launch choice), account type, and minimum calendar scopes.
2. Register a server-side OAuth client. Register exact development, preview,
   and production redirect URIs. Keep client secrets and refresh tokens
   server-side; encrypt tokens at rest and make disconnect/revocation work.
3. Implement create/update/delete task blocks with a durable calendar-link
   record containing external event ID, provider revision, and last-sync time.
4. Make scheduling idempotent and explicit: no duplicate event after retry,
   no silent overwrite of user edits, and no success UI until the provider
   confirms it.
5. Add one-way tests for connect, expired token, denied consent, update,
   delete, disconnect, timezone/DST, and retry after a transient failure.
6. Before two-way sync, define source-of-truth and conflict behavior. Then add
   webhook signature validation or bounded polling, cursor storage,
   reconciliation jobs, audit events, and a visible resolution UI.

## Verification and release checklist

### Must complete before a cloud-backed public launch

- [ ] Use separate development/preview/production Supabase environments where
  practical and set the required browser-safe variables in each.
- [ ] Run the live Supabase integration test with a dedicated non-service-role
  test account; test owner/editor/viewer isolation separately.
- [ ] Complete the release workflow in [OPERATIONS.md](OPERATIONS.md),
  including the production core journeys and a production deep-link refresh.
- [ ] Complete the social-login checklist for every enabled provider.
- [ ] Run installed-PWA share and browser-extension capture on real supported
  browsers; configure the production `/capture` URL in extension Options.
- [ ] Confirm export/delete and analytics consent behavior against the deployed
  environment and published privacy terms.
- [ ] Perform keyboard-only, screen-reader, reduced-motion, mobile, and slow/
  offline-network checks on the primary capture and Now flows.
- [ ] Configure error monitoring/log retention and an on-call/incident owner
  before inviting external users.

### Recommended engineering hardening

- [ ] Add end-to-end coverage for offline capture → reconnect, AI proposal
  acceptance, calendar resync, and extension/PWA capture.
- [ ] Replace remaining legacy theme compatibility styling incrementally with
  component-owned tokens; preserve visual regression coverage as it changes.
- [ ] Investigate the Puck editor bundle size. It is route-isolated, but the
  editor route should still meet the chosen performance budget.
- [ ] Add a feature-flag rollout dashboard for capture delivery, AI, calendar,
  and error/retry rates.
- [ ] Write and rehearse incident runbooks for provider outage, token
  revocation, webhook replay, and accidental feature-flag enablement.

## Decisions the product owner must make

These are intentional choices, not missing code defects.

1. Which sign-in provider(s) launch first?
2. Which AI provider, region/data-retention posture, monthly budget, and
   acceptable task-text sharing policy are approved?
3. Which calendar provider launches first, and is the initial scope strictly
   one-way scheduling?
4. Which notification channels are offered at launch: in-app only, browser
   push, email, and/or SMS?
5. Are analytics enabled at launch? If yes, what consent and retention policy
   is approved?
6. What production domain, support address, privacy policy, terms, and
   incident owner will be published?

## Completion definition

Mark an item complete only when its code is merged, configuration is present in
the intended environment, least-privilege access is verified, its failure path
has been tested, and the evidence is recorded in the release checklist. A
credential being created or a feature flag being flipped is not completion by
itself.

## Related references

- [Anti-backlog implementation plan](ANTI_BACKLOG_IMPLEMENTATION_PLAN.md)
- [Login configuration](CONFIGURING_LOGIN.md)
- [Capture channels](CAPTURE_CHANNELS.md)
- [Production operations](OPERATIONS.md)
- [QA and production readiness](QA_AND_PRODUCTION_READINESS.md)
- [PostHog configuration](POSTHOG_CONFIGURATION_GUIDE.md)
