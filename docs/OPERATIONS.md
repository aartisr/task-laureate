# Production operations

This is the canonical deployment and operating guide for Task Laureate. It replaces the overlapping Supabase persistence, Vercel notification, and Resend invitation setup guides.

## Architecture at a glance

The browser is a React/Vite single-page application. Supabase Auth provides the signed-in user JWT; Postgres row-level security (RLS) authorizes every List and Task read or mutation. Collaboration data is normalized in `collaboration_*` tables—`workspace_snapshots` is legacy data and is not used by the current application.

Two Vercel server functions hold server-only credentials:

- `/api/invitations` creates a one-time invitation under the caller's RLS identity and sends it with Resend.
- `/api/cron/notifications` claims a bounded batch of due task reminders, records idempotent delivery state, and dispatches in-app, email, or opt-in SMS delivery.

The browser never receives a Supabase service-role key, Resend key, Twilio credential, invitation token digest, or another person's delivery details.

## Database release procedure

Apply migrations in lexical order from [`supabase/migrations`](../supabase/migrations). For a new environment, that means `001` through `015`.

`006_switch_to_collaboration_persistence.sql` intentionally removes the legacy `workspace_snapshots` table. It is suitable only for an early-stage environment where that data has been deliberately retired. It does not remove Supabase Auth users. Take a database backup and obtain explicit approval before applying it to an environment with data to preserve.

After applying migrations, run `010_reload_postgrest_schema_cache.sql` if PostgREST reports a missing RPC or stale schema. It is safe to run again.

The current normalized model is:

| Area | Tables / boundary |
| --- | --- |
| Lists and tasks | `collaboration_workspaces`, `collaboration_lists`, `collaboration_tasks` |
| Sharing | list/task collaborator tables, `share_invitations`, owner-only RPCs |
| Scale reads | dashboard and keyset feed RPCs in migrations `013`–`014` |
| Reminders | `task_assignments`, `task_reminder_rules`, `task_reminder_deliveries` in `015` |
| User-owned notification controls | `notification_preferences`, `notification_events` |

Use the Supabase CLI or SQL Editor according to your team’s migration process. The application cannot create schema at runtime.

### Resetting an early-stage environment

[`supabase/scripts/reset_application_data.sql`](../supabase/scripts/reset_application_data.sql) resets all Task-Laureate application records in one transaction while retaining the database schema, RLS policies, RPCs, Auth settings, and `auth.users` accounts. It deliberately has a confirmation interlock: change its `CHANGE_ME` value to the exact phrase documented in the script before running it with a privileged role in the Supabase SQL Editor. It requires the collaboration core and safely skips optional notification, push, or reminder tables that are absent from an older project; the final notice reports zero counts for every table it cleared.

The reset is irreversible for Lists, Tasks, shares, invitation state, reminders, notifications, and push subscriptions. Export or back up anything worth retaining first. It intentionally does not delete Supabase Auth users; delete test accounts separately from **Authentication → Users** if that is also required.

[`supabase/scripts/seed_test_matrix.sql`](../supabase/scripts/seed_test_matrix.sql) is a companion local/staging-only coverage seed. Create three Supabase Auth test accounts first, substitute their UUIDs and the explicit environment confirmation in the script, reset the application data, then run the seed. It creates deterministic data for owner/editor/viewer permissions, List and Task lifecycle states, rich notes, reminders, notifications, push records, and invitation states. Its synthetic invitations intentionally cannot be redeemed; create a new invitation through the UI to test the real token and email flow.

## Vercel configuration

Set the Vercel Root Directory to `apps/web`. The committed [`apps/web/vercel.json`](../apps/web/vercel.json) is the source of truth for the build, SPA fallback, security headers, and daily cron.

Browser-safe build variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Browser publishable/anon key |
| `VITE_AUTH_PROVIDERS` | No | Comma-separated identifiers for providers already enabled in Supabase |
| `VITE_INVITATION_DELIVERY_URL` | Production | `/api/invitations`; omit locally to use copy-link fallback |
| `VITE_VAPID_PUBLIC_KEY` | Only for browser push | Public half of a stable VAPID key pair |

Server-only variables:

| Variable | Required | Used by |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` | Yes for scheduled reminders | Cron function |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Yes for invitation email and email reminders | Invitation and cron functions |
| `RESEND_REPLY_TO` | No | Resend messages |
| `PUBLIC_APP_URL` | Yes for invitation email | Canonical app origin, no trailing slash |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Only for browser push | Cron function |
| `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Only for SMS reminders | Cron function |

Never put server-only values in a `VITE_*` variable or local client configuration. Use separate Supabase projects and secrets for Preview and Production whenever possible.

## Auth and invitation setup

In Supabase Auth, set the canonical production Site URL and allow exact callback URLs such as `https://tasks.example.com/auth/callback` and `http://localhost:5173/auth/callback`. Configure each social provider in Supabase and register its exact Supabase callback URL with that provider.

For Resend, verify the sending domain before setting `RESEND_FROM_EMAIL`. Test an invitation with a second account: the email should arrive, the one-time link should require the addressed account, and the recipient should appear in **Shared with me** after acceptance.

## Reminder behavior and limits

Only a task owner can assign someone or configure a task reminder. An assignee must already have List or Task access; assignment never grants access. Recipients independently choose email and opt-in SMS in Settings. SMS is skipped unless a valid E.164 number, an opt-in timestamp, and a configured provider are all present.

The committed cron runs daily at `13:00 UTC`. It claims at most 80 due deliveries and sends at most eight concurrently. The database stores a unique event key before provider dispatch; failed external sends retry at most three times with the same provider idempotency key. This is reliable scheduled delivery, not minute-precise scheduling.

## Release checklist

1. Apply the database migrations and reload the PostgREST schema cache when needed.
2. Configure Supabase Auth URLs and all Vercel variables for the target environment.
3. Run `npm run verify:production`, `npm run lint`, `npm test`, and `npm run build` from the release commit.
4. With two test accounts, verify owner/editor/viewer sharing, revocation, and **Shared with me**.
5. Verify task title, note, and priority editing; read-only users must not see mutation controls.
6. Create an assigned due task, opt into an approved channel, invoke the cron securely, and inspect the delivery record plus recipient inbox/email/SMS.
7. Confirm a deep link such as `/settings` and an invitation URL work after a hard refresh.

## Incident triage

| Symptom | First check |
| --- | --- |
| RLS 403 or missing RPC | Migration order, then run `010_reload_postgrest_schema_cache.sql` |
| Invitation email fails | Vercel function log, Resend domain verification, `PUBLIC_APP_URL`, and `RESEND_*` variables |
| Reminder is not delivered | Assignment, rule enabled state, due date, recipient channel consent, cron log, then `task_reminder_deliveries` status |
| Shared List cannot be opened | Recipient signed in as invited email; invitation accepted; resource access RPC available |
| App works until refresh | Vercel Root Directory / committed SPA rewrite configuration |

Do not solve production incidents by disabling RLS or placing a service-role key in the browser. Preserve the authorization boundary and diagnose the specific missing configuration or migration instead.
