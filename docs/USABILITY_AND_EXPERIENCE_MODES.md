# Usability Audit and Experience Modes

## Status

**Decision:** Adopt progressive disclosure with two presentation experiences:
**Focus Mode** (default) and **Workspace Mode** (opt-in).

**Scope:** This document records the usability audit, the product decision,
the research basis, implementation sequence, measurement plan, and acceptance
criteria. It does not authorize a rewrite of the domain model or persistence
layer.

**Audience:** Product, design, frontend, accessibility, QA, and support
contributors.

## Executive decision

Task-Laureate should offer a simpler default experience, but it should not
create two separate products or permanently hide important capabilities.

Use the following names in the interface:

- **Focus Mode:** the calm default path for capturing, choosing, and completing
  the next feasible action.
- **Workspace Mode:** the full planning and collaboration surface for people
  who need dependencies, capacity, sharing, analytics, reminders, calendar,
  data recovery, or AI-assisted decomposition.

The mode changes emphasis, navigation prominence, defaults, and disclosure. It
does not change the underlying task data, permissions, privacy guarantees, or
available recovery paths. A user must be able to switch modes without losing
work or learning a second data model.

This is a progressive-disclosure decision, not a beginner-versus-expert
classification. Users can be new to Task-Laureate and still need advanced
features immediately. A researcher, student, or team lead may want a simple
capture flow one day and the full workspace the next.

## Why this decision is needed

The current product has a coherent anti-backlog philosophy, but that
philosophy is competing with a large set of capabilities presented at once.
The problem is primarily information architecture and sequencing, not a lack
of functionality.

### Highest-friction surfaces

| Surface | Observed issue | Effect on users | Priority |
| --- | --- | --- | --- |
| Now / execution | Energy, capacity, commitment, clarity, snooze, decomposition, completion, and reflection appear in one flow. | Users must learn the planning system before completing a task. | P0 |
| Navigation | Focus-oriented and list-oriented navigation groups are presented together without a clear relationship. | Users do not know whether to use All tasks, Lists, Search, or Now. | P0 |
| Capture | Priority and due date appear early, while estimates and energy appear later during execution. | Users cannot tell which decisions belong at capture time. | P0 |
| Task details | Read and edit states use different layouts and expose many properties. | Editing feels like entering another application state. | P1 |
| Settings | Several disclosure sections have equal visual weight. | New users cannot identify essential account, sync, privacy, or appearance controls. | P1 |
| Sharing | Roles, invitations, acceptance, and collaborator access are coupled in one workflow. | Users may fear making an irreversible permission mistake. | P1 |
| Sync | Multiple statuses exist, but recovery guidance is not beside the status. | "Needs attention" does not tell a user what to do next. | P1 |
| Keyboard shortcuts | More shortcuts exist in code than are advertised in the UI. | Power remains invisible until users discover Support. | P2 |

### Evidence in the current codebase

The main evidence surfaces are:

- [AppShell.tsx](../apps/web/src/components/AppShell.tsx): primary,
  workspace, utility, mobile, and expanded navigation states.
- [ExecutionPage.tsx](../apps/web/src/pages/ExecutionPage.tsx): the highest
  concentration of planning decisions and controls.
- [TaskComposer.tsx](../apps/web/src/components/TaskComposer.tsx): capture
  fields and hidden note affordances.
- [TaskDetailLens.tsx](../apps/web/src/components/TaskDetailLens.tsx): read,
  edit, property, dependency, and attachment concepts.
- [SettingsPage.tsx](../apps/web/src/pages/SettingsPage.tsx): grouped
  disclosures for appearance, notifications, privacy, sync, calendar, data,
  and product information.
- [TaskExecutionControls.tsx](../apps/web/src/components/TaskExecutionControls.tsx):
  template and conditionally available AI decomposition paths.
- [useKeyboardShortcuts.ts](../apps/web/src/hooks/useKeyboardShortcuts.ts):
  keyboard capabilities that are not all surfaced in Help.
- [QUICK_FEATURE_GUIDE.md](QUICK_FEATURE_GUIDE.md): the current conceptual
  vocabulary and feature instructions.

## Usability principles for the change

1. **One primary decision per screen.** A page may expose secondary actions,
   but one action must visually and semantically lead.
2. **Capture is not planning.** Capture should preserve an idea quickly;
   planning should happen when the user has enough context.
