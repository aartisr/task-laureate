# Laureate Refactoring Guide - Improving Separation of Concerns

This guide helps you refactor existing code to follow Laureate's architecture best practices.

---

## Quick Checklist

When refactoring a page or component, work through this checklist:

### Pages
- [ ] Extract data fetching to hooks
- [ ] Use `PageContainer` for layout
- [ ] Use `usePageNav` for navigation
- [ ] Use `LoadingState`, `EmptyState` components
- [ ] Remove duplicated keyboard handlers
- [ ] Remove duplicated layout markup

### Components
- [ ] Split large components (>200 lines)
- [ ] Accept data via props (no data fetching)
- [ ] Use CSS variables (no hardcoded colors)
- [ ] Add accessibility attributes
- [ ] Extract styling logic
- [ ] Create focused, reusable versions

### Hooks
- [ ] Extract repeated logic
- [ ] Create custom hooks
- [ ] Use composition over props
- [ ] Type everything
- [ ] Document with JSDoc

---

## Before & After Examples

### Example 1: Page with Duplicated Layout

**BEFORE** - SearchPage (130 lines, duplicated header)
```tsx
export function SearchPage({ repository }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Duplicated Escape handler (also in ActivityPage)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate({ to: '/' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const { data: results } = useQuery({...});

  return (
    // Duplicated header/layout structure
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button onClick={() => navigate({ to: '/' })} className="text-blue-600">
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold">Search</h1>
          <p className="text-gray-600">Find lists and tasks across all collections</p>
        </div>
        {/* Content */}
      </div>
    </div>
  );
}
```

**AFTER** - SearchPage (40 lines, clean and reusable)
```tsx
export function SearchPage({ repository }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Use generic hook instead of duplicating
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });

  const { data: results } = useQuery({...});

  return (
    // Use generic container instead of duplicating layout
    <PageContainer
      title="Search"
      subtitle="Find lists and tasks across all collections"
      backButton={{ to: '/' }}
    >
      {/* Content */}
    </PageContainer>
  );
}
```

**Benefits:**
- 65% less code
- Consistent layout across pages
- Easy to change header styling globally
- Escape handler reused in all pages

---

### Example 2: Component with Mixed Concerns

**BEFORE** - TaskList (250 lines, data fetching + UI)
```tsx
export function TaskList({ listId }: Props) {
  // Data fetching (shouldn't be here)
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    repository.listTasks(listId).then(data => {
      setTasks(data);
      setLoading(false);
    });
  }, [listId, repository]);

  // UI state (OK here)
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('all');

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Render tasks */}
    </div>
  );
}

// Usage
<TaskList listId={id} />
```

**AFTER** - Hook + Component (50 lines + 80 lines, separated concerns)
```tsx
// Hook handles data fetching
function useListTasks(listId: string) {
  return useSuspenseQuery({
    queryKey: queryKeys.tasks(listId),
    queryFn: () => repository.listTasks(listId),
  });
}

// Component only handles UI
export function TaskList({ tasks }: { tasks: TodoItem[] }) {
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('all');

  return (
    <div>
      {/* Render tasks */}
    </div>
  );
}

// Usage
function ListDetailPage({ listId }: Props) {
  const { data: tasks } = useListTasks(listId);
  return <TaskList tasks={tasks} />;
}
```

**Benefits:**
- Data fetching logic is reusable in other pages
- Component is pure and testable
- Easy to add loading states
- Clear separation of concerns

---

### Example 3: Duplicated Empty States

**BEFORE** - Multiple pages have custom empty states
```tsx
// SearchPage
if (!query) {
  return (
    <div className="bg-white rounded-lg shadow-md p-12 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h2 className="text-2xl font-bold">Start searching</h2>
      <p>Type in the search bar to find lists and tasks</p>
    </div>
  );
}

// ActivityPage
if (activities.length === 0) {
  return (
    <div className="bg-white rounded-lg shadow-md p-12 text-center">
      <div className="text-6xl mb-4">📭</div>
      <h2 className="text-2xl font-bold">No activity</h2>
      <p>No events recorded yet</p>
    </div>
  );
}
```

