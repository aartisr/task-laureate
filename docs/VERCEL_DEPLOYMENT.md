# Vercel deployment guide

This guide deploys Task-Laureate as a static Vite single-page application (SPA) on Vercel. It is deliberately provider-neutral: substitute your own Git provider, domain, Supabase project, and approved package registry. No secret belongs in the repository.

## What is deployed

The repository is an npm-workspaces monorepo. The Vercel project is rooted at the repository root:

| Setting | Value |
| --- | --- |
| Root Directory | `.` (repository root) |
| Framework Preset | Vite (or auto-detected Vite) |
| Install Command | `npm ci --include=optional` |
| Build Command | `npm run build` |
| Output Directory | `apps/web/dist` |
| Node.js | 20.19+ |

These settings are committed in [`vercel.json`](../vercel.json). The build runs the web-workspace typecheck and Vite production build. The output directory is Vite's generated static site; it contains no server-side secrets.

`vercel.json` also preserves direct navigation to client routes such as `/settings` and `/lists/<id>`. Requests for actual files keep their normal behavior; application routes are rewritten to `index.html` and TanStack Router renders the route in the browser.

## Before creating the Vercel project

1. Push the repository to the Git provider Vercel will use.
2. Confirm a clean production build locally:

   ```bash
   npm ci --include=optional
   npm run lint
   npm run build
   ```

3. Apply the Supabase migrations in [`supabase/migrations`](../supabase/migrations) to the Supabase project for each environment. The app cannot create its own database schema.
4. Decide how environments are isolated. The strongest default is a separate Supabase project for Production and Preview. If one Supabase project is intentionally shared, set a distinct `VITE_SUPABASE_WORKSPACE_ID` such as `preview` in Preview so preview data does not mingle with production data for the same user.

## Create and configure the Vercel project

1. In Vercel, select **Add New → Project**, import the repository, and leave **Root Directory** set to the repository root.
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
| `NPM_TOKEN` | Only for a private registry | No | Read-only package-registry token used during the install step |

Do not add `VITE_SUPABASE_ACCESS_TOKEN`. This app signs the user in in the browser, stores the user session locally, and refreshes it. Do not add a Supabase service-role key, database password, private npm token, or any other secret with a `VITE_` prefix.

After editing an environment variable, redeploy. Vite embeds `VITE_*` values during the build; changing the Vercel variable alone cannot alter an already-created deployment.

### Private or corporate npm registry

Vercel build machines do not inherit a developer's local npm credentials. If your organization requires a private registry, use an organization-approved, read-only automation token and make the registry configuration available to the build. Never commit the token.

One portable pattern is a committed `.npmrc` containing only the registry endpoint and an environment-variable reference:

```ini
registry=https://registry.example.corp/artifactory/api/npm/company-virtual/
always-auth=true
//registry.example.corp/artifactory/api/npm/company-virtual/:_authToken=${NPM_TOKEN}
```

Set `NPM_TOKEN` as an encrypted Vercel variable for the environment(s) that build. For scoped registries, use the scope-specific `@scope:registry=...` form instead. Validate this arrangement with a Preview deploy before changing the production registry. If your repository must remain installable from the public registry, keep its existing `.npmrc` and configure registry authentication through your organization’s Vercel integration or build environment instead.

## Configure Supabase authentication for Vercel URLs

The Supabase client uses email/password authentication from **Settings → Private cloud sync**. Authentication works only if Supabase allows the URLs that receive confirmation and recovery links.

In **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the canonical production URL, preferably the final custom domain, for example `https://tasks.example.com`.
2. Add the exact production URL to **Redirect URLs**.
3. Add local development: `http://localhost:5173`.
4. For Vercel previews, add the team-scoped wildcard recommended by Supabase, replacing the placeholder with the actual Vercel team or account slug:

   ```text
   https://*-<team-or-account-slug>.vercel.app/**
   ```

5. If using a custom preview domain, add its narrowest valid pattern as well.

Keep the production Site URL exact. Wildcards are appropriate only where necessary for preview URLs. Once the custom production domain is live, ensure it is present in both the Vercel project and Supabase Redirect URLs before enabling email confirmation.

For database schema, row-level security, and the authenticated CRUD verification test, follow [Supabase persistence](SUPABASE_PERSISTENCE.md) and [the empty-table diagnostic](SUPABASE_EMPTY_TABLE_DIAGNOSIS.md).

## Release checklist

Before promoting a deployment, verify:

- [ ] The Vercel deployment build completed using Node 20.19+.
- [ ] Production and Preview each have the intended Supabase URL, publishable key, and workspace ID.
- [ ] All Supabase migrations have been applied to every selected Supabase project.
- [ ] Supabase Site URL and Redirect URLs include the final production URL, local URL, and the correctly scoped preview wildcard.
- [ ] A new user can sign up or sign in at **Settings → Private cloud sync**.
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
| Vercel build cannot install packages | Registry needs credentials or uses a different endpoint | Configure a read-only `NPM_TOKEN` and your approved registry configuration; retry a Preview build. |
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
