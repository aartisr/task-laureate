# Why `workspace_snapshots` is empty — diagnosis and fix

This guide diagnoses the exact path from creating a list in Task-Laureate to seeing a row in Supabase. Follow the steps in order; each one proves a specific layer works before moving to the next.

## The short answer

Task-Laureate does **not** write anonymously. A list is saved remotely only when all of these are true:

1. The running Vite app has real Supabase URL and publishable-key values.
2. The database migration and authenticated-role grants have been applied to that same Supabase project.
3. The user is signed in from **Settings → Private cloud sync**.
4. Supabase accepts the authenticated user’s JWT under the table’s RLS policies.

If any condition is false, the application preserves the list in browser-local storage and surfaces a cloud-sync status/error instead of risking an unauthorized write. The starter `.env.local` deliberately contains placeholders, so it cannot create a remote row until you replace them.

## Expected behavior

After a successful sign-in, Task-Laureate creates or loads a single row like this:

```text
workspace_id: main_<authenticated-user-uuid>
owner_id:     <authenticated-user-uuid>
version:      1
payload:      { lists: [...], tasks: [...], activity: [...], templates: [...] }
```

The row is **not** named only `main`. The app appends the signed-in user ID to prevent one user’s workspace from colliding with another user’s primary key.

On first sign-in, the current local workspace is uploaded if no remote row exists. Later list/task edits are coalesced for 300 ms and sent as a PostgREST upsert. The browser console records each attempt with a `[Task-Laureate persistence]` prefix.

## Step 1 — configure the exact project the app will use

Edit `apps/web/.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_SUPABASE_WORKSPACE_ID=main
```

