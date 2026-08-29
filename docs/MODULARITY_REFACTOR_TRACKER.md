# Modularity refactor tracker

This tracker keeps the refactor incremental: each slice must type-check and
pass the web test suite before the next slice changes behavior.

| Slice | Status | Safety gate |
| --- | --- | --- |
| Dependency ports and query-key ownership | Complete | TypeScript and web tests |
| Shared list, status, and progress UI | Complete | TypeScript; full suite at final checkpoint |
| Reporting aggregate read | Complete | Repository contract, bounded Supabase RPC, TypeScript and web tests |
| Puck route ownership boundary | Complete | Router/import audit; obsolete parallel pages removed |
| Stylesheet responsibility split | Complete | List card, favorite, status, progress, and shared List-share styles are component-owned; TypeScript and web tests |

## Refactor rules retained for future work

1. Preserve current route contracts and CSS class names during component extraction.
2. Add optional repository capabilities with explicit feature detection; local-first adapters remain valid.
3. Keep server reads bounded and return a truncation signal instead of silently omitting data.
4. Move styles by responsibility only after the component contract is stable; do not combine a visual redesign with a CSS relocation.
