# Laureate Code Snippets

Use this page as the entry point for practical, copy-paste-ready patterns.

## Start here

- [Pages and data patterns](CODE_SNIPPETS_PAGES_AND_DATA.md)
- [Mutations and keyboard patterns](CODE_SNIPPETS_MUTATIONS_AND_KEYBOARD.md)
- [Layouts, themes, and accessibility patterns](CODE_SNIPPETS_LAYOUT_THEME_A11Y.md)
- [Testing patterns and anti-pattern fixes](CODE_SNIPPETS_TESTING_AND_ANTI_PATTERNS.md)

## How to use these snippets

1. Copy the smallest matching snippet.
2. Replace repository/query keys/types first.
3. Keep the structure (query boundary, state transitions, semantic markup).
4. Add tests for each new pattern usage.

## Snippet quality rules

- Prefer `useSuspenseQuery` for route/page data.
- Keep data fetching in hooks, not inside ad hoc component effects.
- Use design tokens (`--color-*`) instead of hardcoded colors.
- Keep keyboard/focus accessibility in every interactive component.
- Keep mutation side effects isolated and testable.
