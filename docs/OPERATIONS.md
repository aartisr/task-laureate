# Production Operations Runbook

This is the canonical runbook for deploying and operating Task-Laureate.

## 1) System boundary

Task-Laureate is a Vite/React SPA backed by Supabase Auth + Postgres RLS.

- Browser uses user JWT only.
- Server-only Vercel functions handle privileged flows:
  - `/api/invitations` for share invitation creation + Resend delivery
  - `/api/cron/notifications` for scheduled reminder delivery
- Service-role keys and provider secrets never reach the browser.

## 2) Day-0 environment setup runbook

### Step 1: Database migrations

Apply migrations in order from [supabase/migrations](../supabase/migrations):

- `001` through `025` for a new environment.

Important:

- `006_switch_to_collaboration_persistence.sql` retires legacy `workspace_snapshots` and is intentionally destructive for that table.
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

#### Server-only

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `RESEND_REPLY_TO`
- `PUBLIC_APP_URL`
- Push keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- SMS (optional): `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

Rule: never place server-only values in `VITE_*`.

### Step 4: Auth provider setup

In Supabase Auth:

- Set canonical Site URL.
- Add exact callback URLs, including `/auth/callback` for each environment.
- Enable each social provider both in Supabase and its provider console.

### Step 5: Delivery provider setup

- Verify Resend sending domain before production invitation/reminder email.
- Validate reminder channel settings (in-app/email/SMS) with test accounts.

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
   - reminder dispatch path
6. Validate deep-link refresh on routes like `/settings` and invitation links.
7. For public releases, validate `/`, `/about/`, `/support`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and `/og-image-v2.png`; then follow [LAUNCH_AND_DISCOVERY_PLAYBOOK.md](LAUNCH_AND_DISCOVERY_PLAYBOOK.md) for account-owner search and launch work.

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
2. Run `010_reload_postgrest_schema_cache.sql`.
3. Re-test endpoint/RPC.

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

## 7) Security and reliability guardrails

- Do not disable RLS to workaround incidents.
- Do not expose service-role keys client-side.
- Keep authorization failures explicit and observable.
- Treat analytics, reminders, and invitation delivery as non-blocking to core task workflows.
