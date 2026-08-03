# Architecture guide

## Boundaries

```text
React pages/components
  -> domain contracts and mutation hooks
  -> TodoRepository / CollaborationRepository capabilities
  -> Supabase persistence and collaboration gateways
  -> Supabase Auth + PostgREST/RPC with RLS

Vercel functions
  -> server-only provider adapters (Resend, Twilio, Web Push)
  -> Supabase service-role queue operations
```

The repository contracts in `apps/web/src/core/contracts` keep UI features independent of the current data store. `infrastructure/persistence` maps those contracts to authenticated Supabase requests. Collaboration authorization lives in Postgres predicates, RLS policies, and narrowly scoped RPCs; client-side role checks prevent confusing affordances but are not security controls.

## Design rules

1. Keep domain types and capability contracts free of framework or transport details.
2. Compose concrete implementations at `src/config/persistence.config.ts` and `src/app/runtime` rather than importing providers throughout UI code.
3. Make server functions thin orchestration layers. Delivery providers return normalized outcomes, while the database owns idempotency and audit state.
4. Treat migrations as the database API. New mutations use an RPC when a direct table write could bypass a business invariant.
5. Use opaque cursors and bounded reads for large lists; do not reintroduce whole-workspace fetches in scalable views.
6. Make UI state explicit: loading, read-only, saving, success, and recoverable failure states must not be conflated.

## Extension points

- Add a persistence backend by implementing the repository contracts, then replace the composition-root adapter.
- Add a delivery vendor by implementing the normalized adapter shape in `apps/web/api/notifications/providers.mjs`; do not leak provider semantics into the scheduler or UI.
- Add a new reminder channel by extending the database channel constraint, queue claim, provider adapter, and recipient consent control together.
- Add a collaboration permission only after updating the Postgres authorization predicate, RLS policy, RPC boundary, client capability, and tests as one change.

See [OPERATIONS.md](OPERATIONS.md) for environment configuration and [QUICK_FEATURE_GUIDE.md](QUICK_FEATURE_GUIDE.md) for visible behavior.
