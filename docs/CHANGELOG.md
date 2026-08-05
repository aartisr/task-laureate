# Changelog

## Unreleased

### Growth foundation

- Added an interactive, non-persistent sample workspace at `/sample` so visitors can evaluate the core interaction before creating an account.
- Consolidated public defaults on `https://tasks.ai-aarti.com`; deployments can set `VITE_PUBLIC_SITE_URL` to use their own canonical origin at runtime.
- Added a privacy-preserving growth-event adapter. It permits only allow-listed scalar properties and never accepts task content, emails, IDs, or tokens. Configure `VITE_GROWTH_ANALYTICS_ENDPOINT` only when an approved analytics collector is available.
- Added lifecycle events for landing/sample visits, sign-in completion, and sync failures. Analytics failures cannot block task workflows.

### Honest limits

- The sample is intentionally not a saved workspace; closing or refreshing it can discard its state.
- Analytics instrumentation is included, but no external collector is configured by default. Retention and activation measurements require an approved endpoint and a privacy review.
