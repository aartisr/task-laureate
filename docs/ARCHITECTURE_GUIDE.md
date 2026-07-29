# Laureate Architecture Guide - Separation of Concerns

**Date:** July 2026  
**Status:** Current Architecture  
**Focus:** Clean separation of concerns and reusability across all pages

---

## Overview

Laureate follows a **layered, component-based architecture** that separates concerns into distinct layers:

```
┌─────────────────────────────────────────────────────┐
│  Pages (Route Handlers)                             │
│  - Handle route params, navigation                  │
│  - Compose layouts and components                   │
├─────────────────────────────────────────────────────┤
│  Hooks (Business Logic)                             │
│  - Data fetching (useDataQuery, useSuspenseQuery)   │
│  - Mutations (useListMutations, useTaskMutations)   │
│  - Navigation (usePageNav)                          │
├─────────────────────────────────────────────────────┤
│  Components (UI)                                    │
│  - Layouts (PageContainer, Grid, Card, Section)    │
│  - States (LoadingState, EmptyState, ErrorState)   │
│  - Domain (TaskList, TaskItem, SearchBar)          │
├─────────────────────────────────────────────────────┤
│  Core (Domain Logic)                                │
│  - Contracts (interfaces for type safety)          │
│  - Mutations (business logic)                       │
│  - Repository (data access)                         │
├─────────────────────────────────────────────────────┤
│  Infrastructure (External Services)                │
│  - Mock repository (in-browser)                     │
│  - Query client setup                               │
│  - Theme system                                     │
└─────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. Pages Layer (`/src/pages`)

**Responsibility:** Route handlers, page composition  
**Does:**
- Accept route parameters and repository as props
- Use hooks for data fetching and mutations
- Compose layout and UI components
- Handle page-level navigation

**Should NOT:**
- ❌ Make direct API calls
- ❌ Duplicate logic from other pages
- ❌ Handle styling concerns (use components)
- ❌ Mix business logic with UI logic

**Example:**
```tsx
export function SearchPage({ repository }: SearchPageProps) {
  // 1. Use hooks for logic
  usePageNav({ onEscapeGoBack: true });
  const { data: results } = useQuery(...);

  // 2. Compose components with data
  return (
    <PageContainer title="Search">
      {results.length > 0 ? (
        <ResultsList results={results} />
      ) : (
        <EmptyState title="No results" />
      )}
    </PageContainer>
  );
}
```

### 2. Hooks Layer (`/src/hooks`)

**Responsibility:** Reusable business logic and state management  
**Does:**
- Query data with consistent patterns
- Manage mutations and side effects
- Handle keyboard navigation
- Compose multiple data sources

**Generic Hooks:**
- `usePageNav()` - Escape key to go back, navigation
- `useDataQuery()` - Consistent data fetching
- `useOptionalQuery()` - Conditional queries
- `useKeyboardShortcuts()` - Page-wide shortcuts
- `useComposedQueries()` - Multiple data sources

**Domain Hooks:**
- `useListMutations()` - List CRUD operations
- `useTaskMutations()` - Task CRUD operations
- `useQueryStates()` - Dashboard query composition

**Should NOT:**
- ❌ Return JSX or components
- ❌ Import UI libraries directly
- ❌ Handle styling

**Example:**
```tsx
export function usePageNav({ onEscapeGoBack = true, escapeBackTo = '/' }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate({ to: escapeBackTo });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, escapeBackTo, onEscapeGoBack]);
}
```

### 3. Components Layer (`/src/components`)

**Responsibility:** Reusable UI building blocks  
**Organized by type:**

#### Layouts (`/layouts`)
- `PageContainer` - Generic page wrapper
- `Card`, `Grid`, `Section` - Layout primitives
- `LoadingState`, `EmptyState`, `ErrorState` - State displays

#### Domain (`/domain-specific`)
- `TaskList`, `TaskItem` - Task-specific UI
- `SearchBar` - Search interface
- `ActivityTimeline` - Activity display

#### Generic (`/`)
- `AppShell` - App wrapper
- `StatusPill` - Status display
- `StatCard` - Statistic card

**Should:**
- ✅ Accept props for data and callbacks
- ✅ Be small and focused
- ✅ Use CSS variables for theming
- ✅ Be fully keyboard accessible
- ✅ Include accessibility attributes

**Should NOT:**
- ❌ Manage global state
- ❌ Make API calls
- ❌ Handle navigation (pass callbacks instead)

**Example:**
```tsx
export function Card({ children, onClick, variant = 'default' }) {
  return (
    <article
      onClick={onClick}
      className={`rounded-lg p-6 ${variantClasses}`}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </article>
  );
}
```

### 4. Core Layer (`/src/core`)

**Responsibility:** Domain logic and contracts  
**Contains:**

- `contracts/` - TypeScript interfaces
  - `domain.ts` - Data models (TodoItem, TodoList, etc.)
  - `repository.ts` - Data access interface
  - `queryKeys.ts` - React Query key factory
  
- `mutations/` - Business logic
  - `useTodoMutations.ts` - Todo CRUD with optimistic updates
  - `useListMutations.ts` - List operations
  - `useTaskMutations.ts` - Task operations
  
- `registry/` - Feature registry
  - `featureRegistry.ts` - Feature definitions
  
- `themes/` - Theming system
  - `themes.ts` - Theme definitions
  - `ThemeProvider.tsx` - Context provider
  
- `domain/` - Pure business logic
  - `logic.ts` - Business rules
  - `format.ts` - Data formatting

**Should NOT:**
- ❌ Import React components
- ❌ Handle UI rendering
- ❌ Depend on hooks (except in mutations)

### 5. Infrastructure Layer

**Responsibility:** External services and setup  
**Contains:**

- `infrastructure/mock/` - Mock data and repository
  - `memoryRepository.ts` - In-memory data store
  - `seed.ts` - Initial data
  
- `app/` - App initialization
  - `router.tsx` - Route definitions
  - `providers.tsx` - Context providers

---

## Separation of Concerns Patterns

### Pattern 1: State Management

**Don't mix data fetching with UI:**
```tsx
// ❌ BAD - Mixed concerns
function MyPage() {
  const [loading, setLoading] = useState(false);
  
  const handleFetch = async () => {
    setLoading(true);
    const data = await fetch(...);
    setLoading(false);
  };

  return <div>...</div>;
}
```

**Do separate with hooks:**
```tsx
// ✅ GOOD - Separated concerns
function useMyData() {
  return useSuspenseQuery({
    queryKey: ['data'],
    queryFn: () => repository.getData(),
  });
}

