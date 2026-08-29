# Puck editor guide

The application uses Puck as the visual editing surface for page content. The
editor is available at `/puck/dashboard`; choose another routed page from the
page selector.

## Open the editor

1. Start the web application from the repository root:

   ```bash
   npm run dev
   ```

2. Open [http://localhost:5173/puck/dashboard](http://localhost:5173/puck/dashboard).

3. Use the **Page** selector at the top of the editor to switch the application
   surface you want to edit. You can also navigate directly to a page, for
   example `/puck/settings` or `/puck/tasks`.

4. Drag blocks from the left panel, select a block to change its fields in the
   right panel, then choose **Publish**. The preview updates immediately.

Published content is currently saved only in the browser that made the change.
Use **Restore defaults** to discard that browser-local draft. Server-backed,
multi-user publishing is intentionally not enabled yet.

## Editing boundary

Route components live exclusively in `apps/web/src/pages`, and the TanStack
route tree in `apps/web/src/app/router.tsx` is their only production entry
point. Puck does not own a parallel page implementation: `PuckEditorPage`,
`core/puck/config.tsx`, and `infrastructure/puckContent.ts` are the complete
editor integration boundary.

Puck owns editorial content and layout blocks: headings, descriptions, calls to
action, explanatory text, and presentational card content. Application modules
own live data, permission decisions, queries, and mutations. This separation is
intentional: it lets non-developers edit safely without making data behaviour or
authorization draggable content.

## Maintainer workflow

When adding a page:

1. Add its stable ID to `core/puck/types.ts`.
2. Add its name, path, and default content in `core/puck/config.tsx`.
3. Use existing Puck blocks before creating a new one.
4. If a new visual block is necessary, define its typed props, renderer, fields,
   defaults, and migration strategy together in `core/puck/config.tsx`.
5. Keep data-fetching components independent of Puck and pass only display-safe
   data into them.

Puck configuration is deliberately centralized. Do not copy component schemas
into individual pages or depend on Puck types from the task domain.

## Design patterns in use

- **Registry pattern:** `puckConfig` is the single registry for component
  schemas and renderers; component names are never repeated across pages.
- **Adapter pattern:** `infrastructure/puckContent.ts` isolates browser storage
  and Puck's transport format from the application content model. Replace this
  adapter—not page code—when production persistence is introduced.
- **Repository boundary:** callers use `getPageContent`, `savePageContent`, and
  `resetPageContent`; storage implementation details remain private.
- **Observer pattern:** `subscribeToPuckContent` and `useSyncExternalStore`
  publish saved content to every active preview without prop drilling.
- **Single source of truth:** `puckPageIds` and `defaultPageContents` define
  the editable surfaces, defaults, paths, and editor navigation in one place.
- **Dependency inversion:** task domain code has no dependency on Puck. The
  visual editor is an outer-layer concern that can be upgraded or removed
  without changing task workflows.
- **Fail-safe defaults:** corrupt or unavailable local drafts fall back to the
  version-controlled page defaults rather than breaking the application.

## Content lifecycle

Editor publication currently saves a versioned draft in browser local storage.
This allows safe editorial iteration without affecting other users or requiring
credentials. A production publisher should replace the storage adapter with a
server-side, RLS-protected content repository that supports revision numbers,
draft/published states, audit history, and optimistic concurrency.

## Safety rules

- Never expose secrets, OAuth settings, permissions, or business rules as Puck
  fields.
- Never let editable links bypass the router's safe navigation policy.
- Keep Puck data schema-versioned; create a migration before changing or
  removing a component prop.
- Treat published Puck data as untrusted input and validate it at the
  persistence boundary.
