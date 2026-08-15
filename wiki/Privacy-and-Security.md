# Privacy & Security

Task-Laureate is designed around clear data boundaries rather than opaque
claims. The browser uses an authenticated Supabase session; authorization is
enforced by Postgres Row Level Security (RLS), not by a UI-only permission
check.

## What stays protected

- Workspace data is scoped to the signed-in account and authorized collaborators.
- Private attachments use protected storage and authorization-aware metadata.
- Server-only credentials for delivery providers and integrations do not belong
  in browser `VITE_*` environment variables.
- Optional analytics and browser notifications require explicit configuration or
  permission.

## Responsible use of AI preview

The restricted task-decomposition preview is opt-in. It proposes editable steps
and does not change a task automatically. Do not put sensitive identifiers in
preview text.

## Learn more or get help

- [Privacy page](https://tasks.ai-aarti.com/privacy)
- [Production security and reliability guardrails](https://github.com/aartisr/task-laureate/blob/master/docs/OPERATIONS.md#7-security-and-reliability-guardrails)
- [Support](https://tasks.ai-aarti.com/support)

← [Wiki home](Home) · [Architecture](Architecture) · [Reliability & PWA](Reliability-and-PWA)