function MyPage() {
  const { data, isLoading } = useMyData();
  return <MyPageUI data={data} isLoading={isLoading} />;
}
```

### Pattern 2: Layout Reuse

**Don't duplicate page structure:**
```tsx
// ❌ BAD - Each page has its own container
function SearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button className="text-blue-600">Back</button>
        <h1>Search</h1>
        {/* Content */}
      </div>
    </div>
  );
}
```

**Do use generic containers:**
```tsx
// ✅ GOOD - Reusable layout
function SearchPage() {
  return (
    <PageContainer title="Search" backButton={{ to: '/' }}>
      {/* Content */}
    </PageContainer>
  );
}
```

### Pattern 3: Keyboard Navigation

**Don't repeat Escape handling:**
```tsx
// ❌ BAD - Duplicated in multiple pages
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      navigate({ to: '/' });
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [navigate]);
```

**Do use generic hook:**
```tsx
// ✅ GOOD - Extracted to reusable hook
usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });
```

### Pattern 4: State Components

**Don't build loading/empty states in each page:**
```tsx
// ❌ BAD - Loading state duplicated
if (isLoading) {
  return <div><p>Loading...</p></div>;
}
if (data.length === 0) {
  return <div><p>No data</p></div>;
}
```

**Do use generic state components:**
```tsx
// ✅ GOOD - Reusable state components
{isLoading && <LoadingState message="Loading data..." />}
{data.length === 0 && <EmptyState title="No data" />}
```

### Pattern 5: Component Composition

**Don't pass everything as props:**
```tsx
// ❌ BAD - Too many props
<TaskList
  tasks={tasks}
  isLoading={isLoading}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
  sortBy={sortBy}
  setSortBy={setSortBy}
  filterBy={filterBy}
  setFilterBy={setFilterBy}
  // ... 20 more props
