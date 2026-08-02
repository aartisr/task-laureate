# Vercel Hobby in-app notifications

Task-Laureate provides durable, private **in-app** reminders without a paid notification provider. A daily Vercel Cron Job reads each signed-in person's Supabase workspace and writes notices into a row-level-security-protected inbox. The app then reads only that person's inbox.

This design is intentionally honest about what it delivers:

- Due-soon notices for active tasks due today or tomorrow.
- An opt-in weekly digest on Sunday.
- Notices visible in **Settings → Your inbox**.

It does **not** send email, SMS, browser push, task-assignment, or task-completion notifications. Those require additional delivery infrastructure or data that this application does not have. Turning off a preference stops future notices; it does not delete existing inbox history.

## Why this fits Hobby

The `apps/web/vercel.json` cron schedule runs once per day at `13:00 UTC`. Vercel Hobby permits daily cron schedules; it does not guarantee an exact minute, so the job can run within that UTC hour. The code is idempotent: the same due reminder or weekly digest cannot be inserted twice for the same owner, even if Vercel invokes the job again.

The job uses UTC because task due dates are stored as date-only values. The Settings screen states that boundary explicitly, avoiding false promises about a person's local time zone.

## One-time Supabase setup

Apply the migration before deploying the feature. It creates:

- `notification_preferences` — one preference row per authenticated owner.
- `notification_events` — the private, durable inbox.
- row-level security policies that let a signed-in person read/update only their own rows.

With the Supabase CLI linked to the intended project:

```bash
supabase db push
```

Or run [`003_notification_inbox.sql`](../supabase/migrations/003_notification_inbox.sql) in the Supabase SQL Editor. Use the same environment-specific migration workflow as the existing `workspace_snapshots` migration.

## Vercel configuration

Configure the Vercel project with **Root Directory** set to `apps/web`. The committed `apps/web/vercel.json` is the source of truth for the build, SPA rewrite, and cron schedule.

In **Project Settings → Environment Variables**, set these values for **Production** only:

| Variable | Value | Exposure |
| --- | --- | --- |
| `SUPABASE_URL` | The project URL, e.g. `https://example.supabase.co` | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key for that same project | Server only; secret |
| `CRON_SECRET` | A long random value (at least 32 random bytes) | Server only; secret |

Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` out of `.env.local`, browser code, git, and every `VITE_*` variable. The serverless function is the only process that may use the service-role key; it bypasses RLS solely to create notifications for all owners.

The existing browser-safe variables remain necessary for cloud sync and sign-in:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser connection to Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser publishable/anon key |

Use separate Supabase projects and separate secrets for Preview and Production where possible. Do not configure the cron secrets in Preview unless preview notifications are intentionally required.

Generate a secret locally without recording it in the repository:

```bash
openssl rand -base64 48
```

After adding the variables, redeploy Production. Vercel adds `Authorization: Bearer <CRON_SECRET>` when it calls the configured cron path. The route rejects every request without that exact secret.

## Verification

1. Sign in, create an active task due today or tomorrow, and ensure it appears in `workspace_snapshots`.
2. Enable **Due soon** in Settings.
3. After the next scheduled run, open **Settings → Your inbox**. The notice should appear once.
4. Mark it read, refresh, and verify the read state persists.
5. Enable **Weekly digest** and check on a Sunday UTC run.
6. In Supabase Table Editor, verify `notification_events.owner_id` belongs to the signed-in user and that no user can read another user's events.

For a controlled manual check, invoke the production route from a secure terminal; never paste the secret into source, logs, or a browser URL:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/cron/notifications
```

Expected response includes `scannedAt` and `createdOrRetained`. A `401` means the cron secret is missing or wrong. A `500` means the server-only Supabase values are absent, incorrect, or the migration was not applied; inspect the Vercel Function logs for the sanitized error message.

## Operations and limits

- This is an in-app inbox, not a real-time delivery system. A failed daily run can be retried manually and the next day’s run remains safe because inserts are deduplicated.
- A task that remains due today/tomorrow creates at most one reminder for that due date. Changing its due date creates a new relevant reminder.
- The inbox keeps the latest 12 notices in the UI, while Supabase retains history until an explicit retention policy is added.
- Adding browser push later can use the same `notification_events` table as the source of truth, but needs a service worker, VAPID keys, permission UX, and a delivery worker. It should not be presented as enabled until those components exist.

## References

- [Vercel Cron Jobs: usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron Jobs: configuration and management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
