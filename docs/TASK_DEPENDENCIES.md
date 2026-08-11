# Task dependencies

Dependencies are a directed graph: `prerequisite → dependent`. They are a
reusable repository capability, so a persistence adapter can opt in without
changing the core task contract.

## Behaviour

- **Finish → start** is the default required completion gate. A dependent task
  cannot be marked complete until each required prerequisite is complete.
- The database rejects self-links and cycles. This protects REST clients,
  imports, future automations, and the browser equally.
- Start-to-start, finish-to-finish, and start-to-finish links are retained as
  explicit graph semantics. They are visual-only until the application gains
  start dates, durations, and a working calendar; no due dates are silently
  moved.
- Editors must be able to edit both connected tasks. Readers can inspect only
  edges whose two endpoints they can read.

## Enable

Apply migrations 024–025 after migrations 005–023. Migration 025 adds the
batched projection used by task-list Dependency Pulses.

## UI

The task detail's **Work order** section shows a ready/blocked indicator,
prerequisites, downstream work, and a constrained task picker. It prevents an
unready task from being completed in the UI; the database trigger independently
enforces the same invariant. List cards show **Blocked** only when a required
finish-to-start prerequisite is incomplete; they show **Unblocks** for the
currently opened prerequisite task. The summary is batched so the list does
not need one dependency query per task.

## Adapter contract

Implement `DependencyRepository` from
`apps/web/src/core/contracts/repository.ts`. Repositories that do not implement
the capability simply omit the lens, preserving plug-and-play compatibility.
