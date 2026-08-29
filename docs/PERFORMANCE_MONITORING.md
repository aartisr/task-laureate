# Performance and Reliability Gates

This document defines measurable quality gates for performance, reliability, and production safety.

## 1) Quality gate philosophy

Quality is enforced by automation, not intention.

Every change should pass:

1. Build and type-safety gate
2. Test gate
3. Production config gate
4. Performance budget gate
5. Dependency security gate

## 2) CI gates in this repository

The canonical CI workflow is [/.github/workflows/quality.yml](../.github/workflows/quality.yml).

It runs two jobs:

1. `verify`
2. `security`

### Verify job

Runs:

- `npm ci --include=dev --include=optional`
- `npm run quality:gate`

`quality:gate` expands to:

- `npm run verify:production`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run check:perf-budgets`

### Security job

Runs:

- `npm ci --include=optional`
- `npm run check:security`

`check:security` executes:

- `npm audit --omit=dev --audit-level=high`

## 3) Performance budgets

Performance budgets are validated by [apps/web/scripts/check-performance-budgets.mjs](../apps/web/scripts/check-performance-budgets.mjs).

Current thresholds:

- Main JS bundle (`index-*.js`) <= `380 KB`
- Main CSS bundle (`index-*.css`) <= `180 KB`
- Total JS bundles <= `900 KB`
- Total CSS bundles <= `260 KB`
- Total asset count <= `140 files`

Why total JS is `900 KB`:

- CI and production builds resolve the real `posthog-js` package (instead of the local no-op fallback), which emits a dedicated analytics chunk.
- That chunk is intentional production functionality, so the budget is calibrated to include it while still protecting against accidental regressions.

If any threshold is exceeded, CI fails.

## 4) Local commands

From repository root:

```bash
npm run quality:gate
npm run check:security
```

From web workspace:

```bash
cd apps/web
npm run build
npm run check:perf-budgets
```

## 5) Performance operating model

When a budget fails:

1. Identify which threshold failed.
2. Find the largest changed artifacts in `dist/assets`.
3. Classify cause:
   - new dependency
   - route-level growth
   - accidental eager import
   - CSS growth
4. Apply one or more fixes:
   - route-level code splitting
   - lazy-load heavy feature modules
   - remove dead code and unused dependencies
   - move infrequently used logic out of startup path
5. Re-run `npm run quality:gate`.

## 6) SLO starter set (recommended)

Adopt these initial user-facing objectives:

- P95 route transition ready state < `800 ms` on production baseline
- P95 list/task mutation round-trip < `500 ms`
- UI availability during deploy windows >= `99.9%`
- Error rate for critical mutations < `1%`

These SLOs should be tracked in monitoring infrastructure and reviewed each release cycle.

## 7) Design constraints that protect performance

1. Keep feature modules vendor-neutral and lazy-loadable.
2. Keep analytics and delivery channels non-blocking to product workflows.
3. Keep query invalidation scoped by precise keys.
4. Keep local state and cache updates deterministic and minimal.
5. Keep expensive rendering paths memoized and route-split.

## 8) Definition of production-ready for performance

A change is production-ready only when:

1. CI gates are green.
2. No budget regression is introduced.
3. Critical UX paths remain responsive under expected load.
4. Rollback path is documented and tested.

