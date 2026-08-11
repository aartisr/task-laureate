# Changelog

## Unreleased

### Current task workflow and reference material

- Added clear To do, In progress, Blocked, and Done task states, including a one-click **Start** action and a reversible state control in task details.
- Added private task attachments for accepted images, documents, and text files, with signed previews and Storage-API removal.
- Added required task dependencies with a database-enforced acyclic graph, completion gates, and compact blocked/unblocks signals in task lists.
- Simplified list, all-task, settings, and shortcut surfaces with progressive disclosure so everyday actions stay visible and secondary controls remain available on demand.

### Public discoverability

- Added a compatible PNG social-preview image, refreshed public structured facts and machine-readable summaries, and corrected stale documentation links.
- Added crawl manifests and an AI-readable orientation page to the GitHub Pages product overview.
- Added an ethical launch and discovery playbook for account-owner search verification and distribution work.

### Growth foundation

- Added an interactive, non-persistent sample workspace at `/sample` so visitors can evaluate the core interaction before creating an account.
- Consolidated public defaults on `https://tasks.ai-aarti.com`; deployments can set `VITE_PUBLIC_SITE_URL` to use their own canonical origin at runtime.
- Added a privacy-preserving growth-event adapter. It permits only allow-listed scalar properties and never accepts task content, emails, IDs, or tokens. Configure `VITE_GROWTH_ANALYTICS_ENDPOINT` only when an approved analytics collector is available.
- Added lifecycle events for landing/sample visits, sign-in completion, and sync failures. Analytics failures cannot block task workflows.

### Honest limits

- The sample is intentionally not a saved workspace; closing or refreshing it can discard its state.
- Analytics instrumentation is included, but no external collector is configured by default. Retention and activation measurements require an approved endpoint and a privacy review.
