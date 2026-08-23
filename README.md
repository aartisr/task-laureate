# Task-Laureate

[![Production quality and security gates](https://github.com/aartisr/task-laureate/actions/workflows/quality.yml/badge.svg)](https://github.com/aartisr/task-laureate/actions/workflows/quality.yml)

[**Open Task-Laureate →**](https://tasks.ai-aarti.com) · [**Try the sample workspace →**](https://tasks.ai-aarti.com/sample) · [Product overview](https://aartisr.github.io/task-laureate/) · [Documentation hub](https://aartisr.github.io/task-laureate/docs/) · [Wiki](https://github.com/aartisr/task-laureate/wiki)

> A task manager should return attention to its owner—not demand more of it.

Task-Laureate is a calm, private, local-first task workspace for turning an
overwhelming list into one feasible next action. It combines frictionless
capture, focused daily execution, honest sync status, collaboration, and an
opt-in AI decomposition preview—without treating urgency, streaks, or endless
backlogs as the product.

Built by [Aarti S Ravikumar](https://ai-aarti.com), a student at
[Pioneer Charter School of Science II (PCSSII)](https://saugus.pioneercss.org).

## The personal story

Task-Laureate started with a simple observation: being busy is not the same as
knowing what to do next. When schoolwork, research, competitions, family
commitments, messages, and ideas all arrive at once, the most expensive thing
is often not time—it is attention. Every forgotten detail creates a small
amount of anxiety; eventually the task list itself becomes something to avoid.

I wanted to build the opposite kind of tool. Not a louder dashboard. Not a
guilt machine. A quiet, reliable place that asks one humane question: **what is
the next action you can actually begin?**

That question shapes the product. Capture first, organize later. Let a person
choose a realistic time and energy level. Break broad work into editable steps.
Make sync status truthful. Keep an undo path close by. Show progress as useful
evidence, never as a verdict on someone’s worth.

The ambition is deeply practical: if software can give someone one less
anxious “what did I forget?” moment, it has made room for better thinking,
better learning, and better care for the people and work that matter. That is
the standard Task-Laureate tries to earn every day.

## What it does today

- **Capture in seconds** — natural-language parsing for dates, durations, and
  tags; local-first delivery; keyboard shortcuts; share-target and extension
  distribution paths.
- **Turn intent into action** — deterministic task templates for every task,
  plus editable, selective AI-generated decompositions for an approved internal
  Gemini preview cohort.
- **Protect today’s attention** — Now, quick-win, deep-work, review, and
  commitment views use time and energy rather than guilt-driven priority noise.
- **Keep work dependable** — local-first persistence, outbox recovery, clear
  local/saving/synced/error states, undo for mutations, and resilient
  deployment-chunk recovery.
- **Collaborate safely** — normalized Supabase Lists and Tasks, RLS-backed
  owner/editor/viewer permissions, invitations, shared-work discovery, task
  dependencies, attachments, reminders, and activity history.
- **Stay understandable** — responsive semantic themes, keyboard-accessible
  interactions, contrast-focused styling, exports/imports, and a Puck editor
  for content pages.

## AI decomposition, with human control

The **Try AI breakdown (preview)** control is available from a task’s
**Plan and deconstruct** section for signed-in owners and editors when the
restricted preview is enabled for their account. AI never changes a task by
itself: every proposed step is visible, editable, selectively includable, and
discardable before acceptance.

The current Gemini free-tier preview is deliberately narrow:

- server-only Gemini credentials; no `VITE_*` AI secret
- explicit consent, named-user allowlist, authenticated task authorization,
  content safeguards, quotas, cache, audit events, and typed fallbacks
- strict response-schema validation and versioned model/prompt provenance
- atomic acceptance: all selected child tasks and planning metadata are saved
  together, or none are
- template decomposition remains available for every task, including every AI
  failure or ineligible request

Use only non-sensitive task text in the preview. General-user AI availability
is intentionally deferred until an approved paid or enterprise provider plan
exists. Full operations, privacy boundaries, and rollout guidance are in the
[Gemini free-tier decomposition plan](docs/GEMINI_FREE_TIER_AI_DECOMPOSITION_PLAN.md).

## Live deployments

- [tasks.ai-aarti.com](https://tasks.ai-aarti.com) — primary deployment
- [tasks.pcssiirobotics.org](https://tasks.pcssiirobotics.org) — PCSSII
  Robotics deployment

For a new deployment, follow [Production Operations](docs/OPERATIONS.md) and
add the exact deployed origin to Supabase Auth redirect URLs.

## Quick start

Requirements: Node.js 20.19+ and npm.

```bash
git clone https://github.com/aartisr/task-laureate.git
cd task-laureate
npm install
npm run dev
```

Open the URL Vite prints (normally <http://localhost:5173>).

### Submit URL updates to IndexNow

The repository includes a generic, opt-in submitter for Bing and other
IndexNow participants. It uses the public key file already checked into the
web app and never submits anything without an explicit URL:

```bash
npm run submit:indexnow -- --url https://tasks.ai-aarti.com/
npm run submit:indexnow -- --url https://tasks.ai-aarti.com/about/ --dry-run
```

Repeat `--url` for a batch, or set `INDEXNOW_URLS` to a comma-separated list.
Use `--key`, `--key-file`, `--host`, and `--endpoint` to adapt the utility to
another verified site or a test endpoint.

### Quality gate

Run the same production-quality gate used for delivery:

```bash
npm run quality:gate
```

It verifies production configuration and registry safety, TypeScript, the test
suite, the Vite build, and performance budgets. Supabase live integration tests
remain explicit opt-in checks because they require a real non-service-role test
user and environment credentials:

```bash
npm run test:supabase -w apps/web
npm run test:supabase:permissions -w apps/web
```

## Configuration at a glance

Keep secrets in ignored environment files or Vercel’s server-only environment
settings—never in source control.

| Capability | Browser-safe configuration | Server-only configuration |
| --- | --- | --- |
| Core cloud sync | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | — |
| AI preview UI | `VITE_FEATURE_AI_DECOMPOSITION=true` | `GEMINI_API_KEY`, provider/model/cache settings, allowlist, Supabase server settings |
| Reminders and invitations | public app URL as needed | delivery-provider credentials |
| Calendar | none until enabled | OAuth client secret and encrypted-token design |

For the complete, current inventory use
[Remaining Work and Launch Readiness](docs/REMAINING_WORK_AND_READINESS.md).

## Architecture

```text
apps/web/                 Vite + React application and Vercel functions
  src/app/                Composition root, runtime services, routing, providers
  src/core/               Domain contracts, policies, mutations, themes
  src/features/           Feature-oriented UI modules
  src/infrastructure/     Persistence, analytics, AI client boundary, adapters
  api/                    Server-only Vercel endpoints and provider adapters
supabase/migrations/      Schema, RPCs, and row-level-security changes
docs/                     Product, operations, Puck, AI, and readiness guides
```

The browser uses the authenticated Supabase JWT and Postgres RLS for data
access. Server-only Vercel functions handle provider credentials and privileged
operations. The AI provider sits behind a narrow registry/adapter boundary so a
future paid or enterprise provider can be added without changing the core task
experience.

Apply migrations `001` through `045` in order for a new Supabase environment.
Read the [migration history guide](supabase/migrations/README.md) and
[Production Operations](docs/OPERATIONS.md) before applying them; migration
`006` includes a legacy snapshot retirement that must be reviewed before use.

## Documentation

- **Use the app:** [Quick feature guide](docs/QUICK_FEATURE_GUIDE.md)
- **Run or deploy it:** [Production operations](docs/OPERATIONS.md)
- **Understand the architecture:** [Architecture guide](docs/ARCHITECTURE_GUIDE.md)
- **Configure real AI safely:** [Gemini AI decomposition plan](docs/GEMINI_FREE_TIER_AI_DECOMPOSITION_PLAN.md)
- **Edit Puck-managed pages:** [Puck editor guide](docs/PUCK_EDITOR_GUIDE.md)
- **See delivery status and future work:** [Readiness tracker](docs/REMAINING_WORK_AND_READINESS.md)
- **Find everything:** [Documentation index](docs/INDEX.md)
- **Browse the quick reference:** [GitHub Wiki](https://github.com/aartisr/task-laureate/wiki)
- **Publish the Wiki:** [Wiki publishing guide](docs/GITHUB_WIKI_PUBLISHING.md)

## Contributing

Task-Laureate improves when people who use it can shape it. Accessibility
observations, documentation corrections, concise bug reports, and focused pull
requests all matter. Please run `npm run quality:gate` before opening a pull
request, and never commit credentials, tokens, or private user data.

## License

MIT
