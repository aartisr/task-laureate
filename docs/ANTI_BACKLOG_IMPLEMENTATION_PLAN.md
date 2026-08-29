# Anti-backlog implementation plan

## Purpose

Task-Laureate should act as an anti-backlog system rather than a conventional
task list: every interaction reduces ambiguity, limits the next decision, and
makes returning to the product feel safe.

The implementation should retain the existing application boundary:

```text
React UI
  -> domain contracts and application services
  -> repository capabilities
  -> persistence and integration adapters
  -> Supabase Auth, Postgres/RPC, and RLS
```

AI, natural-language parsing, calendar providers, and sync transport must all
be replaceable adapters. They must not leak provider-specific types into the
domain or UI.

## Product principles

1. Capture takes less than five seconds.
2. Every task exposes a smallest meaningful next action.
3. The daily experience is deliberately bounded; the entire backlog is not the
   default workspace.
4. Recommendations are explainable, editable, and never punitive.
5. Offline actions are instant and durable.
6. AI assists user decisions but never silently changes their data.

## Domain model

Use a stable, event-oriented model rather than page-specific state.

```text
Task
  id, workspaceId, title, notes, status
  estimateMinutes, energyLevel, dueAt, scheduledStartAt
  source, captureContext, parentTaskId, position
  completedAt, archivedAt, revision

TaskStep
  id, taskId, title, estimateMinutes, status, position
  isSuggested, acceptedAt

TaskIntent
  id, rawInput, parsedFields, parserVersion, confidence
  userOverrides, createdAt

TaskEvent
  id, taskId, type, occurredAt, actorId, payload, idempotencyKey

CalendarLink
  id, taskId, provider, externalEventId, syncState, syncVersion
```

- `TaskStep` is a first-class entity, enabling ordering, dependencies, and
  step-level analytics.
- `TaskIntent` preserves raw capture data so parser versions can be upgraded
  safely and user changes remain visible.
- `TaskEvent` powers momentum and retrospective read models; `Task` remains
  the current state projection.
- Energy is a small enum such as `deep`, `light`, and `quick`; estimates should
  accept ranges or calibrated minute values.
- `revision` supports optimistic concurrency and sync conflict detection.

## Capability contracts

Add contracts beside the existing persistence capabilities:

- `CaptureRepository`
- `TaskPlanningRepository`
- `TaskRecommendationRepository`
- `TaskEventRepository`
- `CalendarSyncProvider`
- `TaskDecomposer`
- `NaturalLanguageParser`
- `LocalSyncStore`

Compose concrete implementations in the application runtime. This lets the
product switch AI models, calendar vendors, or persistence backends without
rewriting user-facing features.

## Phase 0: foundation and guardrails

Create the platform needed for resilient feature delivery.

- Define migrations, typed RPCs, RLS policies, idempotency keys, audit events,
  and cursor-based reads.
- Implement IndexedDB-backed normalized read models, optimistic writes, a
  durable append-only mutation outbox, retry with backoff, and visible conflict
  states.
- Use server timestamps and idempotent mutation RPCs. Do not use client clock
  time as authoritative ordering or analytics data.
- Add feature flags, structured telemetry, error boundaries, accessibility
  requirements, and performance budgets.
- Deliver a deterministic recommendation policy before introducing AI.

**Exit criteria:** the app opens from local data offline, users can capture and
complete work offline, and the outbox reconciles correctly after reconnection.

## Phase 1: frictionless capture and task hygiene

### Universal capture

Create a command palette and quick-capture modal around a single `CaptureTask`
application service.

- Support `Cmd/Ctrl + Shift + K` while the application is focused.
- Capture typed text, pasted content, selected text, URLs, and contextual
  metadata; expose a mobile share endpoint later.
- Persist locally and update UI immediately, including when offline.
- Use progressive disclosure: title is required; date, energy, duration, list,
  and notes are optional suggestions.

### Natural-language parsing

Begin with a deterministic parser for dates, times, durations, and tags; use an
AI parser only to supplement genuinely ambiguous input.

