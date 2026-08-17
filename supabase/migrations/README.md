# Supabase migration history

The numbered SQL files are an **append-only production ledger**, not a folder
of source files to merge or rename. Supabase records each applied version for
every environment. Rewriting, deleting, or renumbering an existing file would
make a fresh database differ from production and can cause later deployments
to skip required changes.

## Current delivery contract

- Apply `001` through `045` in numeric order for a new environment.
- Existing environments apply only versions that are still pending.
- Use the protected **Apply Supabase migrations** GitHub workflow for
  production. Do not paste a combined historical script into the SQL Editor.
- A `notify pgrst, 'reload schema'` statement is included where an RPC contract
  changes; keep it with the migration that changes that contract.

## Logical map

| Range | Concern | Current authoritative end state |
| --- | --- | --- |
| 001–004 | Legacy workspace and notifications | Historical foundation; `006` retires workspace snapshots. |
| 005–014 | Collaboration Lists, Tasks, sharing, and read APIs | Normalized collaboration model and access boundaries. |
| 015–025 | Assignments, reminders, attachments, and dependencies | `044` is the current owner-read policy repair for reminders. |
| 026–033 | Capture, execution planning, AI, calendar, and offline delivery | Durable task-delivery and scheduling capabilities. |
| 034–045 | Sharing reliability and collaboration operations | `042` is the authoritative collaborator-roster RPC; `043` indexes Lists shared by the owner; `045` is the current status-request RPC repair. |

## Future baseline squash

Once all supported production environments have reached `045`, create a
separate, versioned **baseline** from a verified schema dump in a new
environment. Keep this ledger unchanged for existing environments. The
baseline must be replayed and linted in CI before it becomes the day-zero
setup path; it is not a replacement for pending production migrations.