3. **Reveal detail at the moment of need.** Do not hide information that most
   users need, but do hide specialist controls until they are relevant.
4. **Use one vocabulary.** Every concept should have one user-facing name and
   one explanation. Technical names such as RLS, RPC, or outbox do not belong
   in ordinary workflows.
5. **Trust controls are always findable.** Privacy, sync status, export, and
   recovery are not advanced features and must remain visible or one step away.
6. **Never make the mode destructive.** Switching modes must preserve data,
   URLs, permissions, keyboard access, and task state.
7. **Progress is evidence, not judgment.** Defaults should reduce decisions,
   not imply that a user is failing when a task is deferred or blocked.
8. **Accessibility is part of the mode contract.** Hidden controls must not be
   removed from the accessibility tree while they are presented as available;
   disclosure state, focus, names, and keyboard paths must remain coherent.

## Proposed experience model

### Focus Mode: default

Focus Mode is optimized for a new or returning user who wants to make progress
without maintaining a planning system.

#### Primary navigation

1. Now
2. My lists
3. All tasks
4. Search
5. More

Dashboard may remain the landing route, but it should lead with the next
useful action rather than a collection of statistics. Activity, Progress,
Shared with me, Shared by me, Settings, Support, and product information can
live under More, with Account and Sync still visible in the global status area.

#### Visible task actions

- Capture a task
- Open a list
- Complete a task
- Defer a task
- Edit title, notes, due date, and priority
- Search tasks and lists
- View sync status and recovery guidance
- Export data and access privacy controls

#### Disclosed planning actions

The following remain available through a clearly labeled **Planning tools**
section on task detail or Now:

- Estimate and energy
- Capacity and commitment planning
- Dependencies and blocked work
- Attachments
- Reminders and calendar scheduling
- Collaboration and role management
- Template or AI decomposition
- Progress and activity detail

The label must explain the value of the section. Avoid a generic "Advanced"
button with no context.

### Workspace Mode: opt-in

Workspace Mode makes the full system visible for users who intentionally need
it. It should preserve the same routes and components wherever possible while
changing emphasis and default disclosure state.

Workspace Mode may show:

- Full planning controls on Now
- Expanded task properties
- Dependencies and prerequisite signals
- Attachments and reminders
- Collaboration, assignments, and role controls
- Calendar scheduling
- Activity and progress analytics
- AI decomposition preview, when eligible
- Full settings navigation

The user should be able to return to Focus Mode from the same location. The
control should say what will change, for example: "Use Focus Mode: keep the
same data, show fewer planning controls by default."

### Controls that must not be hidden by mode

These are trust, safety, or ownership controls rather than specialist tools:

- Privacy and analytics consent
- Account and authentication
- Sync status and recovery
- Export and import
- Delete or archive actions, with confirmation
- Support and bug reporting
- Accessibility settings and keyboard access
- Permission warnings for shared work

## Recommended information architecture

### Navigation labels

Prefer labels that answer the user's question directly:

| Current or ambiguous label | Recommended label | Reason |
| --- | --- | --- |
| Lists | My lists | Clarifies ownership and container meaning. |
| Tasks | All tasks | Clarifies that this is a cross-list view. |
| Now | Now | Keep; it expresses the product's core promise. |
| Progress | Progress | Keep, but place under More for Focus Mode. |
| Shared by me | Shared by me | Keep; add a short description in navigation. |
| Shared with me | Shared with me | Keep; add a short description in navigation. |
| View options | View options | Keep; place list ordering and filters inside it. |
| Decompose | Break this into steps | Makes the result legible before activation. |
| Capacity | Time available | Prefer the user outcome over the internal model. |
| Energy level | Effort needed | Explain the decision in ordinary language. |
| Prerequisites | Waiting on | Useful for most users; retain "dependency" in help. |

### Route and discoverability cleanup

The visible label and route should not imply different concepts. In
particular, `/lists-overview` should either become `/lists` with a redirect or
the UI should consistently call it "Lists overview." Existing links and
bookmarks must continue to work during the transition.

Completed work should be reachable from All tasks and the Dashboard rather
than depending on an undocumented route. Advanced views can remain available
under More without being part of the first-run path.

## Key user journeys

### First task

1. User opens the app or sample workspace.
2. The page explains one idea: "Choose what you can begin next."
3. User selects **Capture task**.
4. User enters a title and optionally a due date.
5. The task is created with a clear confirmation and two choices: **Add
   another** or **Open task**.
