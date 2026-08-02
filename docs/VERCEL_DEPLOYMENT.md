# Vercel deployment guide

This guide deploys Task-Laureate as a Vite single-page application (SPA) plus one server-only notification cron endpoint on Vercel. It is deliberately provider-neutral: substitute your own Git provider, domain, and Supabase project. No secret belongs in the repository.

## What is deployed

The repository is an npm-workspaces monorepo. The recommended Vercel project root is `apps/web`:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Vite (or auto-detected Vite) |
| Install Command | `cd ../.. && npm ci --include=optional` |
| Build Command | `npm run verify:public-registry && npm run build` |
| Output Directory | `dist` |
| Node.js | 20.19+ |

These settings are committed in [`apps/web/vercel.json`](../apps/web/vercel.json). The build runs the web-workspace typecheck and Vite production build. The published static output contains no server-side secrets. The same root-level configuration and a thin API entry point are retained for teams that intentionally use `.` as the Vercel root; choose one root directory and do not override the committed build settings in the dashboard.

`vercel.json` also preserves direct navigation to client routes such as `/settings` and `/lists/<id>`. Requests for actual files keep their normal behavior; application routes are rewritten to `index.html` and TanStack Router renders the route in the browser.

## Before creating the Vercel project

1. Push the repository to the Git provider Vercel will use.
2. Confirm a clean production build locally:

   ```bash
   npm install --include=optional
   npm run lint
   npm run build
   ```

3. Apply the Supabase migrations in [`supabase/migrations`](../supabase/migrations) to the Supabase project for each environment. The app cannot create its own database schema.
4. Decide how environments are isolated. The strongest default is a separate Supabase project for Production and Preview. If one Supabase project is intentionally shared, set a distinct `VITE_SUPABASE_WORKSPACE_ID` such as `preview` in Preview so preview data does not mingle with production data for the same user.

## Create and configure the Vercel project

1. In Vercel, select **Add New → Project**, import the repository, and set **Root Directory** to `apps/web`.
2. Verify the build settings match the table above. The committed configuration is the source of truth; avoid adding a conflicting output directory in the dashboard.
3. Set the Production Branch to the branch that is allowed to release, commonly `main`.
4. Deploy once to obtain the assigned `*.vercel.app` URL. Add a custom domain afterward if one will be used.

Vercel creates immutable Preview deployments for non-production Git changes. Treat Preview as a real environment: it must have valid configuration and must not receive production-only credentials.

## Environment variables

Add these values in **Project Settings → Environment Variables**. Configure each target explicitly: Production, Preview, and Development (the latter is used by `vercel env pull`). Values with a `VITE_` prefix are compiled into browser JavaScript at build time, so they must be client-safe.

| Variable | Required | Browser-safe | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes for cloud sync | Yes | Supabase project URL, for example `https://project-ref.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes for cloud sync | Yes | Supabase publishable key (or legacy anon key) |
| `VITE_SUPABASE_WORKSPACE_ID` | Recommended | Yes | Logical workspace namespace, e.g. `production` or `preview`; the app otherwise uses `default` |
| `VITE_AUTH_PROVIDERS` | Optional | Yes | Comma-separated, already-enabled Supabase OAuth/OIDC identifiers, e.g. `google,azure,github,custom:yahoo` |
| `SUPABASE_URL` | Required for daily in-app notifications | No | Server-only Supabase project URL used by the cron |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for daily in-app notifications | No | Server-only Supabase service-role key used by the cron |
| `CRON_SECRET` | Required for daily in-app notifications | No | Long random server-only value that authenticates Vercel Cron |
| `VITE_VAPID_PUBLIC_KEY` | Optional for browser push | Yes | Browser-safe half of a stable VAPID key pair |
| `VAPID_PUBLIC_KEY` | Required when browser push is enabled | No | Same VAPID public key for the server-side signature |
| `VAPID_PRIVATE_KEY` | Required when browser push is enabled | No | Server-only VAPID private key |
| `VAPID_SUBJECT` | Required when browser push is enabled | No | Contact URI such as `mailto:you@example.com` |

Do not add `VITE_SUPABASE_ACCESS_TOKEN`. This app signs the user in in the browser, stores the user session locally, and refreshes it. Do not add a Supabase service-role key, database password, private npm token, or any other secret with a `VITE_` prefix. Set the three server-only notification values only in Vercel—never in `.env.local` or source control.

After editing an environment variable, redeploy. Vite embeds `VITE_*` values during the build; changing the Vercel variable alone cannot alter an already-created deployment.

### Public npm registry

This project is configured to install entirely from the public npm registry. No package-registry credentials or package-registry secrets are required in Vercel.

The Vercel install command uses `npm install --include=optional` so npm installs the Linux-specific Rollup package required by Vite's production build. The committed lockfile resolves those packages from `registry.npmjs.org`.

## Configure Supabase authentication for Vercel URLs

The Supabase client supports email/password and existing-account OAuth/OIDC sign-in from **Settings → Private cloud sync**. Authentication works only if Supabase allows the app callback URL and each provider is configured in Supabase.

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the canonical production URL, preferably the final custom domain, for example `https://tasks.example.com`.
2. Add the exact production callback URL to **Redirect URLs**: `https://tasks.example.com/auth/callback`.
3. Add local development callback: `http://localhost:5173/auth/callback`.
4. For Vercel previews, add the team-scoped wildcard recommended by Supabase, replacing the placeholder with the actual Vercel team or account slug:

   ```text
   https://*-<team-or-account-slug>.vercel.app/**
   ```

