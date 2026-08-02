# Task-Laureate

Task-Laureate is a fast, keyboard-friendly task workspace for planning lists, tracking progress, searching work, reviewing activity, and recovering from mistakes with undo. It is built as an extensible React application: feature modules and persistence adapters can evolve without rewriting the UI shell.

## Highlights

- Lists, tasks, priorities, due dates, progress, search, and activity history
- Undo journal for task and list mutations
- Theme system and responsive, accessible UI primitives
- Versioned workspace export/import format
- Local browser persistence and an optional Supabase workspace adapter
- Buffered remote writes, retries, and an account-scoped offline cache

## Tech stack

- React 18 and TypeScript
- Vite
- TanStack Router and TanStack Query
- Vitest
- Supabase PostgREST Data API (optional persistence backend)

## Quick start

Requirements: Node.js 20.19 or later.

```bash
git clone https://github.com/aartisravikumar/task-laureate.git
cd task-laureate
npm install
npm run dev
```

Open the local URL printed by Vite (normally <http://localhost:5173>). Run `npm run build`, `npm run lint`, or `npm run test` from the repository root for the corresponding web-app command.

## Persistence

The app keeps a portable, versioned workspace snapshot. The persistence switchboard is [`apps/web/src/config/persistence.config.ts`](apps/web/src/config/persistence.config.ts). With the Supabase driver, every workspace is private to an authenticated account. Its offline cache is keyed to that account, never read while signed out, and cleared on sign-out.

### Supabase setup

Follow the complete [Supabase persistence guide](docs/SUPABASE_PERSISTENCE.md). In short:

1. Apply [`supabase/migrations/001_workspace_snapshots.sql`](supabase/migrations/001_workspace_snapshots.sql) to create the `workspace_snapshots` table, RLS policies, and index.
2. Put client-safe values in `apps/web/.env.local` (this file is Git-ignored):

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   VITE_SUPABASE_WORKSPACE_ID=main
   # Optional public display registry; enable only providers already configured in Supabase.
   VITE_AUTH_PROVIDERS=google,azure,github,custom:yahoo
   ```

3. Configure the matching Supabase Auth providers, then start the app and open **Settings → Private cloud sync** to continue with an existing account. The app manages the browser session and token refresh itself; do not create `VITE_SUPABASE_ACCESS_TOKEN`.
4. In **Supabase Dashboard → Authentication → URL Configuration**, allow your local Vite URL (normally `http://localhost:5173`) and your production URL for email-confirmation redirects.

Use only a Supabase publishable/anon key in the browser—never a service-role key. For Supabase project and authentication guidance, see the [Supabase JavaScript documentation](https://supabase.com/docs/reference/javascript/introduction).

### Verify a live Supabase project

An opt-in integration test validates the actual configuration and Data API, confirms the expected table columns, then performs authenticated create/read/update/delete against a unique row and removes it afterwards.

```bash
SUPABASE_TEST_ACCESS_TOKEN='eyJ...' npm run test:supabase -w apps/web
```

The test token must be for a dedicated authenticated user and must not be a service-role token. See the [live readiness-test instructions](docs/SUPABASE_PERSISTENCE.md#live-readiness-test) for details.

## Project layout

```text
apps/web/                 Vite web application
  src/app/                Runtime services, routing, providers
  src/core/               Domain contracts, mutations, themes, registries
  src/features/           Feature modules
  src/infrastructure/     Persistence and repository implementations
packages/db/              Reusable database abstractions
supabase/migrations/      Supabase schema and row-level security migration
docs/                     Architecture, feature, QA, and setup documentation
```

## Documentation

- [Supabase persistence and readiness test](docs/SUPABASE_PERSISTENCE.md)
- [OIDC and social sign-in implementation plan](docs/OIDC_SOCIAL_SIGN_IN_IMPLEMENTATION_PLAN.md)
- [Step-by-step login configuration](docs/CONFIGURING_LOGIN.md)
- [Vercel deployment and configuration](docs/VERCEL_DEPLOYMENT.md)
- [Free Vercel Hobby in-app and browser notifications](docs/VERCEL_HOBBY_NOTIFICATIONS.md)
- [Discoverability and sustainable growth](docs/DISCOVERABILITY_AND_GROWTH.md)
- [Architecture guide](docs/ARCHITECTURE_GUIDE.md)
- [Feature guide](docs/QUICK_FEATURE_GUIDE.md)
- [Documentation index](docs/INDEX.md)

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run the relevant typecheck and tests for the code you changed. Keep credentials and tokens in ignored local environment files; never commit them.

## License

MIT
