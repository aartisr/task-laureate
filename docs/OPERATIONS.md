# Production Operations Runbook

This is the canonical runbook for deploying and operating Task-Laureate.

## 1) System boundary

Task-Laureate is a Vite/React SPA backed by Supabase Auth + Postgres RLS.

- Browser uses user JWT only.
- Server-only Vercel functions handle privileged flows:
  - `/api/invitations` for share invitation creation + Resend delivery
  - `/api/cron/notifications` for scheduled reminder delivery
  - `/api/status-update-requests` for one-time, owner-authorized shared-task update requests
  - `/api/support/exception-reports` for user-approved, sanitized GitHub support issues
- Service-role keys and provider secrets never reach the browser.

## 2) Day-0 environment setup runbook

### Step 1: Database migrations

Apply migrations in order from [supabase/migrations](../supabase/migrations):

- `001` through `038` for a new environment.

Important:

- `006_switch_to_collaboration_persistence.sql` retires legacy `workspace_snapshots` and is intentionally destructive for that table.
- The live `test:supabase` check validates the active `collaboration_lists` and `collaboration_tasks` model. A missing `workspace_snapshots` table is expected after migration `006` and must not be recreated.
- `016` through `023` add private task attachments, the required Storage/RLS lifecycle, and metadata deletion behaviour. Keep the `task-attachments` bucket private.
- `024` through `025` add the directed acyclic task-dependency graph, database completion gate, and batched list-summary projection.
- Run `010_reload_postgrest_schema_cache.sql` if PostgREST reports missing RPC/schema drift.

### Step 2: Vercel project settings

- Root Directory: `apps/web`
- Use committed [apps/web/vercel.json](../apps/web/vercel.json) as deployment contract.

### Step 3: Environment variables

#### Browser-safe (`VITE_*`)

- `VITE_SUPABASE_URL` (required)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (required)
- `VITE_AUTH_PROVIDERS` (optional)
- `VITE_INVITATION_DELIVERY_URL` (production)
- `VITE_VAPID_PUBLIC_KEY` (only for browser push)
- `VITE_POSTHOG_ENABLED` / `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` / `VITE_POSTHOG_CONSENT_VERSION` (if product analytics enabled)
- `VITE_FEATURE_CALENDAR_INTEGRATION=true` (only after the calendar release checks below pass)

#### Server-only

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO`
- `PUBLIC_APP_URL`
- Push keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Google Calendar (two-way scheduling): `CALENDAR_SCHEDULING_ENABLED=true`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `CALENDAR_OAUTH_STATE_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)
- GitHub support reporting: `GITHUB_ISSUES_REPOSITORY` (`owner/repository`) and `GITHUB_ISSUES_TOKEN`

Rule: never place server-only values in `VITE_*`.

### Step 3b: User-approved exception reporting

The app offers a **Report issue** action after an unhandled runtime error and a
**Send report to Support** action in the React recovery screen. It does not
send anything automatically. Before enabling it in Vercel:

1. Choose a support repository. Use a private repository if support reports
   should not be publicly visible.
2. Create a GitHub fine-grained personal access token (or GitHub App
   installation token) restricted to that single repository with only
   **Issues: Read and write** permission. Do not use a classic broad-scope
   token, and never expose this value to the browser.
3. In Vercel, add `GITHUB_ISSUES_REPOSITORY=owner/repository` and
   `GITHUB_ISSUES_TOKEN=<token>` to each environment that should accept
   reports, then redeploy.
4. Sign in with a test user, use the report preview, and confirm an issue is
   created with a sanitized route, message, release, browser, source, and
   optional stack trace. Confirm that an Authorization header, a JWT-like
   value, URL query string, and an `api_key` sample appear as `[REDACTED]`.

The Vercel function verifies the caller’s Supabase session, applies its own
redaction and size limits (so a modified browser cannot bypass them), avoids
adding the reporter identity to the issue, and keeps a short best-effort
duplicate guard. Review GitHub repository access separately; anyone who can
read the selected repository can read the submitted issue.

### Step 3a: Google Calendar two-way scheduling

1. Apply migrations `030_one_way_calendar_scheduling.sql` and
   `031_calendar_reconciliation.sql` after migrations `001`–`029`.
2. In Google Cloud, enable the Google Calendar API and create an OAuth **Web
   application** client. Add the exact callback URL for every environment:
   `https://<app-origin>/api/calendar/google/callback`.
3. Set the browser feature flag and all server-only values above in the same
   Vercel environment. Generate `CALENDAR_OAUTH_STATE_SECRET` with at least 32
   random bytes and `CALENDAR_TOKEN_ENCRYPTION_KEY` as a base64-encoded,
   32-byte AES-256 key. Keep both server-only.
4. Sign in as a non-production user, open an editable task, connect Google
   Calendar, choose a calendar, schedule a block, then change that block’s
   start time and duration in Google Calendar. Return to the task or select
   **Check calendar now** and confirm the task plan matches. Delete the block
   in Google and confirm its scheduled time is cleared while the task remains.
5. Confirm that ordinary Google Calendar events are never imported, modified,
   or deleted. The integration verifies Task-Laureate ownership metadata before
   applying a provider change. Revoke Google consent and confirm the app asks
   for reconnection without changing the task.

