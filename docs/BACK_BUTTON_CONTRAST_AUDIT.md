# Back Button Contrast Audit

## Scope

Audit date: 2026-08-23

This audit covers every back-navigation control in the application source,
including utility pages using `PageContainer`, task focus, list detail, loading
states, and not-found states.

## Finding and fix

List detail previously used raw `text-blue-600` and `text-blue-800` classes.
Those colors were not part of the theme contract and could have poor contrast
against the product themes. Task focus also had a separate back-button style.

All actual back-navigation controls now use the shared `page-back-button`
pattern, either directly or through `.page-container__back a`:

- Theme-aware action foreground: `var(--color-action-primary)`
- Theme-aware surface: `var(--color-bg-secondary)` with an action tint
- Visible border and hover state
- Minimum 44px block size
- Consistent keyboard focus outline
- Underline on hover for an additional non-color affordance

The remaining `text-blue-*` occurrence in `global.css` is a legacy utility
compatibility mapping for unrelated existing content. No back-navigation
component uses those classes.

## Source audit result

- `Back to Dashboard` occurrences: all use `page-back-button`.
- Task focus back control: uses `page-back-button`.
- Utility-page back links: use the shared `page-container__back` style.
- Raw blue back-button classes: none.
- Back controls have a visible focus style: yes.
- Back controls have a minimum 44px target: yes.

## Validation

- Production build: passed.
- Full test suite: passed.
- `git diff --check`: passed.
- Source back-link audit: passed.

## Maintenance rule

New back-navigation controls must use `page-back-button` or `PageContainer`
with its `backButton` prop. Do not add page-specific color utilities to back
controls.

## Related contrast rule

Descriptions for tasks and lists, selected-task content, and task-detail
summaries use `var(--color-text-primary)` through the central global theme
stylesheet. Components provide semantic class names; they do not own competing
contrast values. Ordinary list metadata may remain secondary text, but content
descriptions must not become harder to read against a highlighted surface.

Rendered rich task descriptions use dedicated theme-aware reader selectors in
the same central stylesheet for
body text, headings, links, code blocks, and the outline. This prevents
browser-default text colors from leaking into dark or custom themes.

Editable list descriptions also reset native button chrome explicitly; they use
an intentional transparent/theme surface, readable primary text, and a visible
focus treatment instead of inheriting a browser-default dark button background.