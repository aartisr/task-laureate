# Task Laureate sharing and collaboration research

**Status:** design approved for implementation planning; no product changes in this document  
**Research date:** 2026-08-03  
**Decision in one sentence:** make sharing private, explicit, and resource-scoped: an owner can invite a person to a List or individual Task as **Can update** or **Read-only**; authorization is enforced by the database, never merely by the interface.

## Executive recommendation

The best solution is deliberately smaller than the permission systems in Jira or ClickUp and more understandable than a generic “workspace” model.

Each List and Task is private when created. Its owner may share it with a named person by email, choosing one of two collaborator roles:

| Role | Plain-language label | May do | May not do |
| --- | --- | --- | --- |
| `owner` | Owner | Everything; share, change roles, revoke access, archive/delete, export, transfer ownership | Nothing except actions restricted by product policy |
| `editor` | Can update | Read all granted content; create, edit, reorder, complete, reopen, and delete Tasks in the granted scope | Change ownership; manage access; archive/delete/rename a List; export whole List |
| `viewer` | Read-only | Read granted content, use find-in-note, copy task links | Change tasks, notes, status, order, metadata, or access |

This uses the language people already understand from Google Drive, Figma, Miro, and Dropbox: read versus edit. It does **not** introduce “Commenter,” “Admin,” “Contributor,” or “Full edit” in version one. Those roles solve real later needs, but they make a small task manager harder to trust before comments, teams, and automation exist.

`Can update` must be visibly limited: “Can edit tasks. Cannot change sharing or List settings.” It is not an ambiguous “edit” permission.

## The 15-product research set

This is a pattern study, not a market-share ranking. Every source is first-party product documentation.

