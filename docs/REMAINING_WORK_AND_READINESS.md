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
| P0 | Production Supabase smoke test | Complete | Dedicated non-service-role test-user JWT | Passed on 2026-08-12: `npm run test:supabase -w apps/web` verified the active RLS-protected List/Task persistence model and cleanup. |
| P0 | Collaborator permission matrix (owner/editor/viewer) | Complete | Dedicated non-production owner, editor, and viewer accounts | Marked complete by product-owner acceptance on 2026-08-12. The opt-in `npm run test:supabase:permissions -w apps/web` regression check remains available for future environment validation. |
| P0 | Production authentication | Complete | Supabase Auth and the selected launch configuration | Marked complete by product-owner acceptance on 2026-08-12. Keep [CONFIGURING_LOGIN.md](CONFIGURING_LOGIN.md) as the regression and provider-change checklist. |
| P0 | Production environment and delivery setup | Complete | Vercel project/domain, Supabase URL/key, public app URL, and selected delivery channels | Marked complete by product-owner acceptance on 2026-08-12. Keep [OPERATIONS.md](OPERATIONS.md) as the deployment-change and release regression runbook. |
| P0 | External capture distribution | Complete | Production app URL, manual browser-extension packaging and install testing | Marked complete by product-owner acceptance on 2026-08-12. Keep [CAPTURE_CHANNELS.md](CAPTURE_CHANNELS.md) as the installation, distribution, and regression-test guide. |
| P1 | Real AI task decomposition | Complete | Gemini free-tier preview, server-only configuration, restricted internal allowlist, migrations `028`–`029`, consent, validation, cache, quotas, audit trail, and atomic acceptance | Verified and accepted on 2026-08-12. Keep the unpaid preview restricted to opted-in internal users and non-sensitive task text; use the [Gemini plan](GEMINI_FREE_TIER_AI_DECOMPOSITION_PLAN.md) for operational regression and future-provider migration. |
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
| Core cloud sync | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, optional `VITE_SUPABASE_WORKSPACE_ID` | Browser-safe deployment variables | Authenticated List/Task CRUD and RLS smoke test passed in the configured test environment on 2026-08-12; verify separately in each deployed environment. |
| Social sign-in | Provider client ID/secret, Supabase provider setup, `VITE_AUTH_PROVIDERS` | Secrets in provider console/Supabase; public provider list in deployment variables | Not enabled until an operator chooses and configures providers. |
| AI decomposition | Provider API credential, model/version settings, server-side endpoint, rate limit and budget policy | Server-only secret store and server function | Complete and verified for the restricted Gemini free-tier internal preview on 2026-08-12. Do not expose an AI key in `VITE_*`. |
| Calendar | OAuth client ID/secret, exact redirect URIs, encrypted refresh-token storage, webhook secret if applicable | Provider console, server secret store, database encryption/key management | Not configured; the in-app calendar provider is intentionally unconfigured. |
| Browser push | `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Public key in browser configuration; private values server-only | Optional and not active without keys. |
| Email invitations/reminders | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional reply-to, `PUBLIC_APP_URL` | Server-only deployment variables | Optional; needs verified sending domain and test delivery. |
| SMS reminders | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Server-only deployment variables | Optional; keep disabled unless explicitly offered. |
| Product analytics | `VITE_POSTHOG_ENABLED`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_CONSENT_VERSION` | Browser-safe deployment variables after consent/legal approval | Off by default. The PostHog project token is public instrumentation configuration, never a personal API key. |
| Scheduled server work | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | Server-only deployment variables | Needed only for privileged cron workflows; rotate and restrict access. |

## P0 collaborator permission matrix

Use **three isolated non-production accounts**—an owner, an editor, and a
viewer. A single browser profile is insufficient: use separate browser
profiles, private windows, or devices, and verify the email shown in Settings
before each step. Do not use a service-role key, a customer account, or an
account shared with normal development work.

The same proof can run automatically with fresh user-session JWTs. Keep them
out of `.env.local`, Git, shell history, and test output:

```bash
read -rs 'SUPABASE_TEST_OWNER_ACCESS_TOKEN?Owner access token: '; echo
export SUPABASE_TEST_OWNER_ACCESS_TOKEN
read -rs 'SUPABASE_TEST_EDITOR_ACCESS_TOKEN?Editor access token: '; echo
export SUPABASE_TEST_EDITOR_ACCESS_TOKEN
read -rs 'SUPABASE_TEST_VIEWER_ACCESS_TOKEN?Viewer access token: '; echo
export SUPABASE_TEST_VIEWER_ACCESS_TOKEN
npm run test:supabase:permissions -w apps/web
unset SUPABASE_TEST_OWNER_ACCESS_TOKEN SUPABASE_TEST_EDITOR_ACCESS_TOKEN SUPABASE_TEST_VIEWER_ACCESS_TOKEN
```

This test removes its disposable Lists and Tasks. Accepted invitation records
are intentionally retained as audit history by the database, so use only the
three dedicated test accounts.

1. As the **owner**, create a uniquely named List and one Task. Open the List,
   select **Share**, invite the editor email as **Can edit**, and send the
   secure link shown in the panel to that same email. Repeat for the viewer
   email as **View only**. The secure-link fallback works even when Resend is
   not configured.
2. As the **editor**, open the editor link while signed in to the invited
   email. Confirm it appears in **Shared with me**, the List displays the
   editor access banner, and the editor can create a Task and edit an existing
   Task. Confirm the editor cannot open sharing controls, change List settings,
   or revoke invitations.
3. As the **viewer**, open the viewer link while signed in to the invited
   email. Confirm it appears in **Shared with me**, shows the view-only access
   banner, and its contents are readable. Confirm task creation, editing,
   completion, archive/delete, sharing, and invitation management controls are
   unavailable. Attempting a direct route refresh must remain read-only.
4. As the **owner**, verify both collaborator changes are visible. Revoke the
   viewer invitation/access, then have the viewer refresh the List and
   **Shared with me**. The resource must disappear and direct navigation must
   no longer expose it. Finally, delete the uniquely named test List.

Record the environment URL, the three test-account aliases (never their
tokens), execution date, and pass/fail result in the release record. Mark the
P0 collaborator permission matrix complete only after all four steps pass in
the target deployment environment.

## AI: safe path to a real implementation

The existing template decomposer remains the required fallback. The restricted
Gemini preview completed the following implementation and release controls on
2026-08-12; retain them as the regression checklist for future changes.

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
- [x] Run the live Supabase integration test with a dedicated non-service-role
  test account (passed on 2026-08-12).
- [x] Complete the owner/editor/viewer collaborator permission matrix (marked complete by product-owner acceptance on 2026-08-12).
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
- [Gemini free-tier AI decomposition plan](GEMINI_FREE_TIER_AI_DECOMPOSITION_PLAN.md)
- [Login configuration](CONFIGURING_LOGIN.md)
- [Capture channels](CAPTURE_CHANNELS.md)
- [Production operations](OPERATIONS.md)
- [QA and production readiness](QA_AND_PRODUCTION_READINESS.md)
- [PostHog configuration](POSTHOG_CONFIGURATION_GUIDE.md)
