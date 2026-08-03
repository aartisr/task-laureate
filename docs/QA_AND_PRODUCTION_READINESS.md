# Quality and production readiness

## Automated gate

Run these from the repository root before release:

```bash
npm run verify:production
npm run lint
npm test
npm run build
```

`verify:production` validates the committed Vercel configuration, public npm registry, SPA routing contract, cron entry point, and required repository files. `lint` runs TypeScript checking. `test` runs the Vitest suite. `build` type-checks and produces the Vite bundle.

## What automation cannot prove

The local suite cannot confirm your Supabase migrations, RLS deployment, Resend domain, Twilio account, Vercel variables, or cron invocation. Complete the environment-specific release checklist in [OPERATIONS.md](OPERATIONS.md#release-checklist) before calling a deployment ready.

Do not claim coverage percentages, response-time guarantees, provider delivery, or production security posture without measured evidence from the target environment.