```text
Send report to team tomorrow at 2pm #work 15m
```

becomes a title plus suggested schedule, `work` tag, and 15-minute estimate.

- Show parsed values as removable chips before saving.
- Store raw input, parsed fields, parser version, and confidence.
- Never auto-schedule ambiguous text; make it a visible suggestion.
- Test time zones and daylight-saving boundaries explicitly.

### Backlog decay prevention

- Tasks missing an estimate, energy level, or next action receive a
  `needs_clarity` signal rather than a priority label.
- The Today screen has a user-configurable commitment limit.
- Surface old untouched work in a gentle Review flow.
- Treat snoozing, parking, delegating, and archiving as valid outcomes.

**Measures:** median capture time, capture completion rate, percentage of tasks
clarified within 24 hours, and return rate after high-volume capture.

## Phase 2: execution copilot

### Task decomposition

Decomposition must produce a proposal, never mutate a task automatically.

```text
Task -> Decomposer adapter -> validated TaskPlanProposal
     -> review and selective acceptance -> persisted TaskSteps
```

A proposal includes a concise restatement, 3–7 ordered steps, estimates,
energy suggestions, assumptions, and a first five-minute action.

- Version prompts and schemas; validate structured provider responses at
  runtime.
- Enforce output and token-cost ceilings.
- Cache by task content hash, prompt version, and model version.
- Record proposal provenance for diagnosis, while user edits remain
  authoritative.
- Provide category-based decomposition templates as a non-AI fallback.
- Let users accept all, accept selected steps, edit inline, or discard.

### Energy- and time-aware recommendations

Implement the recommendation policy as a pure, unit-tested service.

```text
score(task, context) = urgency + scheduledFit + energyFit + durationFit
                     + dependencyReadiness + goalAlignment - avoidancePenalty
```

Context includes available minutes, selected energy, calendar gaps,
dependencies, and user preferences. Every result must explain itself in plain
language, for example: “Fits your 25-minute gap and low-energy setting.”

Provide focused views:

- **Now:** one recommended next action.
- **Focus block:** deep-work tasks fitting a chosen duration.
- **Quick wins:** tasks estimated at ten minutes or less.
- **Review:** items that need clarification, scheduling, or archival.

## Phase 3: local-first sync and calendar interoperability

### Synchronization

Use an outbox/inbox synchronization model:

1. Save locally and update the UI optimistically.
2. Queue a durable mutation with an idempotency key.
3. Send it when connectivity returns.
4. Merge server changes into local read models.
5. Surface only meaningful conflicts.

Conflict defaults:

- Completion is monotonic unless a user explicitly reopens the work.
- Apply field-level last-write-wins to title and notes, retaining history.
- Use fractional positions or a CRDT-ready ordering strategy for reordering.
- Preserve calendar provider revision tokens and do not overwrite user calendar
  changes silently.

### Calendar

Begin with one-way task-to-calendar blocks. Add two-way synchronization only
after users trust event creation and linking.

- Scheduling creates or links an external event.
- Provider changes update task scheduling through webhook or polling adapters.
- Completing a task offers, but never silently performs, event removal or
  modification.
- Store OAuth tokens server-side, encrypted, scope-minimized, and revocable.
- Make ownership explicit: external calendar data owns event title/time; task
  data owns completion state.

Implement Google Calendar first. Add iCalendar import/export for broad
interoperability before platform-specific native calendar integrations.

## Phase 4: reflective progress loops

Generate weekly retrospectives from `TaskEvent` data, not client-only counters.

Summaries should cover completed work by energy and duration, planned versus
completed focus blocks, productive windows, common blockers, and a small number
of actionable adjustments for the following week.

Use non-punitive language. “You completed 14 deep-work tasks Tuesday mornings”
is useful; broken-streak mechanics are not. Analytics should be privacy-aware,
exportable, and removable.

## Delivery roadmap