/>
```

**Do compose smaller components:**
```tsx
// ✅ GOOD - Smaller, focused components
<Section title="Tasks">
  <TaskFilterBar value={filterBy} onChange={setFilterBy} />
  <TaskSortMenu value={sortBy} onChange={setSortBy} />
  <Grid>
    {tasks.map(task => <TaskCard key={task.id} task={task} />)}
  </Grid>
</Section>
```

---

## File Organization

```
src/
├── pages/                          # Route handlers
│   ├── DashboardPage.tsx
│   ├── SearchPage.tsx
│   ├── ActivityPage.tsx
│   ├── ListDetailPage.tsx
│   └── SettingsPage.tsx
│
├── components/                     # UI components
│   ├── layouts/                    # Generic layout components
│   │   ├── PageContainer.tsx       # Page wrapper
│   │   ├── Card.tsx                # Card, Grid, Section
│   │   ├── StateComponents.tsx     # Loading, Empty, Error
│   │   └── index.ts                # Exports
│   │
│   ├── TaskList.tsx                # Task-specific UI
│   ├── TaskItem.tsx
│   ├── SearchBar.tsx
│   ├── ActivityTimeline.tsx
│   └── AppShell.tsx
│
├── hooks/                          # Business logic
│   ├── usePageNav.ts               # Page navigation
│   ├── useDataQuery.ts             # Generic query helpers
│   ├── useKeyboardShortcuts.ts     # Keyboard shortcuts
│   └── useQueryStates.ts           # State composition
│
├── core/                           # Domain logic
│   ├── contracts/                  # Interfaces
│   │   ├── domain.ts
│   │   ├── repository.ts
│   │   └── queryKeys.ts
│   ├── mutations/                  # Business operations
│   │   ├── useTodoMutations.ts
│   │   ├── useListMutations.ts
│   │   └── useTaskMutations.ts
│   ├── domain/                     # Pure logic
│   │   ├── logic.ts
│   │   └── format.ts
│   ├── registry/
│   ├── themes/
│   └── utils/
│
└── infrastructure/                 # External services
    ├── mock/
    │   ├── memoryRepository.ts
    │   └── seed.ts
    ├── app/
    │   ├── router.tsx
    │   └── providers.tsx
    └── lib/
        └── a11y.ts
