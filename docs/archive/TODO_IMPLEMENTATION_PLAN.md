# Laureate Implementation Blueprint

## Purpose

Laureate is a generic, extensible task-management platform built on TanStack. The goal is not just to ship a todo app, but to establish a durable product and code architecture that can absorb new features with minimal friction, minimal risk, and strong runtime performance.

This document is the implementation contract for the first production-quality version of the app.

## Product Vision

Build a calm, fast, reliable workspace for lists and tasks that:

- feels immediate under heavy usage
- keeps the current state obvious at all times
- supports safe mutation with undo and auditability
- remains easy to extend as the product evolves
- avoids entangling core logic with feature-specific behavior

## Design Goals

### 1. Generic by default

Every core subsystem should be reusable across multiple feature types:

- lists
- tasks
- templates
- activity history
- filters and search
- bulk actions

No feature should require rewriting the storage, routing, or state-management layers.

### 2. Error-resistant

The system should anticipate:

- offline mode
- partial failures
- stale server state
- duplicate submissions
- race conditions
- invalid or incomplete input
- recovery after destructive actions

### 3. High performance

The app should feel instantaneous for normal workflows and remain stable at scale:

- small, targeted queries
- selective invalidation
- optimistic updates where safe
- route-level prefetching
- memoized derived state only where it materially helps
- virtualization for large tabular views

### 4. Plug-and-play extensibility

New features should be addable through a small set of contracts:

- route registration
- feature module registration
- command registration
- query registration
- action registration
- UI surface injection points

### 5. Clear and maintainable

The implementation should be understandable to a new contributor in under an hour:

- explicit naming
- shallow module boundaries
- documented invariants
- predictable state transitions
- testable pure functions

## Product Principles

1. Show current state first.
2. Make the next action obvious.
3. Prefer local reasoning over global side effects.
4. Make destructive actions reversible when possible.
5. Treat latency as a product defect.
6. Preserve keyboard efficiency without excluding pointer users.
7. Default to simple, readable interfaces.
8. Keep advanced behavior behind progressive disclosure.

## Non-Goals For The First Release

To preserve focus, the first implementation should avoid premature complexity:

- real-time multi-user collaboration
- full offline sync conflict resolution
- AI task generation
- complex permission models
- deeply nested project hierarchies
- custom workflow engines

These can be supported later through the extension points defined below.

## System Architecture

### Layer 1: Domain

Pure, framework-agnostic business logic.

Responsibilities:

- entity definitions
- validation rules
- status transitions
- ordering rules
- search and filter semantics
- undoable mutation descriptions

This layer must not depend on React, TanStack, or browser APIs.

### Layer 2: Data Access

All reads and writes flow through a typed repository interface.

Responsibilities:

- fetch lists and tasks
- create, update, delete, restore
- record activity events
- provide optimistic mutation metadata
- normalize server responses

This layer should be swappable between:

- in-memory mock storage
- local persistence
- remote API
- hybrid cache-backed models

### Layer 3: Application State

TanStack Query owns server-state caching and mutation lifecycle.

Responsibilities:

- query keys
- cache hydration
- optimistic updates
- invalidation strategy
- prefetching
- retry policy

### Layer 4: Routing And Navigation

TanStack Router owns app-level navigation and URL state.

Responsibilities:

- route parameters
- search params for filters and sorting
- route loaders
- prefetching on hover or focus
- deep-linkable detail views

### Layer 5: UI Composition

React components should be presentation-first and feature-light.

Responsibilities:

- rendering domain data
- triggering actions
- exposing keyboard shortcuts
- showing loading, empty, error, and recovery states

## Domain Model

### Entities

#### TodoList

- `id`
- `title`
- `description`
- `status`
- `templateId`
- `createdAt`
- `updatedAt`
- `archivedAt`
- `deletedAt`
- `completionPercent`
- `taskCount`
- `completedTaskCount`

#### TodoItem

- `id`
- `listId`
- `title`
- `notes`
- `status`
- `priority`
- `dueDate`
- `tags`
- `order`
- `createdAt`
- `updatedAt`
- `completedAt`
- `deletedAt`

#### ActivityEvent

- `id`
- `entityType`
- `entityId`
- `action`
- `actor`
- `timestamp`
- `metadata`

### Core States