6. The task appears in Now or the selected list.

Success condition: a first-time user can create a task without understanding
energy, capacity, dependencies, collaboration, or AI decomposition.

### Returning to work

1. User opens Now.
2. One recommended next action is visually primary.
3. User chooses **Complete**, **Defer**, or **View details**.
4. Optional planning tools remain one intentional action away.

Success condition: the user can act without first configuring the planning
system.

### Needing more structure

1. User opens a task and chooses **Planning tools**.
2. The panel explains the available tools in outcome language.
3. User opens only the relevant tool, such as **Waiting on** or **Break this
   into steps**.
4. The app preserves the task context and returns focus to the task after the
   tool closes.

Success condition: advanced controls are discoverable without being
continuously noisy.

### Switching experience

1. User opens Settings or More.
2. The current experience is named and explained.
3. User selects the other experience.
4. The app confirms that tasks and data remain unchanged.
5. The next screen reflects the new disclosure state.

Success condition: the switch is reversible, understandable, and does not
require a tutorial or account migration.

## Implementation plan

### Phase 0: baseline and instrumentation

Before changing behavior, capture a baseline for the current experience.

- Record time to first task, first-task completion, and first-session exit.
- Record visits to Now, All tasks, My lists, Search, Settings, and Support.
- Record opening of planning tools, sharing, dependencies, attachments, and
  AI preview without recording task content.
- Add a privacy-reviewed `workspace_experience` value to product analytics;
  do not send task titles, notes, identifiers, or attachment names.
- Run a keyboard and screen-reader smoke test for the existing flows.

### Phase 1: simplify the default path

- Reduce Now to one primary recommendation and three primary actions:
  Complete, Defer, and Details.
- Move capacity, commitment, reflection, and decomposition into Planning
  tools.
- Keep all existing domain services and mutation behavior.
- Add a clear explanation for local-first saving and sync status near the
  status indicator.

### Phase 2: repair information architecture

- Consolidate primary navigation around Now, My lists, All tasks, and Search.
- Place secondary surfaces under More.
- Improve All tasks grouping so the owning list is visually obvious.
- Make Completed reachable from All tasks and Dashboard.
- Add route redirects before changing any public route names.

### Phase 3: simplify capture and detail

- Keep title and optional due date in the primary capture flow.
- Default priority to Medium without forcing a priority decision.
- Move tags, rich notes, attachments, dependencies, estimates, and energy to
  task detail or Planning tools.
- Keep editing in the same visual context where possible; preserve scroll and
  return focus after save or cancel.

### Phase 4: add the experience preference

Add a preference using the existing settings and persistence conventions:

```text
workspaceExperience: "focus" | "workspace"
```

Requirements:

- Default to `focus` for new users and existing users until they choose.
- Treat an absent value as `focus` for backward compatibility.
- Store the preference separately from task data and permissions.
- Persist it in the same local/cloud preference path already used by the app.
- Do not make the preference a server authorization boundary.
- Keep a visible switch in Settings and More.
- Preserve the preference across sign-in, sign-out, and device sync according
  to the product's existing account preference policy.

### Phase 5: make advanced tools self-explanatory

- Add one-sentence descriptions to Planning tools.
- Explain AI eligibility and consent when the AI control is unavailable.
- Show sync recovery actions beside the relevant error state.
- Document every supported keyboard shortcut beside its action and in Help.
- Use confirmation language for sharing roles and destructive actions.

### Phase 6: evaluate and refine

- Run moderated usability sessions with first-time and experienced users.
- Compare Focus Mode with the existing interface using the same tasks.
- Keep Workspace Mode available for users who need it.
- Only make further controls mode-specific after evidence shows that the
  disclosure improves completion without harming discoverability.

## Accessibility requirements

Every phase must preserve the following:

- A visible skip link and logical heading hierarchy.
- Keyboard access to mode switching and every disclosed control.
- Focus moved into a newly opened dialog or disclosure, then returned to its
  trigger when closed.
- `aria-expanded` and `aria-controls` values that match actual state.
- No information conveyed by color alone for sync, blocked, or selected state.
- Touch targets of at least 44 by 44 CSS pixels where practical.
- Descriptive names for icon-only controls and visible labels for unfamiliar
  actions.
