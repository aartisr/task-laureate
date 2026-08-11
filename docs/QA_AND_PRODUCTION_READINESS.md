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

The local suite cannot confirm your Supabase migrations, RLS deployment, Storage bucket policy, Resend domain, Twilio account, Vercel variables, or cron invocation. Complete the environment-specific [release runbook](OPERATIONS.md#3-release-runbook-every-deployment) before calling a deployment ready.

For the current collaboration model, manually prove attachment upload/removal and dependency completion gates with owner, editor, and viewer accounts. For a public release, also confirm the crawl files and social-preview image listed in [the launch playbook](LAUNCH_AND_DISCOVERY_PLAYBOOK.md).

Do not claim coverage percentages, response-time guarantees, provider delivery, or production security posture without measured evidence from the target environment.