**AFTER** - Single reusable component
```tsx
// SearchPage
{!query && <EmptyState icon="🔍" title="Start searching" description="..." />}

// ActivityPage
{activities.length === 0 && <EmptyState icon="📭" title="No activity" />}
```

**Benefits:**
- 70% less code
- Consistent styling
- Easy to update all empty states globally
- Reusable across the app

---

### Example 4: Component Receiving Too Many Props

**BEFORE** - TaskCard receives everything
```tsx
<TaskCard
  task={task}
  isSelected={selected === task.id}
  onSelect={handleSelect}
  onDelete={handleDelete}
  onComplete={handleComplete}
  onUpdate={handleUpdate}
  isEditing={editingId === task.id}
  setEditingId={setEditingId}
  repository={repository}
  userId={userId}
  // ... 8 more props
/>
```

**AFTER** - Component receives minimal data, hooks handle logic
```tsx
// In parent (ListDetailPage)
const { data: tasks } = useListTasks(listId);
const taskMutations = useTaskMutations({ repository, userId });

// Component receives only what it displays
<TaskCard 
  task={task}
  isSelected={selected === task.id}
  onSelect={handleSelect}
/>

// Callbacks are handled by mutations hook
const handleDelete = async (id) => {
  await taskMutations.deleteTask.mutateAsync(id);
};
```

**Benefits:**
- Fewer props = easier to reason about
- Callbacks reused across components
- Easy to test components
- Flexible reuse in different contexts

---

### Example 5: Hardcoded Colors & Styles

**BEFORE** - Hardcoded colors in every component
```tsx
function TaskItem({ task }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-gray-900 font-bold">{task.title}</h3>
      <button className="bg-blue-600 text-white px-3 py-1 rounded">
        Complete
      </button>
    </div>
  );
}
```

**AFTER** - Using CSS variables (theme-aware)
```tsx
function TaskItem({ task }: Props) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg p-4">
      <h3 className="text-[var(--color-text-primary)] font-bold">{task.title}</h3>
      <button className="bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] px-3 py-1 rounded">
        Complete
      </button>
    </div>
  );
}
```

**Benefits:**
- Automatic theme switching (no code changes)
- Consistent colors across app
- Easy to update colors globally
- Accessibility (contrast ratios)

---

### Example 6: Duplicated State Management

**BEFORE** - Multiple pages with same pattern
```tsx
// SearchPage
const [searchQuery, setSearchQuery] = useState('');
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (!searchQuery) return;
  setLoading(true);
  repository.search({ query: searchQuery })
    .then(res => setResults(res.results))
    .finally(() => setLoading(false));
}, [searchQuery, repository]);

// ActivityPage (similar pattern)
const [activities, setActivities] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  repository.getActivity()
    .then(res => setActivities(res))
    .finally(() => setLoading(false));
}, [repository]);
```

**AFTER** - Use React Query (already set up)
```tsx
// SearchPage
const { data: results = [] } = useQuery({
  queryKey: queryKeys.search(searchQuery),
  queryFn: () => repository.search({ query: searchQuery }).then(r => r.results),
  enabled: !!searchQuery,
});

// ActivityPage
const { data: activities = [] } = useSuspenseQuery({
  queryKey: queryKeys.activity,
  queryFn: () => repository.getActivity(),
});
```

**Benefits:**
- 80% less boilerplate
- Built-in caching & deduplication
- Error handling out of box
- Easy loading/error states

---

## Refactoring Workflow

### Step 1: Identify Problems
```typescript
// Common smells:
// - useEffect with setState (data fetching)
// - Duplicated JSX (layout patterns)
// - Duplicated event handlers (keyboard, navigation)
// - Too many props (component receiving everything)
// - Hardcoded colors/strings
// - >200 line components
```