| Product | Proven interaction / permission pattern | What Task Laureate should take | What it should avoid |
| --- | --- | --- | --- |
| [Google Drive](https://support.google.com/drive/answer/2494822?hl=en-GB&p=visibility_options) | Viewer, Commenter, Editor; owners can make access restricted or link-based and control download/copy in some modes. | The familiar role vocabulary, direct people picker, clear “People with access” panel, revoke at any time. | Open-link access by default; it is too easy to leak a task list. |
| [Notion](https://www.notion.com/en-gb/help/sharing-and-permissions) | Full access, edit, comment, and view; edit may be deliberately separated from the ability to share. | Separate editing content from managing access. | Multiple roles before the corresponding product capabilities exist. |
| [Asana](https://help.asana.com/s/article/task-permissions?nocache=https%3A%2F%2Fhelp.asana.com%2Fs%2Farticle%2Ftask-permissions%3Flanguage%3Dko) | Project membership and task collaborators can grant access; task roles differ by context and assignment can elevate abilities. | A Task can be shared without exposing every other Task in its List. | Contextual/elevated permissions in v1; people cannot predict them. |
| [ClickUp](https://help.clickup.com/hc/en-us/articles/6309221065495-Permissions-in-detail) | Item, location, and hierarchy permissions; `full edit > edit > comment > view` resolves multi-list access. | Explicitly specify a precedence rule and test it. | A hierarchy of overlapping scope rules; it is powerful but difficult to explain. |
| [Jira](https://support.atlassian.com/jira-software-cloud/docs/manage-how-people-access-your-team-managed-project/) | Private, limited, and open spaces plus Viewer, Member, and Administrator roles; it also supports work-item restrictions. | Private by default and a later, dedicated task exception capability. | Per-action permission matrices for ordinary task sharing. |
| [Figma](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions) | Higher-level access inherits downward; explicit lower-level access can expand a person’s rights for one file. | List access inherits to its Tasks; a specific Task grant can expand access. | Implicit access changes that are not shown in the share panel. |
| [Airtable](https://support.airtable.com/docs/base-permissions) | Owner, editor, commenter, and read-only roles distinguish structural changes from record changes. | Protect List structure and sharing from normal task editors. | Making task editors able to remodel the list itself. |
| [Coda](https://help.coda.io/hc/en-us/articles/39555738876813-Share-your-doc) | View, comment, edit; owners can independently prevent editors from changing permissions or copying. | An owner-controlled “Editors cannot share” default. | Treating sharing as an incidental editor power. |
| [Miro](https://help.miro.com/hc/en-us/articles/360017572194-Board-access-rights) | Can view, comment, or edit; people can request editor rights; owners can withdraw editors’ ability to invite. | A later “Request access” pathway and an owner-only access-management control. | Anonymous edit links for personal tasks. |
| [Trello](https://support.atlassian.com/trello/docs/changing-permissions-on-a-board/) | Board admins, members, observers, and external guests; observer is read-only, optionally commentable. | Use clear external-collaborator language and show pending invitations. | Defaulting normal members to permission-management powers. |
| [Todoist](https://www.todoist.com/help/articles/team-roles-and-access-uGkyLrJQz) | Team admins/members are distinct from project-scoped guests; guests see only projects to which they are invited. | “Shared with me” should be resource-scoped—no accidental view of a person’s entire workspace. | Forcing every invitee into a global team. |
| [monday.com](https://support.monday.com/hc/en-us/articles/31152393208466-Board-permissions-on-Enterprise) | Owner, editor, contributor, assigned contributor, viewer; owners can restrict actions by category. | Future optional “assigned tasks only” access can be valuable. | This level of customization before a user needs it. |
| [Linear](https://linear.app/docs/private-teams) | Private team issues can be shared individually; recipients see a clear banner and cannot expose wider team/project information or reshare. | Task-only shares must visibly say they are task-only and must not reveal other List content. | Hiding the exceptional nature of the share. |
| [GitHub](https://docs.github.com/en/enterprise-cloud%40latest/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization) | A least-privilege role ladder: Read, Triage, Write, Maintain, Admin. | Define permissions as an action matrix, not screenshots or UI checks. | Introducing more roles than the job needs. |
| [Basecamp](https://3.basecamp-help.com/article/75-permissions) | Employee, outside collaborator, and client; clients contribute only to items deliberately shared with them. | External collaborators should see only exactly what they were invited to. | Treating “external” as an inferior account; authorization should be scoped, not cosmetic. |

### Additional evidence relevant to the decision

- Figma’s model makes inheritance intuitive: team/project rights flow down, while an explicit lower-level grant can provide more access to one item. [Figma permissions](https://help.figma.com/hc/en-us/articles/35361119554711-File-and-project-permissions)
- Notion explicitly separates `Can edit` from `Full access`, proving that editing content and changing permissions should not be conflated. [Notion sharing settings](https://www.notion.com/en-gb/help/sharing-and-permissions)
- Google Drive’s documentation makes a crucial caution visible: a complete access picture includes both individual access and general link access. Task Laureate should eliminate that ambiguity in v1 by shipping no open-link sharing. [Google Drive limited access](https://support.google.com/drive/answer/14254362?co=GENIE.Platform%3DDesktop&hl=en)
- Asana’s task-specific collaboration confirms the value of sharing an individual task without granting a project. [Asana task permissions](https://help.asana.com/s/article/task-permissions?nocache=https%3A%2F%2Fhelp.asana.com%2Fs%2Farticle%2Ftask-permissions%3Flanguage%3Dko)

## Product specification

### Scope and inheritance

```text
Private workspace
  └── List
       ├── List collaborator: grants access to every current and future Task
       └── Task
            └── Task collaborator: grants access only to this Task
```

1. Every List and Task starts private to its owner.
2. A List grant applies to all present and future Tasks in that List.
3. A Task grant provides access only to that Task. The recipient sees a **Shared task** experience, not the List’s task index, list description, collaboration roster, or other Tasks.
4. A Task grant may expand access beyond a List grant, never reduce it. There are no “deny” rules in version one.
5. If a person has multiple grants, use the highest role: `owner > editor > viewer`.
6. A task’s owner is the List owner in version one. Do not introduce per-task ownership until a real transfer/use case requires it.
7. Moving a Task to a different List is owner-only in version one. This avoids accidental access expansion or loss.

This rule is intentionally easy to explain in one sentence: **“A shared List includes its tasks. A shared Task stands alone.”**

### What the user sees

#### List sharing

The List header gains a `Share` button and a compact avatar stack. It opens a 560px “People with access” sheet:

```text
Share “Hiring plan”
Only invited people can open this List. Links never grant access by themselves.

[ Name or email address                              ]
 [ Can update ▾ ]  [ Send invite ]

People with access
  You · Owner                                        [Owner]
  Maya Chen · Can update                             [Can update ▾] [Remove]
  sam@example.com · Invited · expires Aug 10         [Resend] [Cancel]

Advanced
  Transfer ownership
  Activity history
```

- `Can update` and `Read-only` are buttons with concise explanatory text below the selector.
- Inviting a known account or an email uses the same flow. The recipient must accept; no access is granted merely because an address was typed.
- Removal takes effect immediately and invalidates future requests. It does not erase the person’s activity history.
- The owner alone can transfer ownership or change access.
- A status line announces success/error to screen readers; controls must be keyboard-operable.

#### Task sharing

The Task Lens overflow menu contains `Share this task`. The sheet says:

> This shares only **[task title]**. People will not see the rest of **[List name]**.

The opened task carries a persistent `Shared task` badge and “Shared by [owner]” label. The recipient gets no list navigation that could be used to infer hidden work.

#### Recipient experience

- An in-app Inbox item and email state who shared what, at which role, and include an **Accept** button.
- The recipient’s sidebar has **Shared with me**, separated into Lists and Tasks.
- Decline is private and does not notify the owner by default; acceptance does.
- A denied deep link shows “You don’t have access” with a safe **Request access** action. It never confirms hidden titles or collaborator names.

### Explicit non-goals for version one

- Anyone-with-link, public, or anonymous access.
- Groups, domain-wide sharing, and workspace membership.
- Comment-only role (add with comments, not before).
- Permission templates and per-field/per-action configuration.
- An editor’s ability to invite, reshare, transfer ownership, or change List settings.
- Permission-deny exceptions.

These can be layered later without changing the meaning of `owner`, `editor`, and `viewer`.

## Current-system finding: a safe implementation requires a data-model migration

Task Laureate currently persists the entire workspace in an owner-only `workspace_snapshots` row whose JSON payload contains all Lists and Tasks. The browser buffers and writes a complete snapshot. Its Supabase policies allow only `owner_id = auth.uid()`.

That design is excellent for a private offline-first workspace, but it is incompatible with collaboration:

- Sharing a List would expose the owner’s entire payload unless the server rewrites it per recipient.
- Two editors saving snapshots can overwrite each other’s unrelated work (“last snapshot wins”).
- RLS cannot safely authorize a List/Task stored inside JSON as a first-class resource.
- A task-only share cannot hide the remaining List when the whole List is embedded in the same payload.

**Therefore: do not loosen the existing `workspace_snapshots` RLS policy and do not share its row.** Normalize shared content into database tables first. This is the security boundary, not an optimization.

## Recommended architecture

### Data model

Keep personal/private workspace snapshots untouched initially. Add a collaborative workspace model with real rows:

```text
workspaces
  id, owner_id, name, created_at, updated_at

lists
  id, workspace_id, owner_id, title, description, lifecycle fields,
  version, created_at, updated_at

tasks
  id, list_id, owner_id, title, note_document, status, priority,
  due_date, tags, order_key, version, created_at, updated_at, deleted_at

list_collaborators
  list_id, user_id, role (editor|viewer), granted_by, created_at, updated_at
  UNIQUE(list_id, user_id)

task_collaborators
  task_id, user_id, role (editor|viewer), granted_by, created_at, updated_at
  UNIQUE(task_id, user_id)

share_invitations
  id, resource_type (list|task), resource_id, email_normalized,
  role, token_digest, status (pending|accepted|declined|revoked|expired),
  invited_by, expires_at, accepted_by, created_at

activity_events
  id, workspace_id, entity_type, entity_id, actor_id, action, metadata, created_at
```

Use separate `list_collaborators` and `task_collaborators` tables instead of one polymorphic resource-member table. It preserves foreign keys, enables indexes, and makes RLS reviewable. `note_document` may retain the current safe rich-note representation; it does not alter the authorization model.

`profiles` should contain only safe display data (display name, avatar). It must not make email addresses enumerable. Invitations retain a normalized email until acceptance; memberships identify the accepted Supabase `user_id`.

### Authorization contract

Authorization must be implemented in Postgres RLS and duplicated only as UI affordances. The browser never decides that someone is allowed to write.

| Operation | Owner | List editor | List viewer | Task editor | Task viewer | Unrelated user |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Read List | Yes | Yes | Yes | No | No | No |
| Read Task in shared List | Yes | Yes | Yes | N/A | N/A | No |
| Read explicitly shared Task | Yes | N/A | N/A | Yes | Yes | No |
| Create/edit/complete/reorder Tasks in shared List | Yes | Yes | No | N/A | N/A | No |
| Edit explicitly shared Task | Yes | N/A | N/A | Yes | No | No |
| Delete Task | Yes | Yes | No | Yes, only when task-only editor | No | No |
| Rename/archive/delete List | Yes | No | No | No | No | No |
| Invite/change/revoke access | Yes | No | No | No | No | No |
| Transfer ownership/export List | Yes | No | No | No | No | No |

The server must reject disallowed mutations even if a stale client rendered an edit control. RLS should separately protect `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; `UPDATE` needs a corresponding `SELECT` policy in Supabase. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)

### RLS design requirements

1. Enable RLS on every exposed table and grant only `authenticated` the minimum SQL privileges.
2. Policy predicates use `auth.uid()` against indexed membership columns.
3. Read Tasks only when the requester owns the List, has a List membership, owns the Task, or has a Task membership.
4. Editors may update only mutable task columns. Enforce owner-only fields and ownership/list movement through RPCs or restrictive update policies/triggers.
5. Direct List access never follows Task membership; task-only sharing must not disclose the List.
6. Do not place authorization in mutable `raw_user_meta_data`; Supabase notes that it is user-changeable. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
7. If helper functions are used, put `SECURITY DEFINER` functions in a non-exposed schema, set a safe `search_path`, and use them only for narrow authorization checks. [Supabase security-definer guidance](https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw)
8. Index `list_collaborators(user_id, list_id)`, `task_collaborators(user_id, task_id)`, `tasks(list_id)`, and invitation lookup fields. RLS performance depends on indexed policy predicates. [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Invitations and acceptance

Create/accept/revoke are server-side commands (Edge Function or tightly scoped RPC), not arbitrary browser table inserts.

1. Owner chooses resource, email, and role.
2. Server verifies ownership, normalizes the address, rate-limits, creates a random one-time token, stores only its digest, and sends an email with an opaque acceptance URL.
3. Existing signed-in recipients must explicitly accept; the acceptance command verifies token, expiry, recipient email, and session, then creates the membership atomically.
4. If the recipient needs an account, use the normal sign-up flow and return to invitation acceptance. Supabase’s administrative user-invitation API requires a trusted server secret and must never run in the browser. [Supabase user invites](https://supabase.com/docs/guides/auth/users)
5. Revoke marks the invitation unusable and deletes the membership in one transaction. Resend rotates the token; it never reuses one.
6. Default expiration: seven days; maximum: thirty days; no permanent bearer links.

### Synchronization and concurrency

For shared content, replace buffered whole-workspace writes with resource-level commands and row versions.

- Every mutable List/Task has `version` and `updated_at`.
- Updates include expected version. A mismatch returns a `409 conflict` with the server copy; the client offers **Reload** or an intentional field-level merge for non-overlapping fields.
- Reordering uses a durable fractional `order_key`, not list-position integers prone to concurrent collisions.
- Subscribe to authorized List/Task changes through Supabase Realtime after RLS is proven. A remote change updates the query cache and shows “Maya updated this task just now”; never silently replace a focused rich-note editor.
- Offline writes enter an outbox. On reconnect they undergo the same server authorization/version checks; revoked access means the operation is discarded with an understandable message.

## Security, privacy, and reliability bar

- Private is the default. The user must take a deliberate action to share.
- Never expose an unscoped “all users” people search. Search only known contacts or invite by exact email.
- Do not return hidden resource names, List metadata, roster, activity, or existence through task-only routes, search, notifications, errors, or Open Graph tags.
- Audit `invite_created`, `invite_resent`, `invite_accepted`, `role_changed`, `access_revoked`, `ownership_transferred`, and privileged content operations.
- Preserve audit events after revocation, but redact personal data under a documented retention policy.
- Rate-limit invitations, access requests, and acceptance attempts; record IP/device telemetry only in accordance with privacy policy.
- Validate authorization at the storage layer and in APIs. UI hiding is a usability feature, not a security control.
- Treat email as invitation delivery/verification data, never as a long-term authorization identity. Membership uses immutable user IDs.
- Email invites are optional notification transport, not access tokens. A copied email URL cannot grant access to a different signed-in account.

## Test plan: proof, not confidence theater

### Database/RLS integration suite

Run every test with real authenticated JWTs for owner, editor, viewer, task-only editor, task-only viewer, and unrelated user.

- Enumeration: unrelated users receive no Lists, Tasks, search results, or count/metadata leakage.
- Read: each role sees exactly the resource allowed; task-only access cannot query its List or sibling Tasks.
- Write: viewers cannot mutate any column; editors cannot mutate ownership/access/List structure; owners can.
- Escalation: an editor cannot insert collaborator rows, alter roles, accept another person’s invite, or change `owner_id`, `list_id`, or `version` unexpectedly.
- Revocation: access ends immediately for direct query, Realtime subscription, cached route refresh, and queued offline mutation.
- Invitations: expired, replayed, revoked, forged, email-mismatched, and account-switched tokens fail safely.
- Concurrency: simultaneous edits, task move attempt, reorder collision, and stale version are deterministic.
- Rich content: existing HTML sanitization tests remain active for content visible to collaborators.

### UX and accessibility suite

- Keyboard invite, role selection, remove/revoke confirmation, and escape/focus restoration.
- Screen-reader text names role and scope: “Maya Chen, Can update this List.”
- Mobile sharing sheet has no horizontally hidden action controls.
- Shared task labels remain persistent while navigating and are present in exported/printed access-aware views.
- Permission-change events invalidate cached routes and hide now-inaccessible content without a confusing blank state.

## Phased delivery plan

### Phase 0 — foundation and migration rehearsal

1. Define repository interfaces for lists/tasks/memberships that do not reveal persistence details.
2. Add normalized tables, indexes, triggers/RPCs, and RLS to a development Supabase project.
3. Write the RLS integration suite before enabling any UI.
4. Build an idempotent migration that converts a private snapshot into one owner workspace with normalized Lists/Tasks.
5. Dual-read and verify counts/checksums; do not delete snapshots until verified backups and rollback are complete.

### Phase 1 — List sharing

1. Owner/editor/viewer policy and owner-only invitation UI.
2. Explicit email invitations and acceptance.
3. Shared with me, audit events, revocation, real-time refresh.
4. No open links and no task-level exceptions yet.

### Phase 2 — Task-only sharing

1. Add `task_collaborators` and isolated shared-task route.
2. Prove no List/sibling disclosure with RLS and route/search tests.
3. Add clear shared-task visual treatment.

### Phase 3 — collaboration quality

1. Conflict UI, offline outbox, presence/recent changes.
2. Comments and then an optional `commenter` role.
3. Groups, managed workspaces, expiration, and owner-approved access requests only when supported by real user demand.

## Final recommendation

Ship **private-by-default direct sharing**, one owner, and only two collaborator choices: **Can update** and **Read-only**. Share Lists first; share individual Tasks second. Keep access management owner-only.

That is more useful than a simplistic public link, safer than client-side checks, and more humane than a 40-toggle permission matrix. It gives users an answer they can trust before they press Send: **who can see this, what can they change, and who remains in control.**