- No reliance on hover to reveal controls.
- Reduced-motion behavior for any onboarding or reveal animation.
- No hidden content that is announced by a screen reader as available when it
  is not actionable in the current mode.

## Measurement plan

### Primary success metrics

- Median time from first open to first created task decreases.
- First-task completion rate increases or remains stable.
- First-session abandonment decreases.
- More users reach a completed or deferred task without opening Support.
- Fewer support reports describe navigation or terminology confusion.

### Guardrail metrics

- Search usage does not decline for returning users.
- Existing users can still access dependencies, sharing, attachments, export,
  and sync recovery.
- Workspace Mode users do not experience increased task mutation errors.
- No increase in accidental task completion, deletion, or sharing.
- Accessibility test pass rate does not regress.
- Performance budgets remain unchanged.

### Suggested event names

Events should contain only non-sensitive context:

- `experience_mode_viewed`
- `experience_mode_changed`
- `first_task_created`
- `first_task_completed`
- `planning_tools_opened`
- `planning_tool_used`
- `sync_recovery_opened`
- `navigation_search_used`
- `support_confusion_reported`

Each event should include mode, route, and a coarse action name only. Never
include task text, notes, list names, email addresses, attachment metadata, or
collaborator identifiers.

## Research basis

The decision follows a consistent pattern in established interface guidance:

- The GOV.UK Design System recommends using a details disclosure when only
  some users need the information, and warns against hiding information that
  most users need. It also recommends short, descriptive disclosure labels.
- Apple's Human Interface Guidelines emphasize clear hierarchy, predictable
  navigation, accessible controls, and platform conventions that let people
  focus on their task rather than the interface structure.
- Mature productivity tools generally preserve one underlying task model while
  using focused defaults, contextual detail, keyboard support, and optional
  planning depth. They do not require users to choose an identity as a
  beginner or expert before they can work.

The relevant sources consulted for this decision include:

- [GOV.UK Design System: Details](https://design-system.service.gov.uk/components/details/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- Nielsen Norman Group guidance on progressive disclosure and recognition over
  recall.
- The current Task-Laureate implementation and user-facing guides listed in
  the evidence section above.

This research supports the pattern, but it does not replace direct research
with Task-Laureate users. External products should be treated as examples,
not proof that a particular label or interaction will work for this audience.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Users cannot find advanced features. | Use descriptive Planning tools labels, contextual entry points, and a persistent mode switch. Measure discovery. |
| Two modes create divergent behavior. | Share domain logic, routes, mutation services, and components; vary disclosure and navigation only. |
| Existing users are disrupted. | Default the preference conservatively, preserve routes, and provide an explicit switch. |
| Privacy or export becomes hidden. | Keep trust controls outside the advanced grouping. |
| AI feels inconsistent or broken. | Explain eligibility, consent, and template fallback in the UI. |
| Analytics increases privacy risk. | Record mode and coarse actions only; exclude task and collaborator content. |
| Mode switching becomes another confusing setting. | Explain the result in plain language and show the current mode at the switch. |

## Acceptance criteria

The initial release is ready when:

1. A new user can create a task from the default landing experience without
   learning energy, capacity, dependencies, collaboration, or AI terminology.
2. The Now page has one obvious primary action and no more than three primary
   task actions before Planning tools are opened.
3. All existing task capabilities remain available through clear paths.
4. Privacy, sync status, export, recovery, support, and accessibility controls
   remain findable in Focus Mode.
5. A user can switch between Focus Mode and Workspace Mode without data loss,
   route breakage, or permission changes.
6. Mode state is keyboard accessible and correctly announced by assistive
   technology.
7. Existing unit, integration, accessibility, and performance tests pass.
8. A usability evaluation shows improved first-task success without a
   material regression in advanced-feature discovery for existing users.

## Open questions for user research

These questions should be answered with real users before making the mode
behavior permanent:

- Do users understand "Now" without an explanation, or is "Next action" more
  immediately legible?
- Which fields do users expect during initial capture: due date, priority,
  notes, tags, or none of these?
- Do users interpret "Planning tools" as useful depth or as an intimidating
  expert area?
- Which advanced feature is most often needed unexpectedly: sharing,
  dependencies, attachments, reminders, or search?
- Do users want the mode preference to follow their account across devices?
- Does the amber/ink public visual identity carry into the product, or should
  the app keep its own established theme system?

Until these questions are tested, Focus Mode should remain a reversible
presentation preference rather than a permanent account tier.