Use explicit state machines instead of loose booleans whenever possible.

Examples:

- `active`
- `completed`
- `archived`
- `deleted`
- `restoring`
- `syncing`
- `failed`

This prevents impossible states and makes mutation logic easier to reason about.

## Feature Module Contract

Every feature should be represented as a self-contained module with a consistent shape.

```ts
export type FeatureModule = {
  id: string;
  routes?: RouteModule[];
  commands?: CommandDefinition[];
  queries?: QueryDefinition[];
  actions?: ActionDefinition[];
  navItems?: NavItem[];
  panels?: PanelDefinition[];
  init?: (context: FeatureContext) => void;
};
```

### Why this matters

This contract makes features additive instead of invasive. A template feature, collaboration feature, or analytics feature can be introduced without rewriting the base application shell.

## Registration Model

The platform should expose a small registry for all extensibility points:

- `registerFeature()`
- `registerRoute()`
- `registerCommand()`
- `registerAction()`
- `registerQuery()`
- `registerPanel()`

Rules:

- registration should be deterministic
- duplicate identifiers should fail fast in development
- feature modules should not mutate each other directly
- the registry should support static analysis and test coverage

## Data Flow

### Read Path

1. Route loader resolves the route context.
2. Query key is derived from route state.
3. TanStack Query returns cached data if fresh.
4. Missing or stale data is fetched from the repository.
5. Components render normalized view models.

### Write Path

1. User action is validated locally.
2. Mutation snapshot is captured for rollback.
3. Optimistic cache update is applied.
4. Repository write is executed.
5. Success commits server state.
6. Failure restores the previous snapshot and surfaces a recovery path.

## Query Strategy

Use precise query keys with clear boundaries:

- `lists`
- `lists.detail({ listId })`
- `lists.tasks({ listId, filters, sort })`
- `search({ query, filters })`
- `activity({ entityId })`
- `templates`

### Query rules

- keep keys serializable and stable
- avoid broad invalidation unless absolutely necessary
- prefer targeted invalidation by entity or list
- prefetch detail views from list indexes
- keep cache lifetimes explicit

## Mutation Strategy

All mutations should follow the same lifecycle:

1. validate
2. snapshot
3. optimistic update
4. request
5. reconcile
6. notify

### Mutation guarantees

- idempotent commands where possible
- rollback on failure
- deterministic ordering updates
- conflict-safe merge behavior for concurrent changes
- visible error recovery for users

## Performance Strategy

### Rendering

- split large views into focused components
- avoid unnecessary re-renders through stable props and derived data
- virtualize large tables or long lists
- prefer incremental rendering over large monolithic trees

### Data

- fetch only the fields needed for the current view
- avoid over-normalizing simple local entities
- cache summaries separately from details when helpful
- debounce expensive global search

### Interaction

- submit actions immediately when intent is clear
- use optimistic UI for safe updates
- prefetch likely next screens
- keep keyboard shortcuts responsive

### Build-time

- keep the dependency graph shallow
- keep shared utilities framework-neutral
- avoid giant barrel files that hinder tree shaking

## Resilience Strategy

### Failure Classes

The system should explicitly handle:

- validation errors
- network errors
- authorization errors
- concurrency conflicts
- stale cache reads
- partial mutation failure
- unavailable templates or optional modules

### User Recovery

Every failure state should provide at least one clear recovery path:

- retry
- undo
- refresh
- edit and resubmit
- restore from history

### Safety Rules

- destructive actions should be soft-delete by default
- irreversible actions require strong justification and clear confirmation
- every important mutation should be traceable in activity history

## Accessibility And Interaction

The UI should be usable by keyboard, mouse, and assistive technologies.

Requirements:

- semantic HTML first
- visible focus states
- adequate contrast
- screen-reader labels for icon-only actions
- predictable tab order
- keyboard shortcuts with discoverability
- ARIA only where native semantics are insufficient

## UI Principles

The visual system should be calm, efficient, and dense enough for power users without becoming cluttered.

Recommended UI behaviors:

- one primary action per screen
- contextual secondary actions
- inline editing for low-friction updates
- clear empty states with an immediate next step
- compact summary rows with expandable details
- consistent status chips and metadata patterns

## Routing Model

Suggested routes:

