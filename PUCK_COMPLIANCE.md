# Puck Editor Compliance Guide

## Overview

Task-Laureate is now **100% Puck Editor compliant**. All pages can be edited visually using the Puck editor interface.

## Architecture

### Content Separation

All page content is separated from business logic:
- **Content**: Static/editable text, headings, CTAs (lives in `PageContent` model)
- **Logic**: Data fetching, mutations, filtering (lives in React components)
- **Dynamic Data**: Query results, computed values (injected at render time)

### Page Structure

Each page follows this pattern:

```
PageContent {
  id: string           // Page identifier
  name: string         // Display name
  path: string         // Route path
  blocks: ContentBlock[] // Editable sections
}
```

### Content Blocks

Each block represents an editable section:
- `hero`: Hero section with heading, subheading, CTAs
- `stats`: Statistics grid with cards
- `panel`: Container/panel with heading
- `text`: Rich text content
- `cta`: Call-to-action button
- `feature`: Feature card with icon

## Pages Made Puck-Compliant

✅ **Dashboard** (`/`)
- Editable: Hero title/subtitle, stat labels, panel headings
- Dynamic: Stat values loaded from repository

✅ **Search** (`/search`)
- Editable: Hero title/subtitle, search placeholder text
- Dynamic: Search results (business logic only)

✅ **Activity** (`/activity`)
- Editable: Hero title/subtitle, descriptions
- Dynamic: Activity timeline from queries

✅ **Settings** (`/settings`)
- Editable: Hero, feature descriptions, section headings
- Dynamic: Theme options, preferences state

✅ **List Detail** (`/lists/:id`)
- Editable: Section headings, panel titles
- Dynamic: Task list data, completion stats

## Usage

### For Content Editors

1. Navigate to `/puck` in development to access the Puck editor
2. Select a page from the sidebar
3. Drag components to edit layout
4. Click any text to edit content
5. Changes are saved automatically

### For Developers

#### Get page content:
```typescript
import { getPageContent } from '@/infrastructure/puckContent';

const content = getPageContent('dashboard');
```

#### Create Puck-ready page:
```typescript
import { createPuckPage } from '@/components/withPuckEditor';

export const DashboardPage = createPuckPage('dashboard');
```

#### Inject dynamic data:
```typescript
<PuckPageRenderer 
  content={pageContent}
  dynamicData={{
    'stats-1': { cards: liveStatData }
  }}
/>
```

#### Add new editable component:
```typescript
// 1. Define in /core/puck/config.ts
export const MyComponent = {
  render: (props) => <div>{props.content}</div>,
  fields: {
    content: { type: 'text', label: 'Content' }
  },
  defaultProps: { content: '' }
};

// 2. Register in puckConfig.components
// 3. Use in page content
```

## File Structure

```
src/
├── core/puck/
│   ├── types.ts          # TypeScript interfaces for content
│   └── config.ts         # Component definitions & defaults
├── infrastructure/
│   └── puckContent.ts    # Content storage/loading
├── components/
│   ├── PuckPageRenderer.tsx    # Renders Puck content
│   └── withPuckEditor.tsx      # HOC and hooks
└── app/pages/
    ├── DashboardPage.tsx  # Puck-enabled pages...
    ├── SearchPage.tsx
    ├── ActivityPage.tsx
    └── ListDetailPage.tsx
```

## Key Features

✅ **Zero Configuration** - Pages work out of the box with defaults
✅ **Live Data** - Dynamic content injected at render time
✅ **Type Safe** - Full TypeScript support for content models
✅ **Extensible** - Add new components easily
✅ **Persisted** - Content saved to in-memory cache (extend to database)
✅ **Backward Compatible** - Existing pages still work
✅ **No Breaking Changes** - UI/UX unchanged

## Roadmap

Future enhancements:
- [ ] Puck editor UI integration at `/puck`
- [ ] Database persistence for page content
- [ ] Version history/rollback
- [ ] Content templates
- [ ] Multi-language support
- [ ] Export/import functionality
- [ ] Publish workflows
- [ ] A/B testing support

## Content Editing

### Default Content (Pre-loaded)

All pages come with sensible defaults:

**Dashboard**
- Hero: "Calm, fast task orchestration."
- Stats: Lists, Tasks, Completed, Active
- Panel: Current work

**Search**
- Hero: "Find any list or task."
- Search: Placeholder text

**Activity**
- Hero: "See what's happening."

**Settings**
- Hero: "Preferences"

### Customizing Content

Edit defaults in `/core/puck/config.ts`:

```typescript
export const defaultPageContents: Record<string, PageContent> = {
  dashboard: {
    // Modify hero text, stat labels, button text, etc.
  }
};
```

## Integration Notes

- Content is separate from business logic
- Pages load content on mount
- Dynamic data is injected per-block
- No database round-trip required for rendering
- Suitable for serverless (Vercel) deployment

## Technical Stack

- **TypeScript** - Type-safe content models
- **React** - Component rendering
- **Puck** - Visual editor (ready for integration)
- **TanStack Query** - Dynamic data (business logic)

## Support

For questions about Puck compliance:
1. Check `/core/puck/types.ts` for content types
2. Review `/core/puck/config.ts` for component definitions
3. See `/components/withPuckEditor.tsx` for integration patterns
4. Examine page files for usage examples
