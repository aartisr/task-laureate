# Sharing implementation status

Tracks implementation of the approved [sharing research blueprint](SHARING_AND_COLLABORATION_RESEARCH.md).

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Reusable role vocabulary, permission policy, and tests | Complete |
| 2 | Normalized Supabase tables, RLS, invite lifecycle | Complete in code; remote reset migration requires verification |
| 3 | Accessible sharing UX | List sharing panel is active with normalized persistence; Task panel and “Shared with me” navigation remain pending |
| 4 | Normalized collaborative persistence | Complete in code; remote reset migration requires verification |
| 5 | Real-time updates, audit timeline, task-level sharing surface, and production verification | Pending |

## Non-negotiable safety gates

- The legacy `workspace_snapshots` table is never shared; migration 006 drops it as part of the approved reset.
- UI permission checks are not treated as authorization; RLS/API checks enforce every operation.
- Invitation tokens are opaque, one-time, expiry-bound, and stored only as digests.
- No “anyone with link” sharing is introduced.

## Delivered in this change

- A transport-agnostic role and authorization domain with owner/editor/viewer precedence tests.
- Normalized collaboration tables, row-level policies, narrowly scoped `SECURITY DEFINER` RPCs, email-bound one-time invitation acceptance, revocation, and token-digest storage.
- A reusable, keyboard-accessible sharing panel with role explanations, pending invitations, copy-link feedback, and revocation.
- A small HTTP gateway with injected transport for tests; it never persists the raw acceptance token.

## Activation status

The legacy snapshot adapter is now replaced in the application composition root by normalized collaboration persistence. Migration `006_switch_to_collaboration_persistence.sql` is intentionally destructive: it drops only `workspace_snapshots`, preserves authentication accounts, and creates a normalized workspace on first use. The remote migration must be confirmed before release.
