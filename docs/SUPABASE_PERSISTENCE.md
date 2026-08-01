# Supabase persistence

Task-Laureate stores one versioned JSONB workspace snapshot per authenticated user. A workspace mutation updates the in-memory repository immediately, writes a local browser mirror, then coalesces and upserts the newest remote snapshot. This keeps the domain model portable while making remote persistence atomic and low-chatter.

## What is stored

The [`workspace_snapshots`](../supabase/migrations/001_workspace_snapshots.sql) table contains:

| Column | Purpose |
| --- | --- |
| `workspace_id` | Stable per-user workspace name: `<configured-name>_<auth-user-id>` |
| `owner_id` | Authenticated Supabase user who owns the row |
| `version` | Workspace export-format version (`1`) |
| `payload` | JSONB lists, tasks, activity, and templates |
| `created_at`, `updated_at` | Audit timestamps |

Row-level security permits only the owner to read, create, update, or delete their own snapshot. The per-user workspace ID is important: the database primary key is global, so a shared value such as `main` alone would collide across accounts.

## Setup

### 1. Apply the migration

Apply all files in [`supabase/migrations/`](../supabase/migrations/) using the Supabase SQL Editor or CLI:

```bash
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Run these commands from the repository root. The npm-distributed CLI requires Node.js 20 or later; use `npx supabase` because this is a project-local installation. Full troubleshooting steps are in [Why `workspace_snapshots` is empty](SUPABASE_EMPTY_TABLE_DIAGNOSIS.md).

The migrations create the table, enable RLS, add owner-only policies and the owner/update-time index, then grant the minimum Data API permissions to the `authenticated` role. For a full verification workflow, see [Why `workspace_snapshots` is empty](SUPABASE_EMPTY_TABLE_DIAGNOSIS.md).

### 2. Configure client-safe environment values

Create `apps/web/.env.local` (it is Git-ignored):

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_WORKSPACE_ID=main
```

Restart Vite after changing environment variables.

These are the only Supabase values the browser needs. Do **not** set `VITE_SUPABASE_ACCESS_TOKEN`, and never put a service-role key, database password, or refresh token in a `VITE_` variable. A publishable/anon key is intended for browser use; RLS and the authenticated user JWT enforce data access.

### 3. Configure Supabase Auth

Task-Laureate includes an email/password auth panel at **Settings → Private cloud sync**. It obtains the session at sign-in, keeps it in browser storage, refreshes the access token before expiry, and clears it on sign-out.

In **Supabase Dashboard**:

1. Enable the **Email** provider under **Authentication → Providers**.
2. Under **Authentication → URL Configuration**, set the Site URL and add every callback origin to the redirect allow list. For local development, add `http://localhost:5173`; add your exact production origin before deploying.
3. Keep email confirmation enabled for production. A new user receives a confirmation link and is returned to the allowed application URL.

Supabase sessions are short-lived by design; the app refreshes them instead of requiring a copied JWT. See the official [Supabase Auth sessions guide](https://supabase.com/docs/guides/auth/sessions) and [email/password sign-up guide](https://supabase.com/docs/reference/javascript/auth-signup).

## Architecture and extension points

The integration is deliberately adapter-based:

```text
CloudSyncAuthPanel (provider-neutral UI)
        │
PasswordAuthProvider contract
        │
supabaseAuthProvider (Supabase implementation) ──► Supabase Auth REST API
        │
persistence.config.ts (composition root)
        │
WorkspacePersistenceAdapter contract
        │
createSupabaseWorkspaceAdapter ───────────────────► Supabase Data API
```

- [`core/contracts/auth.ts`](../apps/web/src/core/contracts/auth.ts) defines the auth boundary.
- [`config/persistence.config.ts`](../apps/web/src/config/persistence.config.ts) selects the concrete auth provider and persistence driver.
- [`infrastructure/persistence/supabaseAuth.ts`](../apps/web/src/infrastructure/persistence/supabaseAuth.ts) is the Supabase auth adapter.
- [`infrastructure/persistence/supabase.ts`](../apps/web/src/infrastructure/persistence/supabase.ts) is the Supabase workspace adapter.

To use another identity system, implement `PasswordAuthProvider` and replace `authProvider` in the composition root. To use another data store, implement `WorkspacePersistenceAdapter`; no component or domain mutation needs to change.

## Sync behavior and observability

- Remote writes are debounced (300 ms by default), ordered, and retried with exponential backoff.
- If all immediate retries fail, the newest unsaved snapshot stays in memory and is retried automatically every five seconds.
- The app always keeps a local browser mirror. If Supabase cannot start, it continues locally and shows a visible alert explaining that cloud sync is unavailable.
- Browser console logs use the `[Task-Laureate persistence]` and `[Task-Laureate auth]` prefixes. They record operation type, workspace identifier, response status, and safe error details—never keys or tokens.
- On a first successful sign-in with no remote row, the current local workspace is uploaded. An existing remote workspace remains the source of truth.

## Troubleshooting

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| “Cloud sync is not configured” | Missing or placeholder environment variables | Set URL and publishable key in `apps/web/.env.local`, then restart Vite. |
| “Sign in from Settings” | No authenticated browser session | Create an account or sign in from Settings. |
| “Supabase is not connected” | Migration, RLS, URL, key, or network issue | Open the browser console, inspect the prefixed persistence error, and run the readiness test below. |
| Confirmation link does not return to the app | Callback URL is not allowed | Add the exact local/production origin under Auth URL Configuration. |
| A list remains local | Token expired or remote request was rejected | The app retries automatically; sign in again if prompted and inspect the persistence alert. |

## Live readiness test

The opt-in integration test validates real configuration, reaches the Data API, verifies all required columns, and performs authenticated create/read/update/delete against a unique temporary row. It always cleans up its own row.

Run it only with a dedicated, authenticated, non-service-role test user:

```bash
SUPABASE_TEST_ACCESS_TOKEN='eyJ...' npm run test:supabase -w apps/web
```

The test token is intentionally supplied only for that process; never place it in `.env.local` or expose it as a `VITE_` variable. The test fails clearly if the URL/key placeholders remain, RLS rejects the request, the migration is absent, or a required table property is unavailable.

## Security checklist

- [ ] `.env.local` is ignored and contains only the URL, publishable key, and workspace name.
- [ ] No service-role key is included in client code, a Vite variable, browser storage, logs, or test output.
- [ ] RLS is enabled and the migration’s owner-only policies are present.
- [ ] Email confirmation and redirect URLs are configured for every deployment environment.
- [ ] The live readiness test uses a dedicated non-production test user.

For project configuration and API details, see the official [Supabase JavaScript documentation](https://supabase.com/docs/reference/javascript/introduction).