5. If using a custom preview domain, add its narrowest valid pattern as well.

For every enabled social provider, register the exact Supabase callback URL displayed under **Authentication → Providers** in the provider’s developer console. Provider client secrets remain in Supabase; `VITE_AUTH_PROVIDERS` merely decides which configured buttons are visible. See the [OIDC implementation plan](OIDC_SOCIAL_SIGN_IN_IMPLEMENTATION_PLAN.md) for the provider runbook.

Keep the production Site URL exact. Wildcards are appropriate only where necessary for preview URLs. Once the custom production domain is live, ensure it is present in both the Vercel project and Supabase Redirect URLs before enabling email confirmation.

For database schema, row-level security, and the authenticated CRUD verification test, follow [Supabase persistence](SUPABASE_PERSISTENCE.md) and [the empty-table diagnostic](SUPABASE_EMPTY_TABLE_DIAGNOSIS.md).

## Release checklist

Before promoting a deployment, verify:

- [ ] The Vercel deployment build completed using Node 20.19+.
- [ ] Production and Preview each have the intended Supabase URL, publishable key, and workspace ID.
- [ ] All Supabase migrations have been applied to every selected Supabase project.
- [ ] Supabase Site URL and Redirect URLs include the final production callback URL, local callback URL, and the correctly scoped preview wildcard.
- [ ] Each visible OAuth/OIDC provider is enabled in Supabase and has its exact Supabase callback registered with the provider.
- [ ] A new user can continue with an existing account (or email fallback) at **Settings → Private cloud sync**.
- [ ] If in-app notifications are enabled, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a 32-byte-or-longer `CRON_SECRET` are set only for Production, and the notification migrations have been applied.
- [ ] If browser push is enabled, one stable VAPID key pair is configured: only `VITE_VAPID_PUBLIC_KEY` is browser-safe; `VAPID_PRIVATE_KEY` remains server-only. Follow [the Hobby notification guide](VERCEL_HOBBY_NOTIFICATIONS.md#enable-free-browser-push).
- [ ] Create a list, refresh the page, and confirm it reloads. Verify the `workspace_snapshots` row is visible in the intended Supabase project.
- [ ] Open a deep link such as `/settings` in a new browser tab; it renders instead of returning a 404.
- [ ] Run the opt-in authenticated CRUD test against a non-production test user before a major release.

```bash
SUPABASE_TEST_ACCESS_TOKEN='user-jwt' npm run test:supabase -w apps/web
```

The test user must be an `authenticated` user and the token must never be a service-role key.

## Common deployment failures

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| Vercel build cannot install packages | Dependency cache is stale or an npm install was interrupted | Redeploy with **Use existing Build Cache** disabled; the public-registry install will restore the required optional packages. |
| Build passes but cloud sync is unavailable | One or both `VITE_SUPABASE_*` values were absent when built | Add variables to the correct Vercel target and redeploy. |
| Sign-up confirmation opens an error page | Supabase does not allow the deployed origin | Add the exact production URL or the constrained Vercel preview wildcard to Redirect URLs. |
| `/settings` returns 404 on refresh | SPA fallback is overridden | Keep the `vercel.json` rewrite and remove conflicting dashboard rewrites. |
| Supabase table remains empty | User is not signed in, migrations/RLS grants are absent, or app is using a different project/environment | Use [the diagnostic guide](SUPABASE_EMPTY_TABLE_DIAGNOSIS.md) from its first step and inspect the browser console's cloud-sync logs. |
| Preview sees production data | Preview is configured with production Supabase and workspace | Use a separate Preview Supabase project, or a separate Preview workspace ID. |

## Operational notes

- Vercel Preview deployments are useful for validating routing, authentication redirects, and environment isolation before production.
- Vercel’s static hosting already serves Vite’s hashed asset files efficiently. The committed cache header for `/assets/*` is long-lived and safe because Vite changes asset file names when their contents change.
- Environment configuration is not source control. Keep a small, access-controlled inventory of which Vercel environment maps to which Supabase project and registry credential.
- A Vercel deployment only hosts the frontend. Run database migrations through your approved Supabase workflow before relying on a newly deployed frontend feature.

## Authoritative references

- [Vercel: Vite deployments](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel: project configuration (`vercel.json`)](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel: environment variables](https://vercel.com/docs/environment-variables)
- [Vite: environment variables and modes](https://vite.dev/guide/env-and-mode)
- [Supabase: redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
