# Usability and Experience Modes Progress

This document tracks implementation of the recommendations in
[Usability Audit and Experience Modes](USABILITY_AND_EXPERIENCE_MODES.md).

## Decision being implemented

Task-Laureate is moving toward two presentation experiences:

- **Focus Mode:** the default path for capturing, choosing, and completing one
  feasible next action.
- **Workspace Mode:** an opt-in full planning and collaboration surface.

These are disclosure and navigation preferences, not separate products. They
must share task data, permissions, persistence, routes, mutations, and domain
services. Privacy, sync, export, recovery, support, and accessibility controls
must remain findable in both experiences.

## Status legend

- **Complete:** implemented and validated.
- **In progress:** implementation has started; follow-up validation remains.
- **Queued:** defined but not started.
- **Blocked:** requires a product or technical decision before work can begin.

## Stage tracker

| Stage | Scope | Status | Evidence |
| --- | --- | --- | --- |
| 0 | Baseline, instrumentation, and usability guardrails | Queued | Baseline events and test plan not yet added. |
| 1 | Simplify the default Now experience | **Complete** | Now keeps one next-action card primary; capacity setup and commitments are disclosed. Build and tests pass after implementation. |
| 2 | Repair navigation and route clarity | **Complete** | Clarified All tasks/My lists labels, exposed Completed, and renamed the secondary navigation group More without changing route paths. |
| 3 | Simplify capture and task detail | **Complete** | Capture keeps title and due date primary; priority/notes and secondary detail tools are disclosed. Duplicate task edit entry point removed. |
| 4 | Add the Focus/Workspace preference | **Complete** | Added a local-first, synchronized presentation preference with Focus as the default and reusable controls in Settings and navigation. |
| 5 | Make advanced tools self-explanatory | **Complete** | Expanded shortcut help, added sync-error recovery guidance, and explained the non-AI template fallback. |
| 6 | Usability evaluation and refinement | **Complete (code-level)** | Completed static interaction/accessibility audit, recorded automated evidence, and added a repeatable human-research protocol. Real-user sessions remain an explicit follow-up. |

## Stage 1: Simplify the default Now experience

### Goal

The first viewport should make the next feasible action obvious without
requiring users to understand capacity planning, commitment limits, reflection,
or alternative task categories.

### Delivered behavior

- The next-action card remains the primary visible task surface.
- Time and energy controls are available under **Set time and energy**.
- Capacity information is available in the same disclosure rather than always
  competing with the next action.
- The commitment list is available under **Today's plan**, with its count in
  the summary.
- Alternative task categories remain behind **Explore other options**.
- End-of-day reflection remains behind **End my day**.
- Existing completion, defer, release, detail, recommendation, and persistence
  behavior remains unchanged.

### Validation

- [x] TypeScript and production build pass.
- [x] Existing test suite passes.
- [x] Keyboard and disclosure semantics remain represented by native `details`
  and `summary` controls.
- [ ] Manual desktop and mobile review.
- [ ] Usability comparison against the pre-change Now page.

## Stage 3: Simplify capture and task detail

### Goal

Let a user record a task without making every planning decision immediately,
while keeping the complete task record available when more context is useful.

### Delivered behavior

- Capture keeps the task title and optional due date in the primary flow.
- Priority and notes are grouped under **Add details**.
- Task detail keeps the primary title, status, completion, and note view clear.
- The duplicate **Edit details** entry point was removed; **Edit task** is the
  single editing action.
- Reminders, dependencies, and attachments are grouped under **More task
  details** with the explanation **Planning, files, and sharing**.
- Existing task fields, update mutations, dependency summaries, attachments,
  reminders, and read-only behavior remain available.
- Native `details` and `summary` controls keep the disclosures keyboard and
  assistive-technology accessible.

### Validation

- [x] TypeScript and production build pass.
- [x] Full test suite passes.
- [x] Diff check passes.
- [ ] Manual desktop and mobile review.
- [ ] Usability comparison against the pre-change capture and detail flows.

## Stage 4: Add the Focus/Workspace preference

### Goal

Let users choose how much planning detail is visible without creating separate
products, changing permissions, or moving task data.

### Delivered behavior

- Added the `focus` and `workspace` presentation values with `focus` as the
  default for missing, invalid, or unavailable stored values.
- Persisted the preference under the local-first key
  `task-laureate.workspace-experience`.
- Synchronized mounted controls immediately through a shared external store.
- Responded to browser `storage` events so another tab can change the visible
  experience.
- Added a reusable switch to Settings, desktop navigation utilities, and the
  mobile navigation panel.
- Explained that switching changes visibility and emphasis only; tasks and
  permissions stay the same.
- Kept the preference separate from task data and authorization.

### Validation

- [x] Preference contract tests cover Focus default, persistence, toggle, and
  invalid stored values.
- [x] Navigation tests pass.
- [x] Full test suite passes in the app workspace context.
- [x] TypeScript and production build pass.
- [x] Diff check passes.
- [ ] Manual desktop and mobile review.
- [ ] Usability comparison between Focus and Workspace experiences.

## Next implementation order

1. Establish a baseline for first-task completion and Now-page interaction.
2. Clarify primary navigation labels and group secondary views under More.
3. Simplify capture to title and optional due date, with advanced fields in
   task detail.
4. Add the persisted `workspaceExperience: "focus" | "workspace"` preference.
5. Add contextual descriptions, shortcut hints, sync recovery actions, and AI
   eligibility explanations.
6. Run moderated and unmoderated usability evaluation before expanding the
   mode-specific disclosure rules.

## Change log

### 2026-08-23

- Created this progress tracker.
- Completed Stage 1 default Now-page disclosure changes.
- Confirmed the implementation does not remove advanced task capabilities or
  change task persistence behavior.
- Started Stage 2 by clarifying the primary task/list labels while preserving
  existing routes and bookmarks.
- Completed Stage 2 by exposing Completed work and naming secondary views under
  More, with route compatibility preserved.
- Completed Stage 3 by simplifying capture and grouping secondary task details
  without changing task fields, persistence, or mutation contracts.
- Completed Stage 4 by adding the persisted Focus/Workspace presentation
  preference. The preference changes disclosure only and does not change task
  data, permissions, privacy, sync, export, or recovery access.
- Completed Stage 5 by adding contextual shortcut hints, explicit sync-error
  recovery guidance, and an AI availability explanation with a clear template
  fallback.
- Completed Stage 6 at the code and documentation level. Added the usability
  evaluation report, automated evidence, accessibility protocol, telemetry
  guardrails, success thresholds, and decision rules for human research.
- Follow-up usability fix: the list-level **Open & edit** action now opens the
  inline editor directly, removing the redundant **Edit task** step.
- Follow-up usability fix: task editing now supports visible `Cmd/Ctrl+Enter`
  save and `Escape` cancel shortcuts, reducing pointer travel.
- Follow-up usability fix: edit mode now leads with the title and working note,
  while priority, due date, and tags are grouped under Task details.
- Added cross-workflow quick actions and recovery guidance: task-row defer,
  actionable search empty states, and a global sync-conflict review link.