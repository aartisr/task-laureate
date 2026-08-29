# Collaboration

Collaboration is designed for clear ownership and intentional sharing—not for broadcasting every personal task by default.

## Roles in plain language

| Role | What it means |
| --- | --- |
| **Owner** | Controls the list, sharing, and collaboration boundary. |
| **Editor** | Can contribute to authorized shared work. |
| **Viewer** | Can see shared work without editing authority. |

The database enforces access with authorization predicates and Row Level Security. Interface controls explain permissions, but the database—not a button—is the security boundary.

## Sharing safely

1. Share only the list relevant to the collaboration.
2. Confirm the invited person’s account and intended role.
3. Use activity and shared-work views to understand what changed.
4. Revoke access when the collaboration ends.

Dependencies represent real prerequisites and can prevent premature completion. Attachments stay private to authorized collaborators; do not use them to share secrets.

Read [Task dependencies](https://github.com/aartisr/task-laureate/blob/master/docs/TASK_DEPENDENCIES.md) and [Task attachments](https://github.com/aartisr/task-laureate/blob/master/docs/TASK_ATTACHMENTS.md) for the complete model.

← [Wiki home](Home) · [Privacy & Security](Privacy-and-Security) · [Architecture](Architecture)