Where to find them: in Supabase Dashboard, open the correct project and go to **Project Settings → API**. Copy the Project URL and publishable key (older projects may label the latter `anon`). Do not use a `service_role` or secret key in this file. Publishable keys are safe in a browser only when RLS is enabled; service keys bypass RLS and must never be exposed. [Supabase secure-data guidance](https://supabase.com/docs/guides/database/secure-data)

Fully stop and restart `npm run dev` after changing `.env.local`; Vite reads environment values at startup. Then open **Settings**:

- If it says **“Cloud sync is not configured”**, the values are absent, still placeholders, or Vite has not restarted.
- If it presents **“Private cloud sync”**, the configuration has loaded correctly.

## Step 2 — apply both database migrations

### Install and authenticate the CLI (one-time setup)

Run these from the repository root (the directory containing `package.json`), not from inside `supabase/`:

```bash
cd /Users/rraviku2/aarti/task-laureate
node --version                 # Node 20+ is required for the npm-distributed CLI
npm install --save-dev supabase
npx supabase init              # creates supabase/config.toml if it is absent
npx supabase login
```

`supabase: command not found` means the CLI is not installed globally. A project-local installation is preferred here; use `npx supabase ...` for every command. During `npx supabase login`, the CLI opens a browser login flow or asks for a personal access token. That token is for the CLI’s management access only—do not put it in `.env.local`. [Supabase CLI installation and login](https://supabase.com/docs/guides/local-development/cli/getting-started)

Apply every migration in `supabase/migrations/` to the **same project** as the URL above:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or run both files in the Dashboard SQL Editor, in filename order:

1. `001_workspace_snapshots.sql` — table, RLS policies, index
2. `002_workspace_snapshots_authenticated_grants.sql` — explicit Data API privileges for authenticated users

The second migration matters. RLS policies decide *which rows* a role may access; PostgreSQL grants decide whether that role may access the table at all. The app grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE` only to `authenticated`; RLS still limits access to `owner_id = auth.uid()`. Supabase recommends enabling RLS on exposed tables and granting only needed privileges. [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

Run this read-only verification in SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'workspace_snapshots';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'workspace_snapshots';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'workspace_snapshots'
  and grantee = 'authenticated'
order by privilege_type;
```

You should see one table, four owner policies (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), and all four table privileges for `authenticated`.

## Step 3 — configure and complete authentication

In Supabase Dashboard:

1. Go to **Authentication → Providers → Email** and enable Email/password sign-in.
2. Go to **Authentication → URL Configuration**.
3. Set the Site URL to your deployed app URL when deploying.
4. Add `http://localhost:5173` as a Redirect URL for local development, plus your exact production origin.
5. In the app, open **Settings → Private cloud sync** and create an account or sign in.

For a new account with Confirm Email enabled, click the confirmation email link, return to the app, and sign in. The redirect URL must be on Supabase’s allow list; otherwise the session cannot return to the app. [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls), [password auth guide](https://supabase.com/docs/guides/auth/passwords)

When signed in, Settings shows the account email. If it does not, remote persistence will not start.

### Detailed user sign-in process

The app’s sign-in process is intentionally handled inside the browser; users never copy an access token manually.

#### First user: create an account

1. Start the app with `npm run dev` and open the URL Vite prints (normally `http://localhost:5173`).
2. Open **Settings** in the application navigation.
3. Find **Private cloud sync**.
4. Select **Create an account**.
5. Enter an email address and a password of at least six characters, then select **Create account**.
6. If Supabase **Confirm Email** is enabled (recommended), the app reports that confirmation is required. Open the confirmation email and select its link.
7. The link returns to the application. The app reads the returned session, stores it in browser local storage, and starts the first cloud-sync connection.
8. Return to **Settings**. It should now say `Signed in as <your-email>`. Create a list and wait one second; the initial workspace row should appear.

If the account is created but the user is not signed in immediately, this is expected with Confirm Email enabled. Confirm the email first, then use **Sign in and sync** with the same email and password.

#### Existing user: sign in

1. Open **Settings → Private cloud sync**.
2. Enter the existing email and password.
3. Select **Sign in and sync**.
4. The app sends the credentials to Supabase Auth over HTTPS. It receives a short-lived access token and a rotating refresh token; neither is written to `.env.local`.
5. The app stores the session only in browser local storage under `task-laureate.supabase-auth`, schedules a refresh before the access token expires, and emits an internal auth-change event.
6. The persistence runtime reconnects using the authenticated user’s JWT. It looks for `<workspace-name>_<user-id>`:
   - If no row exists, it uploads the local workspace.
   - If a row exists, it loads that user’s remote workspace as the source of truth.
7. The Settings panel changes to the signed-in email, and the app marks persistence as connected. Every later edit is queued for an upsert.

Supabase Auth uses a JWT access token plus a refresh token for sessions; access tokens are short-lived, which is why the app refreshes them rather than asking users to paste them into configuration. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)

#### Sign out and account switching

1. Select **Sign out** in **Settings → Private cloud sync**.
2. The app removes its browser session and switches future changes to local-only persistence on that device.
3. To use a different account, sign in with the other account from the same panel. The app derives a different workspace ID from that account’s user ID and loads that account’s remote snapshot.

Do not share a browser profile between users who should not see the same local fallback data. For shared machines, use separate browser profiles or clear browser site data after signing out.

### Required Supabase dashboard settings for sign-in

Before testing sign-in, verify all of these values in the Supabase Dashboard:

| Dashboard location | Required setting | Why it matters |
| --- | --- | --- |
| **Authentication → Providers → Email** | Email provider enabled; password sign-in enabled | Allows the app’s email/password form to create and sign in users. |
| **Authentication → Providers → Email** | Confirm Email enabled for production | Prevents unverified email accounts from immediately creating cloud workspaces. |
| **Authentication → URL Configuration** | `http://localhost:5173` in Redirect URLs | Lets a local confirmation link return to Vite. |
| **Authentication → URL Configuration** | Exact deployed origin in Redirect URLs and Site URL | Lets production confirmation links return safely. |
| **Authentication → General Configuration** | New-user signups allowed, if users should self-register | Otherwise create users through your approved admin/onboarding flow. |

For production email delivery, configure custom SMTP. Supabase’s default email service is suitable for limited testing and has delivery/rate limitations. [Supabase password-auth and email guidance](https://supabase.com/docs/guides/auth/passwords)

## Step 4 — prove the remote write from the app

1. Open the browser DevTools console and keep it visible.
2. Sign in from Settings.
3. Create a list, then wait one second.
4. Look for these messages:

```text
[Task-Laureate persistence] Supabase request { operation: 'GET', ... }
[Task-Laureate persistence] Supabase request { operation: 'POST', ... }
[Task-Laureate persistence] Supabase request succeeded { status: 201 or 200, ... }
```

Then run in the Supabase SQL Editor:

```sql
select workspace_id, owner_id, version, created_at, updated_at,
       jsonb_array_length(payload->'lists') as list_count
from public.workspace_snapshots
order by updated_at desc;
```

The row should appear immediately after the successful `POST`. The new list lives in `payload.lists`, not in a separate `lists` table.

## Step 5 — interpret the failure precisely

| Browser message or network response | Meaning | Fix |
| --- | --- | --- |
| `Cloud sync is not configured` | Vite did not receive valid URL/key values | Fix `.env.local`, restart Vite. |
| `No authenticated Supabase session` | No signed-in user | Sign in from Settings and confirm the email if required. |
| HTTP 401 | Invalid, expired, or missing JWT | Sign out/in; verify the Email provider and callback URL. |
| HTTP 403 / `permission denied` | Missing grants or RLS rejected the request | Apply `002`, then confirm policies and signed-in identity. |
| HTTP 404 / relation not found | Migration was not applied to this project | Apply `001` and verify the project URL. |
| HTTP 409 | A conflicting manually-created workspace ID is present | Do not manually create rows using the derived `<name>_<user-id>` key; inspect the existing row and owner. |
| Visible “Supabase save failed; retrying” alert | A remote write failed after startup | Read the adjacent console error; local data is retained and retried. |

## Step 6 — run an end-to-end readiness test

The repository includes a live test that checks the configuration, table shape, authentication path, RLS, and CRUD. It creates and deletes only its own unique test row.

While signed in locally, obtain the current **access token** from browser DevTools only for this one terminal command:

```js
JSON.parse(localStorage.getItem('task-laureate.supabase-auth')).access_token
```

Then run:

```bash
SUPABASE_TEST_ACCESS_TOKEN='paste-token-here' npm run test:supabase -w apps/web
```

Do not save that token in `.env.local`, commit it, or expose it through a `VITE_` variable. Use a dedicated test account when possible. A passing test proves Supabase can accept an authenticated client write; a failure includes the HTTP status and response detail needed to resolve it.

## If the table is still empty

Capture these three facts before changing code:

1. The full `[Task-Laureate persistence]` console error (without keys or tokens).
2. The HTTP request and response for `/rest/v1/workspace_snapshots` in DevTools Network.
3. The output of the Step 2 SQL verification queries.

Those facts identify whether the problem is configuration, authentication, migration/grants, RLS, or network—not list creation. The app’s mutation path is generic: every repository mutation exports the latest workspace and routes it through the same buffered persistence adapter.
