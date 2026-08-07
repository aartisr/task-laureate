# Task-Laureate

[**Open Task-Laureate →**](https://tasks.ai-aarti.com) · [**Try the interactive sample →**](https://tasks.ai-aarti.com/sample) · [AI Aarti deployment](https://tasks.ai-aarti.com) · [PCSSII Robotics deployment](https://tasks.pcssiirobotics.org)

Task-Laureate is a private, keyboard-friendly task workspace for planning lists, tracking progress, searching work, reviewing activity, and recovering from mistakes with undo. It is built as an extensible React application: feature modules and persistence adapters can evolve without rewriting the UI shell.

Built by [Aarti S Ravikumar](https://ai-aarti.com), a student at [Pioneer Charter School of Science II (PCSSII)](https://saugus.pioneercss.org).

## Live deployments

Task-Laureate is live at two public addresses:

- [tasks.ai-aarti.com](https://tasks.ai-aarti.com) — AI Aarti deployment
- [tasks.pcssiirobotics.org](https://tasks.pcssiirobotics.org) — PCSSII Robotics deployment

Both links should serve the same Task-Laureate experience. If you are configuring a new deployment, follow the [production operations runbook](docs/OPERATIONS.md) and add the exact deployed origin to Supabase Auth redirect URLs.

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
- Normalized Supabase collaboration with owner/editor/viewer access control
- One-time invitation links, shared-work discovery, and RLS enforcement
- Assignment-aware in-app, email, and opt-in SMS reminders
- Bounded keyset reads and virtualized task rendering for large workspaces

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

## Production architecture

The current Supabase implementation stores Lists, Tasks, sharing relationships, and reminders in normalized tables. Browser requests use the signed-in user’s JWT and are authorized by Postgres row-level security. Server-only Vercel functions handle invitation email and scheduled delivery; their service credentials never enter the browser.

Apply migrations `001` through `015` in order for a new environment. Migration `006` retires the legacy snapshot table and is intentionally destructive; use it only after confirming that no snapshot data needs to survive. Full setup, environment variables, delivery-provider configuration, and the release checklist are in [the production operations guide](docs/OPERATIONS.md).

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

### Must-read first (community quick path)

- [Quick feature guide](docs/QUICK_FEATURE_GUIDE.md)
- [Architecture guide](docs/ARCHITECTURE_GUIDE.md)
- [Production operations runbook](docs/OPERATIONS.md)
- [PostHog integration guide](docs/POSTHOG_CONFIGURATION_GUIDE.md)
- [QA and production readiness](docs/QA_AND_PRODUCTION_READINESS.md)

### Full docs index

- [Production operations](docs/OPERATIONS.md)
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
