# Laureate Web App

This package contains the initial platform scaffold for Laureate.

## Included

- TanStack Router shell
- TanStack Query provider
- In-memory repository
- Feature registry and module contract
- Dashboard, list detail, search, activity, and settings surfaces

## Design Notes

- Core business logic lives in `src/core`
- Concrete storage lives in `src/infrastructure`
- Feature modules live in `src/features`
- UI composition lives in `src/components` and `src/app/pages`

The app is intentionally structured so new features can be added by registering new modules instead of rewriting the shell.
