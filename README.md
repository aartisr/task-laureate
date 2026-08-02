# Task-Laureate

Task-Laureate is a private, keyboard-friendly task workspace for planning lists, tracking progress, searching work, reviewing activity, and recovering from mistakes with undo. It is built as an extensible React application: feature modules and persistence adapters can evolve without rewriting the UI shell.

Built by [Aarti S Ravikumar](https://ai-aarti.com), a student at [Pioneer Charter School of Science II (PCSSII)](https://saugus.pioneercss.org).

## Why Task-Laureate exists

Task-Laureate began with a familiar kind of overwhelm: important work scattered across calendars, notes, email, sticky notes, and apps that promised to sync but did not always earn trust. Research, competitions, projects, and schoolwork were all moving at once. The hard part was not caring enough or working hard enough. The hard part was spending attention trying to remember what mattered.

That experience shaped a simple conviction: a task manager should reduce mental overhead, not become another place to manage. It should make the next step visible, make progress honest, and make mistakes recoverable. It should respect a person’s privacy and never pretend a change is safely saved when it is not.

Task-Laureate is an attempt to build that kind of tool: calm enough for a student with an assignment due tomorrow, reliable enough for someone coordinating ambitious work, and open enough for the people who use it to help improve it.

### A promise to the person using it

Your work deserves clarity. Your data deserves an accurate status. Your attention is valuable.

So the application is designed around a few non-negotiables:

- **Useful before demanding commitment.** You can explore the workspace before sign-in. When a List or Task needs to be saved, the app explains why sign-in helps, preserves the complete draft, and returns you to it after authentication.
- **Private by default.** Signed-in workspaces are scoped to the authenticated account. Local offline copies are account-scoped and cleared on sign-out.
- **Honest about durability.** The interface distinguishes local, saving, synced, and error states instead of claiming that a cloud save succeeded when it did not.
- **Forgiving of human mistakes.** List and task changes have an undo journal, and destructive actions are deliberate.
- **Open to scrutiny and contribution.** The implementation, migration scripts, tests, and deployment contract live in this repository because trust should be inspectable.

This is not a promise that software can eliminate every deadline or every difficult day. It is a promise to make the work in front of you easier to see, safer to organize, and less likely to be lost in the noise.

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
git clone https://github.com/aartisr/task-laureate.git
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

Task-Laureate is better when the people who rely on it can shape it. Bug reports, accessibility observations, documentation improvements, and focused pull requests are all welcome.

Before opening a pull request, run the release-quality checks:

```bash
npm run verify:production
npm run lint
npm test
npm run build
```

Use the project’s [GitHub issue flow](https://github.com/aartisr/task-laureate/issues/new) to report a bug or share an idea. Keep credentials and tokens in ignored local environment files; never commit them.

## A note from Aarti

I built Task-Laureate because I know how it feels to have meaningful work and still feel lost in the details. If this project gives someone a little more confidence, a little less friction, or one fewer anxious “what did I forget?” moment, then it is doing the work it was meant to do.

If you use it, question it, improve it, or build something new with it: thank you. Good tools are not monuments. They are conversations between the people who make them and the people whose lives they are meant to support.

## License

MIT