| Milestone | Deliverable | Exit criteria |
| --- | --- | --- |
| Foundation | Contracts, migrations/RPCs, IndexedDB outbox | Offline capture and safe reconciliation |
| Capture | Command palette, NLP parser, Review flow | Under-five-second median capture without required metadata |
| Copilot | Selective decomposition and scoring engine | Suggestions are editable, explainable, and measurable |
| Calendar | Google scheduling, then two-way sync | No duplicates and safe conflict handling |
| Reflection | Event pipeline and weekly summary | Useful, non-punitive insights |
| Scale | Share sheet, extension, provider adapters | Providers evolve without core-domain changes |

## Staged implementation sequence

Each stage is independently deployable, protected by a feature flag, and has a
clear rollback path. A stage is not considered complete until its quality gate
passes; feature breadth never substitutes for resilience.

### Stage 0: product contracts and observability

**Outcome:** establish the durable seams before changing user behaviour.

- Add domain contracts for capture, planning, recommendations, events, local
  synchronization, and provider adapters.
- Define database migrations, RLS policies, typed RPC boundaries, and
  idempotency rules before creating UI.
- Add feature flags, error taxonomy, structured telemetry, and baseline
  activation/retention measurements.
- Write contract tests and migration/RLS tests.

**Quality gate:** existing task workflows are unchanged; every new boundary has
typed contracts, failure states, and automated coverage.

### Stage 1: fast capture

**Outcome:** users can capture thoughts immediately, even offline.

- Deliver the command-palette quick capture flow and keyboard shortcut.
- Add a deterministic natural-language parser for common dates, durations, and
  tags, with explicit confidence and editable suggestions.
- Store raw capture intent and user corrections for future parser improvement.
- Add graceful authentication handoff and recovery of a pending capture.

**Quality gate:** median capture takes under five seconds; capture survives a
refresh, authentication handoff, and a simulated connectivity interruption.

### Stage 2: local-first reliability

**Outcome:** the product remains trustworthy without a network connection.

- Add IndexedDB read models, optimistic mutations, durable outbox, and
  reconciliation coordinator.
- Implement idempotent server mutations, conflict detection, retry/backoff,
  and actionable failure states.
- Add offline/reconnect end-to-end tests and sync observability.

**Quality gate:** repeated delivery cannot duplicate a task, and a disconnected
user can capture, edit, complete, and later reconcile work safely.

### Stage 3: anti-backlog daily workflow

**Outcome:** a task dump becomes a manageable set of next decisions.

- Introduce `needs_clarity`, commitment limits, Today, Review, snooze, park,
  delegate, and archive flows.
- Build deterministic energy/time recommendation policies with “why this?”
  explanations.
- Measure task-dump recovery and recommendation acceptance without punitive
  streak mechanics.

**Quality gate:** recommendations are deterministic, explainable, keyboard
accessible, and never hide or modify work without an explicit user action.

### Stage 4: task scaffolding copilot

**Outcome:** broad work becomes an editable sequence of small actions.

- Add template-based decomposition first, then an AI `TaskDecomposer` adapter.
- Validate versioned structured proposals; let users accept, select, edit, or
  discard suggested steps.
- Apply spend limits, caching, safety validation, provenance, and a reliable
  no-AI fallback.

**Quality gate:** no task changes without acceptance; every generated proposal
is schema-valid, attributable, bounded in cost, and recoverable.

### Stage 5: calendar and multi-channel capture

**Outcome:** execution fits the user's real availability and capture happens in
the places work originates.

- Begin with one-way Google Calendar blocks, then introduce carefully scoped
  two-way synchronization.
- Add share-sheet/browser capture adapters that feed the same `CaptureTask`
  application service.
- Encrypt provider credentials, minimize scopes, make ownership rules visible,
  and test external event conflicts.

**Quality gate:** calendar synchronization creates no duplicates, silently
deletes no external events, and external capture produces the same task shape
as in-app capture.

### Stage 6: reflection and controlled rollout

**Outcome:** users receive useful, privacy-respecting insights and the platform
can evolve safely.