```

---

## Maintenance Guidelines

### ✅ DO

1. **Keep pages thin** - Pages should mostly compose components
2. **Extract common patterns** - Create new hooks/components when code repeats
3. **Use CSS variables** - All styling via theme system
4. **Type everything** - No `any` types
5. **Document interfaces** - Clear contracts between layers
6. **Test pure functions** - Test domain logic and utilities
7. **Use semantic HTML** - Proper accessibility attributes
8. **Keep components pure** - Same props → same output

### ❌ DON'T

1. **Mix concerns** - Don't fetch data in components
2. **Hardcode values** - Use constants and configs
3. **Duplicate logic** - Extract reusable utilities
4. **Skip types** - Always type explicitly
5. **Ignore accessibility** - ARIA labels required
6. **Create mega-components** - Keep components under 200 lines
7. **Nest too deeply** - Max 2-3 levels of nesting
8. **Global state for page state** - Use React Query for server state

---

## Adding New Features

### 1. Define Contract
Create types in `/src/core/contracts/`:
```typescript
// domain.ts
export interface MyNewThing {
  id: string;
  title: string;
  // ...
}
```

### 2. Implement Repository Method
Add to `TodoRepository` interface:
```typescript
getMyNewThings(): Promise<MyNewThing[]>;
```

### 3. Create Query Keys
Add to `queryKeys.ts`:
```typescript
myThings: {
  all: ['myThings'] as const,
  lists: () => [...queryKeys.myThings.all, 'list'] as const,
  byId: (id: string) => [...queryKeys.myThings.lists(), id] as const,
},
```

### 4. Build Component
Create focused component:
```typescript
// components/MyThingList.tsx
export function MyThingList({ items }: Props) {
  return <Grid>{items.map(item => <Card key={item.id}>{item.title}</Card>)}</Grid>;
}
```

### 5. Wire in Page
Compose in page using existing patterns:
```typescript
function MyPage() {
  const { data } = useSuspenseQuery({
    queryKey: queryKeys.myThings.all,
    queryFn: () => repository.getMyNewThings(),
  });

  return (
    <PageContainer title="My Things">
      <MyThingList items={data} />
    </PageContainer>
  );
}
```

---

## Code Review Checklist

When reviewing code, ensure:

- [ ] Page uses `PageContainer` for layout
- [ ] No data fetching in components
- [ ] Keyboard navigation uses `usePageNav`
- [ ] Loading/empty states use state components
- [ ] All props properly typed
- [ ] No hardcoded colors (use CSS variables)
- [ ] Accessibility attributes present
- [ ] No unnecessary prop drilling
- [ ] Component under 200 lines
- [ ] Reusable logic extracted to hooks

---

## Performance Considerations

### Query Caching
```typescript
// Set appropriate staleTime
useSuspenseQuery({
  queryKey: keys.dashboard,
  queryFn: () => repository.getDashboard(),
  staleTime: 5000, // 5 seconds
});
```

### Component Memoization
```typescript
// Only when necessary
const MyComponent = memo(({ data }) => <div>{data}</div>);
```

### Code Splitting
```typescript
// Route-based code splitting in router
const SearchPage = lazy(() => import('./pages/SearchPage'));
```

---

## Example: Complete Feature

### 1. New Domain Type
```typescript
// core/contracts/domain.ts
export interface Tag {
  id: string;
  name: string;
  color: string;
}
```

### 2. Repository Method
```typescript
// core/contracts/repository.ts
export interface TodoRepository {
  getTags(): Promise<Tag[]>;
  createTag(tag: Omit<Tag, 'id'>): Promise<Tag>;
}
```

### 3. Query Keys
```typescript
// core/contracts/queryKeys.ts
tags: {
  all: ['tags'] as const,
  list: () => [...queryKeys.tags.all, 'list'] as const,
},
```

### 4. Hook for Data
```typescript
// hooks/useTags.ts
export function useTags() {
  return useSuspenseQuery({
    queryKey: queryKeys.tags.list(),
    queryFn: () => repository.getTags(),
  });
}
```

### 5. UI Component
```typescript
// components/TagGrid.tsx
export function TagGrid({ tags }: { tags: Tag[] }) {
  return (
    <Grid columns={6} gap="compact">
      {tags.map(tag => (
        <Card key={tag.id} style={{ backgroundColor: tag.color }}>
          {tag.name}
        </Card>
      ))}
    </Grid>
  );
}
```

### 6. Page Integration
```typescript
// pages/TagsPage.tsx
export function TagsPage({ repository }: Props) {
  const { data: tags } = useTags();

  return (
    <PageContainer title="Tags">
      <TagGrid tags={tags} />
    </PageContainer>
  );
}
```

---

## Summary

**Laureate's architecture achieves:**
- ✅ Clear separation between data, logic, and UI
- ✅ High reusability via generic hooks and components
- ✅ Easy to test (pure functions, separated concerns)
- ✅ Easy to extend (clear patterns to follow)
- ✅ Maintainable (small, focused files)
- ✅ Accessible (proper semantic HTML and ARIA)
- ✅ Performant (optimized query caching, memoization)
- ✅ Type-safe (100% TypeScript coverage)

**Key principle:** Each layer has a single responsibility and knows nothing about layers above it.

---

*For questions on architecture, refer to specific examples in the codebase or these guidelines.*
