# Operations

Production deployment uses Vercel with `apps/web` as the project Root Directory.
The release contract checks configuration, PWA assets, service-worker headers,
tests, build output, and performance budgets before deployment.

## Before a release

```sh
npm run quality:gate
```

Confirm pending Supabase migrations, production environment variables,
authentication redirect URLs, and real-device PWA installation. Never put
server-only credentials in `VITE_*` variables.

## Canonical runbooks

- [Production Operations](https://github.com/aartisr/task-laureate/blob/master/docs/OPERATIONS.md)
- [PWA release and installation](https://github.com/aartisr/task-laureate/blob/master/docs/PWA_RELEASE_AND_INSTALL_GUIDE.md)
- [QA and production readiness](https://github.com/aartisr/task-laureate/blob/master/docs/QA_AND_PRODUCTION_READINESS.md)

← [Wiki home](Home) · [Architecture](Architecture)
