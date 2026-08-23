# Remaining Usability Work

This tracker turns the remaining findings from the
[Usability Evaluation Report](USABILITY_EVALUATION_REPORT.md) into sequential
implementation work. Each item is completed only after its focused tests,
build, and documentation update pass.

## Working rules

- Preserve one task data model and existing authorization boundaries.
- Prefer one clear default action, with optional detail revealed when needed.
- Keep privacy, sync, export, recovery, support, and accessibility findable.
- Reuse existing components and contracts before adding abstractions.
- Do not claim real-user validation until representative users complete the
  documented study protocol.

## Status

| Order | Work item | Status | Completion evidence |
| --- | --- | --- | --- |
| 1 | Simplify sharing and invitation decisions | **Complete** | Role choices now use outcome language, selected access is stated before sending, and invitation delivery remains explicit. Sharing tests and build pass. |
| 2 | Make dependencies easier to understand | **Complete** | Replaced technical relationship labels with plain-language sequence labels and a clearer connect action. Dependency tests and build pass. |
| 3 | Align mobile and desktop navigation | **Complete** | Mobile primary destinations now follow Now, My lists, Search, Capture, and More while preserving routes. |
| 4 | Make list editing as direct as task editing | **Complete** | List title and description can be edited directly with clear Save and Cancel actions. Build and diff checks pass. |
| 5 | Improve Focus Mode page-level visibility | **Complete** | Focus Mode now keeps essential lists/completed access while hiding secondary collaboration, activity, and analytics destinations; Workspace Mode shows all. |
| 6 | Run real-user usability evaluation | **Blocked externally** | The study protocol is ready, but participant recruitment and sessions require human participants outside the repository. |

## Item 1: Sharing and invitations

### Intended outcome

Users should be able to invite someone without first learning the permission
model, delivery provider configuration, or distinction between accepted and
pending access.

### Planned changes

- Present Editor and Viewer as clear outcome-based choices.
- Explain the selected permission before creating the invite.
- State whether the invitation was emailed or must be copied manually.
- Combine accepted collaborators and pending invitations into one status-led
  area where practical without changing repository contracts.
- Keep revoke and owner-only restrictions explicit.

### Delivered

- Replaced technical role descriptions with **Help update work** and **View
  only**.
- Added a live explanation of the selected access before the invite is sent.
- Changed the submit action to state the role being granted.
- Preserved the existing email and secure-link delivery behavior.

### Validation

- [x] Sharing component tests pass.
- [x] Role selection remains keyboard accessible.
- [x] Owner-only and read-only authorization behavior is unchanged.
- [x] Production build passes.
- [x] This tracker is updated with exact evidence.

## Item 2: Dependencies

- [ ] Show clear “Blocked by” and “Unblocks” language.
- [ ] Make linking a task discoverable without technical terminology.
- [ ] Preserve cycle and self-dependency protections.
- [ ] Add focused component tests.

### Delivered

- Renamed the section to **What needs to happen first?**.
- Replaced **Waiting on** and **Unblocks** with **Needs this first** and
  **Makes possible**.
- Replaced **Add prerequisite** with **This task needs** and **Add dependency**
  with **Connect tasks**.
- Added an explanation of the finish-before-start relationship.
- Preserved cycle, self-dependency, read-only, and persistence behavior.

### Validation

- [x] Full suite passes; no dedicated TaskDependencies test file currently exists.
- [x] Role and read-only behavior remains unchanged.
- [x] Production build passes.
- [x] Diff check passes.

## Item 3: Navigation consistency

### Delivered

- Mobile primary navigation now follows the Focus workflow: **Now**, **My
  lists**, and **Search**.
- Capture remains the dedicated center action; More contains secondary views.
- Existing desktop order and all route paths remain unchanged.

### Validation

- [x] Navigation tests pass.
- [x] Production build passes.
- [x] Diff check passes.

## Item 4: List editing

- [ ] Provide one obvious list edit action.
- [ ] Keep title editing inline or in the same focused surface.
- [ ] Keep archive and delete deliberate and reversible where supported.
- [ ] Add focused tests.

### Delivered

- Renamed the primary action to **Edit list**.
- Added direct description editing, including an **Add a description** path
  when no description exists.
- Added `Cmd/Ctrl+Enter` save and `Escape` cancel behavior for descriptions.
- Preserved deliberate archive and delete controls.

### Validation

- [x] Production build passes.
- [x] Diff check passes.

## Item 5: Focus Mode visibility

### Delivered

- Focus Mode keeps My lists and Completed available.
- Focus Mode hides shared-work, activity, and progress destinations from the
  secondary navigation until Workspace Mode is selected.
- Workspace Mode restores the complete secondary navigation.
- The preference remains presentation-only; routes, data, permissions, and
  recovery behavior are unchanged.

### Validation

- [x] Navigation tests pass: 5 tests.
- [x] Production build passes.
- [x] Diff check passes.

## Item 6: Human evaluation

### External dependency

The repository cannot recruit participants or observe real user behavior. The
research scenarios, measures, accessibility protocol, and success thresholds
are documented in [USABILITY_EVALUATION_REPORT.md](USABILITY_EVALUATION_REPORT.md).
This item remains blocked until those sessions are run and the findings are
recorded.

- [ ] Recruit representative participants.
- [ ] Run the scenarios in [USABILITY_EVALUATION_REPORT.md](USABILITY_EVALUATION_REPORT.md).
- [ ] Record task success, wrong turns, hesitation, and critical errors without
  collecting private task content.
- [ ] Update the report with observed findings and decisions.

## Change log

### 2026-08-23

- Created the remaining-work tracker.
- Started Item 1: sharing and invitations.
- Completed Item 1: simplified role language and made the selected access and
  invitation action explicit.
- Completed Items 2 through 5 with focused validation: dependency language,
  mobile navigation alignment, direct list editing, and Focus Mode visibility.
- Marked Item 6 as externally blocked rather than claiming unperformed user
  research.