- `/` for dashboard
- `/lists/:listId` for list detail
- `/lists/:listId/edit` for focused editing
- `/search` for global search
- `/activity` for audit history
- `/settings` for preferences

### Routing rules

- all important view state should be representable in the URL
- filters and sorts should be shareable
- route transitions should preserve user context
- loaders should prefetch the minimum useful data

## Extensibility Plan

The platform should support new capabilities through isolated feature modules.

### Example Feature Types

- templates
- recurring tasks
- comments
- shared lists
- roles and permissions
- analytics
- offline synchronization
- AI assistance
- reminders and notifications

### Extension Principles

- every feature gets a clear boundary
- feature code should depend on the core platform, not the reverse
- feature registration should not alter unrelated behavior
- disabled features should degrade gracefully

## Suggested Folder Structure

```txt
apps/web/
  src/
    app/
      router/
      providers/
      layout/
    core/
      domain/
      contracts/
      registry/
      utils/
    features/
      lists/
      tasks/
      search/
      activity/
      templates/
    infrastructure/
      repository/
      mock/
      persistence/
    components/
    styles/
```

### Structure rules

- `core/` must remain framework-neutral where practical
- `features/` contains business features
- `infrastructure/` contains concrete implementations
- `components/` should stay mostly presentational

## Testing Strategy

### Unit Tests

Use for:

- domain rules
- validation
- ordering
- filtering
- state transitions
- registry behavior

### Integration Tests

Use for:

- route-to-data flow
- optimistic mutation behavior
- undo/restore handling
- search and filter interactions

### End-To-End Tests

Use for:

- create/edit/delete flows
- keyboard-first workflows
- responsive behavior
- error recovery

### Test Principles

- test invariants, not implementation details
- prefer deterministic fixtures
- keep mock data realistic and representative
- test failure paths as intentionally as success paths

## Observability And Diagnostics

Even in a small app, the platform should be diagnosable.

Track:

- query latency
- mutation failure rate
- undo usage
- search latency
- route transition timing
- empty state frequency

Log:

- validation failures
- repository errors
- optimistic rollback events
- feature registration conflicts

## Security And Trust

If the app later gains shared or remote capabilities, the architecture should already support safe defaults.

Baseline requirements:

- input validation before mutation
- no implicit destructive actions
- sanitize user-provided text before display where needed
- keep sensitive data out of logs
- isolate auth concerns from domain logic

## Implementation Phases

### Phase 1: Platform Foundation

- create the route shell
- establish the registry and contracts
- define domain entities and state transitions
- build the repository interface
- wire TanStack Query and TanStack Router
- create foundational UI primitives

### Phase 2: Core Productivity

- implement list CRUD
- implement task CRUD
- add optimistic updates
- add undo and restore
- add completion tracking

### Phase 3: Discovery And Navigation

- add dashboard summaries
- add global search
- add filters and sorting
- add route-driven state
- add prefetching and keyboard shortcuts

### Phase 4: Safety And Polish

- add activity history
- refine empty and error states
- improve accessibility
- add virtualization where needed
- harden rollback and recovery paths

### Phase 5: Extension Modules

- add templates
- add collaboration-ready abstractions
- add plugin-style feature examples
- add analytics hooks
- add optional offline support

## Definition Of Done

The first release is complete when:

- tasks and lists can be created, edited, archived, restored, and searched
- the app remains responsive with large datasets
- destructive actions have safe recovery paths
- keyboard workflows are discoverable and reliable
- the architecture supports new features without major refactoring
- the codebase is documented well enough for a new contributor to extend safely

## Success Metrics

- task creation time under 5 seconds
- list discovery under 10 seconds
- high keyboard completion rate for power users
- low error-recovery friction after failed mutations
- strong perceived responsiveness on mobile and desktop
- low coupling between feature modules

## Build Order Recommendation

1. Define domain contracts and registries
2. Implement repository abstraction and mock data
3. Wire routing and query infrastructure
4. Build dashboard and list detail
5. Add CRUD mutations and optimistic updates
6. Add search, filters, and sorting
7. Add undo, restore, and activity history
8. Add templates and optional extension modules

## Final Principle

The most important implementation choice is to keep the platform boring in the core and expressive at the edges. If the foundation is stable, features can be added quickly without turning the codebase into a maze.