Google push notifications only signal that a calendar changed; the server
performs a cursor-based incremental sync to fetch and verify the actual delta.
Channels are renewed when a user schedules or explicitly checks a calendar.

### Step 4: Auth provider setup

In Supabase Auth:

- Set canonical Site URL.
- Add exact callback URLs, including `/auth/callback` for each environment.
- Enable each social provider both in Supabase and its provider console.

### Step 5: Delivery provider setup

- Verify Resend sending domain before production invitation, reminder, and status-request email.
- Validate in-app and email reminders with test accounts. SMS is deliberately not offered.

## 3) Release runbook (every deployment)

1. Pull latest mainline code.
2. Apply pending migrations.
3. Run quality gates from repo root:
   - `npm run verify:production`
   - `npm run lint`
   - `npm test`
   - `npm run build`
4. Deploy to Vercel.
5. Validate core journeys with two test accounts:
   - owner/editor/viewer permissions
   - sharing accept/revoke
   - list/task CRUD
   - attachment upload, preview, and removal by an attachment owner and list editor
   - dependency creation, cycle rejection, blocked completion, and unblocking after prerequisite completion
   - To do → In progress → Done task state transitions
   - scheduled reminder dispatch and explicit status-request delivery paths
   - user-approved exception reporting, including a GitHub issue creation in a test repository
6. Validate deep-link refresh on routes like `/settings` and invitation links.
7. For public releases, validate `/`, `/about/`, `/support`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/og-image-v2.png`; then follow [LAUNCH_AND_DISCOVERY_PLAYBOOK.md](LAUNCH_AND_DISCOVERY_PLAYBOOK.md) for account-owner search and launch work.
8. For the installable web-app release and real-device acceptance checks, follow [PWA release and install guide](PWA_RELEASE_AND_INSTALL_GUIDE.md).

## 4) Reminder operations runbook

Reminder pipeline behavior:

- Cron schedule: daily `13:00 UTC`.
- Bounded claims (up to 80 due deliveries).
- Bounded parallel dispatch (up to 8).
- Idempotent delivery records + bounded retries.

Operational checks:

1. Confirm assignment + reminder rule is enabled.
2. Confirm recipient opted-in to channel.
3. Trigger cron securely.
4. Inspect `task_reminder_deliveries` status and provider logs.

### Explicit status requests

- Only the owner of an active shared task can request an update.
- Only assigned collaborators receive it; the owner never receives their own request.
- The database records an in-app notification first. Email is then attempted only
  when Resend is configured and the recipient has kept email reminders enabled.
- A requester can contact the same recipient about the same task once per UTC
  day. Repeated clicks are safe and do not create another notification or email.
- Inspect `task_status_update_requests` and Vercel function logs if delivery is
  unexpectedly skipped. The request itself remains in-app even if email is not
  configured or the provider is unavailable.

## 5) Environment reset runbook (non-production only)

Use [supabase/scripts/reset_application_data.sql](../supabase/scripts/reset_application_data.sql):

1. Back up data first.
2. Replace script confirmation phrase exactly.
3. Execute with privileged role.
4. Optionally run [supabase/scripts/seed_test_matrix.sql](../supabase/scripts/seed_test_matrix.sql) after creating test users.

Notes:

- Reset is irreversible for application data.
- Script intentionally preserves `auth.users`.

## 6) Incident runbook

### Symptom: RLS 403 / missing RPC

1. Verify migration order.
2. Apply all pending migrations. In particular, `038_reload_postgrest_schema_after_status_requests.sql` repairs the schema-cache reload that was missing after the status-update RPC migration.
3. If the project is already fully migrated and an RPC still returns `PGRST202` or “Could not find the function”, run `010_reload_postgrest_schema_cache.sql` in the Supabase SQL Editor.
4. Re-test endpoint/RPC.

### Symptom: Invitation email failure

1. Check Vercel function logs.
2. Verify `RESEND_*` and `PUBLIC_APP_URL`.
3. Verify Resend domain status.

### Symptom: Reminder not delivered

1. Verify task assignment + due date + rule.
2. Verify user channel preferences.
3. Check cron execution log.
4. Inspect delivery row status and provider response.

### Symptom: Shared list access fails

1. Confirm invited account matches signed-in account.
2. Confirm invitation accepted.
3. Confirm relevant RPC exists after migrations.

### Symptom: App works until refresh

1. Confirm Vercel Root Directory is `apps/web`.
2. Confirm SPA rewrite config from [apps/web/vercel.json](../apps/web/vercel.json).

### Symptom: Support report cannot be sent

1. Confirm the user is signed in and their session is current.
2. Confirm `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and
   `SUPABASE_PUBLISHABLE_KEY` (or its `VITE_` equivalent) are available to
   the Vercel function.
3. Confirm `GITHUB_ISSUES_REPOSITORY` is exactly `owner/repository` and that
   `GITHUB_ISSUES_TOKEN` is a server-only, repository-limited credential with
   **Issues: write** permission.
4. Check Vercel logs for the HTTP status only. Never paste submitted reports,
   authorization headers, or GitHub tokens into logs or issue comments.

## 7) Security and reliability guardrails

- Do not disable RLS to workaround incidents.
- Do not expose service-role keys client-side.
- Keep authorization failures explicit and observable.
- Treat analytics, reminders, and invitation delivery as non-blocking to core task workflows.
