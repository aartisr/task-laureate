# Usability Evaluation Report

## Scope and status

**Evaluation date:** 2026-08-23

**Scope:** Focus/Workspace implementation through Stage 5 of
[Usability Audit and Experience Modes](USABILITY_AND_EXPERIENCE_MODES.md).

**Status:** Code-level Stage 6 evaluation complete. The repository is ready
for human usability research; this document does not claim that real-user
interviews or a statistically valid experiment have already occurred.

## Executive result

The staged changes reduce the number of decisions shown at once while keeping
the full product available:

- Now presents one recommended next action first.
- Capacity and commitment planning are disclosed until needed.
- Capture starts with title and due date; priority and notes are optional
  details.
- Task detail has one primary edit entry point.
- The list-level **Open & edit** action now enters edit mode directly instead
  of requiring a second **Edit task** click.
- Task editing supports standard `Cmd/Ctrl+Enter` save and `Escape` cancel
  actions, with the shortcuts shown beside the edit buttons.
- Edit mode now leads with the title and working note; priority, due date, and
  tags remain available under one **Task details** disclosure.
- Task rows provide a quick **Tomorrow** action, search empty states offer
  recovery or suggested queries, and sync conflicts surface a direct **Review
  and recover** action.
- Planning, files, reminders, and dependencies are grouped under More task
  details.
- Navigation distinguishes All tasks, My lists, and More destinations.
- Focus/Workspace switching is persisted without changing task data or access.
- Help, sync recovery, and AI fallback explanations are available where users
  need them.

The result is a lower initial cognitive load, not a guarantee of zero
cognitive load. No interface can honestly guarantee that for every user,
device, task, or accessibility setup. The measurable goal is to reduce the
number of simultaneous decisions and shorten the path to a useful action.

## Evaluation method

### Static interaction audit

Reviewed the implementation for:

- Primary action hierarchy
- Number of visible decisions on initial entry points
- Terminology and navigation clarity
- Native disclosure semantics
- Keyboard access and focus expectations
- Persistence and reversibility of experience switching
- Preservation of privacy, sync, export, recovery, and permission controls
- AI consent, eligibility, review, and fallback explanations

### Automated evidence

The following checks passed after the Stage 6 regression fix:

- Full test suite: 74 files passed, 2 skipped; 609 tests passed, 4 skipped.
- Account status tests: 3 tests passed.
- Preference contract tests: 3 tests passed.
- Navigation contract tests: 4 tests passed.
- Production TypeScript and Vite build: passed.
- `git diff --check`: passed.

The full suite includes component, domain, persistence, accessibility, and
performance-oriented coverage already present in the repository. It does not
replace observation of people using the product.

## Findings after staged implementation

| Area | Result | Remaining risk | Follow-up |
| --- | --- | --- | --- |
| Now | One next action is visually primary; planning is disclosed. | Users may not understand why a task was recommended. | Add a short, inspectable reason beside the recommendation and test comprehension. |
| Capture | Title and due date are the shortest path; optional details are available. | Users may not know where notes or priority went. | Keep Add details visible and test label comprehension. |
| Task detail | Edit task is the single edit entry point. | Full details may still feel dense in Workspace Mode. | Test task detail with a simple and a dependency-heavy task. |
| Navigation | All tasks, My lists, Completed, and More are distinct. | “Now” may still be unfamiliar to first-time users. | Compare Now with Next action in first-run research. |
| Modes | Preference is reversible, persisted, and presentation-only. | Users may expect mode to change permissions or data. | Retain explanatory copy and test the switch aloud. |
| Shortcuts | Supported shortcuts are documented in Help and key actions. | Users may not visit Help. | Add contextual hints only to high-value actions, avoiding visual noise. |
| Sync | Error state directs users to account settings and Sync Center. | Recovery still requires opening a second surface. | Test whether the recovery instruction is sufficient before adding inline retry. |
| AI | Consent and deterministic fallback are explicit. | Users may interpret “not enabled” as a defect. | Test the copy with eligible and ineligible users separately. |

## Human research protocol

### Participants

Recruit at least:

- 5 people who have never used Task-Laureate
- 5 people who regularly use a task manager
- 3 people who collaborate on shared task lists
- 2 people who use keyboard navigation or assistive technology

Do not collect real task content, private notes, credentials, or personal
identifiers during the sessions. Use prepared fictional tasks.

### Tasks

Give participants only the goal, not the route:

1. Capture “Email the science fair organizer tomorrow” and leave it ready to
   act on.
2. Find the task you just created and add a short note.
3. Decide what to do next when three tasks compete for attention.
4. Defer one task until tomorrow without deleting it.
5. Find completed work.
6. Switch to Workspace Mode and locate dependencies or attachments.
7. Return to Focus Mode.
8. Find the place to recover unsynced changes.

### Measures

Record:

- Time to first successful task creation
- Time to first completion or defer action
- Number of wrong turns before each goal
- Number of times the participant asks what a term means
- Whether the participant discovers the intended feature without prompting
- Mode-switch comprehension before and after the switch
- Critical errors: deletion, accidental completion, accidental sharing, or
  inability to recover a change
- Confidence rating from 1 to 5 after each task

### Success thresholds

Treat Focus Mode as an improvement candidate when:

- At least 90% create a task without facilitator help.
- At least 80% complete or defer a task from Now without opening Support.
- At least 80% find All tasks and Completed without being told the route.
- At least 80% understand that mode switching preserves data and permissions.
- No participant makes a critical destructive or sharing error.
- Median first-task time improves against the pre-Stage 1 baseline.

These thresholds are product evaluation targets, not claims about current
performance.

## Accessibility evaluation protocol

Run the tasks with keyboard-only navigation and at least one screen reader.
Verify:

- Focus reaches the mode switch, primary task actions, and disclosures in a
  logical order.
- Disclosure state is announced correctly.
- Focus returns to the triggering control after a dialog or panel closes.
- Hidden controls are not announced as available when their section is closed.
- Sync, blocked, selected, and error states are understandable without color.
- Text and controls remain usable at mobile widths and 200% zoom.
- Reduced-motion preferences do not remove context or feedback.

Record defects by task, route, browser, viewport, assistive technology, and
severity. Do not record user-entered task content.

## Telemetry guardrails

The evaluation may use coarse product events, subject to existing analytics
consent:

- `first_task_created`
- `first_task_completed`
- `planning_tools_opened`
- `experience_mode_changed`
- `navigation_search_used`
- `sync_recovery_opened`
- `support_confusion_reported`

Event properties may include experience mode, route, device class, and coarse
action type. They must not include task titles, notes, list names, emails,
attachment metadata, collaborator identifiers, or sensitive AI input.

## Decision after evaluation

Do not add more mode-specific hiding rules until the human study is complete.
The current implementation has enough disclosure to reduce first-use load,
and additional hiding could make important features undiscoverable.

After research:

- Keep Focus Mode as the default if first-task success improves and advanced
  feature discovery remains acceptable.
- Rename “Now” only if participants consistently fail to understand it.
- Promote a disclosed control only when users repeatedly need it and cannot
  find it.
- Remove or redesign a control only when it creates measurable errors or
  confusion across both modes.

## Related documents

- [Usability audit and experience modes](USABILITY_AND_EXPERIENCE_MODES.md)
- [Usability and experience modes progress](USABILITY_MODES_PROGRESS.md)
- [Quick feature guide](QUICK_FEATURE_GUIDE.md)