# Release Playbook

This page explains how a code change becomes a trustworthy public release.

## Before merging

1. Keep the change focused and update user-facing documentation.
2. Run `npm run quality:gate`.
3. Review security boundaries: credentials, RLS, private attachments, provider calls, and authorization changes.
4. Test the changed journey with the smallest realistic reproduction.

## Before production

1. Apply required migrations in the documented order.
2. Confirm Vercel production variables and Supabase redirect URLs.
3. Confirm deep-link refresh and critical signed-in flows.
4. For PWA changes, inspect the manifest, worker, icons, and a real iPhone and Android install journey.

## After deployment

1. Test the live application, not only the Vercel build log.
2. Check an existing installed PWA after closing and reopening it, so a waiting worker can activate safely.
3. Watch the error, delivery, and provider surfaces appropriate to the change.
4. Record a concise release note or changelog entry when behavior changed.

The canonical detail is in [Production Operations](https://github.com/aartisr/task-laureate/blob/master/docs/OPERATIONS.md) and [QA and production readiness](https://github.com/aartisr/task-laureate/blob/master/docs/QA_AND_PRODUCTION_READINESS.md).

← [Wiki home](Home) · [Operations](Operations) · [Reliability & PWA](Reliability-and-PWA)