### Step 2: Extract to Hooks
```typescript
// Move data fetching logic to custom hook
export function useMyData(id: string) {
  return useSuspenseQuery({
    queryKey: ['data', id],
    queryFn: () => repository.getData(id),
  });
}

// Usage
const { data } = useMyData(id);
```

### Step 3: Extract to Components
```typescript
// Split large component
export function MyComponentUI({ data, onAction }: Props) {
  return <div>...</div>;
}

// Compose in page
<Suspense fallback={<LoadingState />}>
  <MyComponentUI data={data} onAction={handleAction} />
</Suspense>
```

### Step 4: Use Generic Components
```tsx
// Replace custom containers
return (
  <PageContainer title="My Page">
    {isLoading && <LoadingState />}
    {data.length === 0 && <EmptyState />}
    <Grid>{data.map(item => <Card key={item.id}>{item.title}</Card>)}</Grid>
  </PageContainer>
);
```

### Step 5: Apply Theme Variables
```typescript
// Replace hardcoded colors
className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
```

---

## Common Refactoring Patterns

### Pattern: Extract Custom Hook
```typescript
// From: Direct data fetching in component
// To: Reusable hook

export function useUserLists(userId: string) {
  return useSuspenseQuery({
    queryKey: queryKeys.lists(userId),
    queryFn: () => repository.getUserLists(userId),
    staleTime: 5000,
  });
}
```

### Pattern: Extract UI Component
```typescript
// From: Large component with both logic and UI
// To: Separate UI component

export function MyFeatureUI({ items, selected, onSelect }: Props) {
  return (
    <Grid>
      {items.map(item => (
        <Card key={item.id} onClick={() => onSelect(item.id)}>
          {item.title}
        </Card>
      ))}
    </Grid>
  );
}
```

### Pattern: Create Composition Hook
```typescript
// From: Multiple separate queries
// To: Single composed hook

export function useDashboardData() {
  const dashboard = useSuspenseQuery({...});
  const activity = useSuspenseQuery({...});
  
  return { dashboard, activity };
}
```

### Pattern: Generic State Component
```typescript
// From: Custom loading/empty/error handling
// To: Reusable state components

{isLoading && <LoadingState message="Loading items..." />}
{data.length === 0 && <EmptyState title="No items" />}
{error && <ErrorState message={error.message} />}
```

---

## Checklist for Refactoring

### Before Starting
- [ ] Understand current code structure
- [ ] Identify duplicated patterns
- [ ] Decide on approach (hook extraction first)
- [ ] Write tests for new hooks

### Data Layer
- [ ] Move data fetching to React Query
- [ ] Create query keys
- [ ] Extract custom hooks
- [ ] Add error handling

### Component Layer
- [ ] Split large components
- [ ] Extract reusable UI
- [ ] Replace hardcoded values with CSS variables
- [ ] Add accessibility attributes

### Page Layer
- [ ] Use `PageContainer` for layout
- [ ] Use `usePageNav` for navigation
- [ ] Use state components
- [ ] Remove duplicated markup

### Testing
- [ ] Test extracted hooks
- [ ] Test component props
- [ ] Test page composition
- [ ] Verify no regressions

---

## When to Refactor

**High Priority:**
- [ ] Component > 300 lines
- [ ] Data fetching in component
- [ ] Duplicated keyboard handlers
- [ ] Hardcoded colors
- [ ] > 10 props to component

**Medium Priority:**
- [ ] Duplicated JSX patterns
- [ ] Missing accessibility
- [ ] > 5 levels of nesting
- [ ] Complex state logic

**Low Priority:**
- [ ] Cosmetic improvements
- [ ] Minor optimization
- [ ] Code style issues
- [ ] Deprecated but working code

---

## Resources

- [Full Architecture Guide](./ARCHITECTURE_GUIDE.md)
- [Component Patterns](../src/components/layouts/index.ts)
- [Hook Examples](../src/hooks/)
- [Page Examples](../src/pages/)

---

*For specific refactoring help, check existing patterns in the codebase or refer to the ARCHITECTURE_GUIDE.md.*
