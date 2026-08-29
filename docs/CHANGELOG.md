# Changelog

## Unreleased

### Voice assistant and mobile capture resilience

- Added an interactive **Voice Assistant** modal with intent parsing and automatic routing to a dedicated **Voice Tasks** list.
- Added iOS Safari dictation error handling for `service-not-allowed` with actionable device setup guidance (*Settings > General > Keyboard > Enable Dictation*).
- Integrated an inline manual command text input fallback inside the voice capture modal to guarantee seamless command entry across all browsers and mobile webviews.
- Added universal global keyboard shortcuts (`⌘T` for quick capture, `⌘F` for search, `⌘H` for dashboard).

### Performance and accessibility compliance

- Implemented virtualized list rendering (`VirtualTaskItems`) for high-frame-rate scrolling on large task collections.
- Audit and fix text, control, and status color tokens across themes (including Sleek Interface) to guarantee 100% WCAG AA contrast ratio compliance (`>= 4.5:1`).
- Optimized TanStack Query caching and mutation outbox sync buffering for sub-millisecond local interaction latency.

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