- Build retrospective projections from task events, with opt-in analytics and
  export/delete controls.
- Roll out by cohort behind feature flags; monitor reliability, adoption,
  latency, cost, and accessibility regressions.
- Remove obsolete compatibility paths only after adoption and migration targets
  are met.

**Quality gate:** insights are accurate against event fixtures, non-punitive in
language, and no release regresses the baseline reliability budget.

## Recommended first delivery

Start with **Stage 0**, then ship **Stage 1** as the first user-visible release.
This sequence creates the contracts and measurement needed to make later
local-first, AI, and calendar capabilities dependable rather than experimental.

## Implementation tracker

This tracker is the source of truth for delivery. A checked item has been
implemented, integrated into the application path, and verified; a partial item
has useful supporting code but is not yet user-complete.

### Foundation

- [x] Domain contracts for capture, planning, events, recommendations, AI, and calendar providers.
- [x] Deterministic capture parsing, clarity policy, recommendation policy, and template decomposer.
- [x] Browser-local capture outbox primitive with retry and idempotency tests.
- [-] Database migrations, RLS, RPCs, and repository implementation for planning, steps, intents, events, and calendar links. Migrations 026–027 are deployed and the Supabase adapter is implemented; remote integration verification remains.
- [ ] Feature flags, structured telemetry, and production error taxonomy.

### Capture and synchronization

- [x] Global `Cmd/Ctrl + Shift + K` quick-capture surface.
- [-] Deliver queued captures into actual tasks, including durable intent history and authentication recovery. Local Inbox delivery is verified; remote delivery awaits integration verification against deployed migrations.
- [-] IndexedDB task read models, mutation outbox integration, reconciliation, and visible conflict resolution. IndexedDB workspace hydration/write-behind is implemented for local mode; remote operation replay and conflict UI remain.
- [ ] Offline/reconnect end-to-end tests.

### Execution workflow

- [-] Today, Review, Focus block, and Quick wins views. The `/now` execution workspace now exposes Now, Focus block, Quick wins, and Review; task-action controls are still pending.
- [ ] Commitment limits and task actions for clarify, snooze, park, delegate, and archive.
- [ ] Energy/time recommendation UI with “why this?” explanations.
- [ ] Proposal review UI to accept, selectively accept, edit, or discard task steps.

### AI and integrations

- [x] Structured AI decomposition adapter with schema validation, prompt/model versioning, costs, cache, and provenance (restricted Gemini preview completed 2026-08-12).
- [x] Reliable template decomposition fallback.
- [ ] Google Calendar OAuth, encrypted server-side tokens, event creation, and one-way scheduling.
- [ ] Calendar webhook/polling reconciliation, two-way sync, and conflict handling.
- [ ] Browser extension/share-sheet capture adapters.

### Reflection and rollout

- [x] Pure weekly reflection projection.
- [ ] Task-event persistence and weekly retrospective UI.
- [ ] Privacy controls, export/delete, and analytics consent.
- [ ] Feature-gated cohort rollout, dashboards, accessibility/performance testing, and operational runbooks.

## Quality bar

- Contract, policy, parser, migration/RLS, sync-conflict, and adapter tests.
- End-to-end coverage for offline capture, reconnect, decomposition acceptance,
  and calendar resynchronization.
- Keyboard-only flows, visible focus management, screen-reader labels, and
  reduced-motion support.
- Least-privilege OAuth, encrypted tokens, RLS everywhere, and no provider keys
  in clients.
- Instrument outbox depth, reconciliation failures, parser overrides, AI
  proposal acceptance, and calendar-provider failures.
- Track task-dump recovery, daily planning completion, recommendation
  acceptance, time-to-first-completion, and 7/28-day retention.

## Product center of gravity

The **Next Action** is the product’s center of gravity. Capture feeds it; task
scaffolding clarifies it; energy and time filters make it feasible; calendar
protects it; and reflection improves it. The full backlog remains available,
but is never the primary emotional experience.
