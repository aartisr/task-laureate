# Laureate Code Snippets - Common Patterns

Quick reference for the most common development patterns in Laureate.

---

## Creating a New Page

### Basic Page Template
```tsx
import { useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageContainer, EmptyState, LoadingState, Grid, Card } from '@/components/layouts';
import { usePageNav } from '@/hooks/usePageNav';
import { queryKeys } from '@/core/contracts/queryKeys';
import type { TodoRepository } from '@/core/contracts/repository';

export interface MyPageProps {
  repository: TodoRepository;
}

export function MyPage({ repository }: MyPageProps) {
  const navigate = useNavigate();
  
  // 1. Setup navigation
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/dashboard' });

  // 2. Fetch data
  const { data, isLoading } = useSuspenseQuery({
    queryKey: queryKeys.myData,
    queryFn: () => repository.getMyData(),
    staleTime: 5000,
  });

  // 3. Handle loading state
  if (isLoading) {
    return (
      <PageContainer title="My Page">
        <LoadingState message="Loading..." />
      </PageContainer>
    );
  }

  // 4. Handle empty state
  if (!data || data.length === 0) {
    return (
      <PageContainer title="My Page">
        <EmptyState
          title="No data yet"
          description="Create something to get started"
          action={{ label: 'Create', onClick: () => navigate({ to: '/create' }) }}
        />
      </PageContainer>
    );
  }

  // 5. Render content
  return (
    <PageContainer title="My Page" subtitle="Description of page">
      <Grid columns={3} gap="normal">
        {data.map(item => (
          <Card key={item.id} onClick={() => navigate({ to: `/items/${item.id}` })}>
            {item.title}
          </Card>
        ))}
      </Grid>
    </PageContainer>
  );
}
```

---

## Creating a Custom Hook

### Data Fetching Hook
```tsx
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/contracts/queryKeys';
import type { TodoRepository } from '@/core/contracts/repository';

// Suspenseful query (for Suspense boundaries)
export function useMyData(repository: TodoRepository) {
  return useSuspenseQuery({
    queryKey: queryKeys.myData,
    queryFn: () => repository.getMyData(),
    staleTime: 5000,
  });
}

// Optional query (doesn't suspend)
export function useOptionalData(repository: TodoRepository, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.myData,
    queryFn: () => repository.getMyData(),
    enabled,
    staleTime: 5000,
  });
}

// Usage
export function MyComponent({ repository }: Props) {
  const { data } = useMyData(repository);
  // Component suspends until data is loaded
  return <div>{data.title}</div>;
}
```

### Composition Hook
```tsx
export function usePageData(repository: TodoRepository, id: string) {
  // Combine multiple queries
  const item = useSuspenseQuery({
    queryKey: queryKeys.item(id),
    queryFn: () => repository.getItem(id),
  });

  const comments = useSuspenseQuery({
    queryKey: queryKeys.comments(id),
    queryFn: () => repository.getComments(id),
  });

  const related = useSuspenseQuery({
    queryKey: queryKeys.relatedItems(id),
    queryFn: () => repository.getRelatedItems(id),
  });

  return {
    item: item.data,
    comments: comments.data,
    related: related.data,
    isLoading: item.isLoading || comments.isLoading || related.isLoading,
  };
}

// Usage
const { item, comments, related } = usePageData(repository, id);
```

---

## Creating a Reusable Component

### Simple Card Component
```tsx
export interface SimpleCardProps {
  title: string;
  description?: string;
  onClick?: () => void;
  children?: ReactNode;
}

export function SimpleCard({
  title,
  description,
  onClick,
  children,
}: SimpleCardProps) {
  return (
    <Card
      onClick={onClick}
      ariaLabel={title}
    >
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {description}
        </p>
      )}
      {children}
    </Card>
  );
}

// Usage
<SimpleCard title="My Item" description="Description" onClick={handleClick}>
  <p>Custom content</p>
</SimpleCard>
```

### Layout Component
```tsx
import { Grid, Section, Card } from '@/components/layouts';

export function ItemList({ items, title }: Props) {
  return (
    <Section title={title}>
      <Grid columns={3} gap="normal">
        {items.map(item => (
          <Card key={item.id}>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}

// Usage
<ItemList items={data} title="My Items" />
```

---

## Handling State Transitions

### Loading → Content → Empty
```tsx
export function MyPage({ repository }: Props) {
  const { data, isLoading } = useSuspenseQuery({...});

  if (isLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (data?.length === 0) {
    return <EmptyState title="No items" />;
  }

  return (
    <Grid>
      {data.map(item => (
        <Card key={item.id}>{item.title}</Card>
      ))}
    </Grid>
  );
}
```

### With Suspense (Recommended)
```tsx
import { Suspense } from 'react';

export function MyPage({ repository }: Props) {
  return (
    <PageContainer title="My Page">
      <Suspense fallback={<LoadingState />}>
        <MyPageContent repository={repository} />
      </Suspense>
    </PageContainer>
  );
}

function MyPageContent({ repository }: Props) {
  const { data } = useMyData(repository);

  if (!data || data.length === 0) {
    return <EmptyState title="No items" />;
  }

  return (
    <Grid>
      {data.map(item => (
        <Card key={item.id}>{item.title}</Card>
      ))}
    </Grid>
  );
}
```

---

## Using Mutations

### Create List Mutation
```tsx
import { useListMutations } from '@/core/mutations/useListMutations';

export function MyCreatePage({ repository }: Props) {
  const navigate = useNavigate();
  const mutations = useListMutations({ repository, userId: 'user-1' });

  const handleCreate = async () => {
    try {
      const result = await mutations.createList.mutateAsync({
        title: 'New List',
        description: 'Description',
      });
      navigate({ to: `/lists/${result.id}` });
    } catch (error) {
      console.error('Failed to create:', error);
    }
  };

  return (
    <button onClick={handleCreate} disabled={mutations.createList.isPending}>
      {mutations.createList.isPending ? 'Creating...' : 'Create'}
    </button>
  );
}
```

### Update Item Mutation
```tsx
const handleUpdate = async (updates: Partial<TodoItem>) => {
  try {
    await mutations.updateTask.mutateAsync({
      id: task.id,
      ...updates,
    });
  } catch (error) {
    announceToScreenReader('Failed to update', 'assertive');
  }
};
```

---

## Keyboard Navigation

### Page-Level Escape Handler
```tsx
import { usePageNav } from '@/hooks/usePageNav';

export function MyPage({ repository }: Props) {
  // Escape goes back to /
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });

  // ... rest of page
}
```

### Custom Keyboard Shortcuts
```tsx
import { useEffect } from 'react';

export function useCustomShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'n') handlers.onNewItem?.();
        if (key === 'f') handlers.onSearch?.();
        if (key === 's') handlers.onSave?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

// Usage
useCustomShortcuts({
  onNewItem: () => setShowCreate(true),
  onSearch: () => navigate({ to: '/search' }),
});
```

---

## Composing Layouts

### Simple Layout
```tsx
<PageContainer title="My Page">
  <Grid columns={2} gap="normal">
    {items.map(item => (
      <Card key={item.id}>{item.title}</Card>
    ))}
  </Grid>
</PageContainer>
```

### Complex Layout with Sections
```tsx
<PageContainer title="Dashboard" spacing="spacious">
  {/* Stats row */}
  <Grid columns={4} gap="normal">
    <StatCard title="Lists" value={stats.lists} />
    <StatCard title="Tasks" value={stats.tasks} />
    <StatCard title="Done" value={stats.completed} />
    <StatCard title="Progress" value={`${stats.percent}%`} />
  </Grid>

  {/* Action cards */}
  <Grid columns={2} gap="normal">
    <Card onClick={handleCreate}>Create</Card>
    <Card onClick={handleSearch}>Search</Card>
  </Grid>

  {/* Content section */}
  <Section title="Recent Items">
    <Grid columns={3} gap="normal">
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
    </Grid>
  </Section>
</PageContainer>
```

### With Footer
```tsx
const footer = (
  <div className="text-center text-sm text-[var(--color-text-secondary)]">
    <p>⌨️ Keyboard Shortcuts</p>
    <div className="flex gap-4 justify-center mt-2">
      <div>
        <kbd>Cmd+N</kbd> New
      </div>
      <div>
        <kbd>Cmd+F</kbd> Search
      </div>
    </div>
  </div>
);

<PageContainer title="My Page" footer={footer}>
  {/* Content */}
</PageContainer>
```

---

## Theme System (CSS Variables)

### Color Variables
```typescript
// Primary colors
--color-bg-primary         // Main background
--color-bg-secondary       // Secondary background
--color-bg-surface         // Card/surface background
--color-bg-overlay         // Overlay/modal background

// Text colors
--color-text-primary       // Primary text
--color-text-secondary     // Secondary text
--color-text-tertiary      // Tertiary text
--color-text-inverse       // Inverse text (on primary bg)

// Action colors
--color-action-primary     // Primary action button
--color-action-hover       // Action hover state
--color-action-active      // Action active state
--color-action-disabled    // Action disabled state

// Status colors
--color-status-success     // Success state
--color-status-warning     // Warning state
--color-status-error       // Error state
--color-status-info        // Info state

// Border colors
--color-border-default     // Default border
--color-border-focus       // Focus border
```

### Usage in Components
```tsx
// Before (hardcoded colors)
<div className="bg-white text-gray-900 border border-gray-200">
  <button className="bg-blue-600 text-white">Click me</button>
</div>

// After (CSS variables)
<div className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
  <button className="bg-[var(--color-action-primary)] text-[var(--color-text-inverse)]">
    Click me
  </button>
</div>
```

---

## Accessibility Patterns

### Semantic HTML
```tsx
// ✅ GOOD
<section aria-label="Main content">
  <h1>My Page</h1>
  <article>
    <h2>Section Title</h2>
    <p>Content</p>
  </article>
</section>

// ❌ BAD
<div>
  <div>My Page</div>
  <div>
    <div>Section Title</div>
    <div>Content</div>
  </div>
</div>
```

### ARIA Labels
```tsx
// Loading state
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading && 'Loading...'}
</div>

// Progress bar
<div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
  <div style={{ width: '50%' }} />
</div>

// Button with label
<button aria-label="Delete item">🗑️</button>

// Icon with aria-hidden
<span aria-hidden="true">→</span>
```

### Keyboard Navigation
```tsx
// Focusable button
<button className="focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]">
  Click me
</button>

// Skip link
<a href="#main-content" className="sr-only">
  Skip to main content
</a>
<main id="main-content">...</main>
```

---

## Testing Patterns

### Testing a Hook
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMyData } from '@/hooks/useMyData';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

it('fetches data', async () => {
  const { result } = renderHook(() => useMyData(repository), { wrapper });

  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
});
```

### Testing a Component
```tsx
import { render, screen } from '@testing-library/react';
import { SimpleCard } from '@/components/SimpleCard';

it('renders card with title', () => {
  render(<SimpleCard title="Test" onClick={() => {}} />);
  
  expect(screen.getByText('Test')).toBeInTheDocument();
});

it('calls onClick when clicked', () => {
  const onClick = vi.fn();
  render(<SimpleCard title="Test" onClick={onClick} />);
  
  screen.getByRole('button').click();
  expect(onClick).toHaveBeenCalled();
});
```

---

## Common Mistakes & Fixes

### ❌ Data Fetching in Component
```tsx
// BAD
function MyComponent({ items }: Props) {
  const [data, setData] = useState([]);
  useEffect(() => {
    repository.getData().then(setData);
  }, []);
  return <div>{data}</div>;
}

// GOOD
function useMyData() {
  return useSuspenseQuery({
    queryKey: ['data'],
    queryFn: () => repository.getData(),
  });
}

function MyComponent() {
  const { data } = useMyData();
  return <div>{data}</div>;
}
```

### ❌ Too Many Props
```tsx
// BAD
<MyComponent
  items={items}
  isLoading={isLoading}
  error={error}
  onSelect={onSelect}
  onDelete={onDelete}
  onUpdate={onUpdate}
  // ... 10 more props
/>

// GOOD
<MyComponent items={items} onSelect={onSelect} />
```

### ❌ Hardcoded Colors
```tsx
// BAD
className="bg-blue-600 text-white border border-gray-300"

// GOOD
className="bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] border border-[var(--color-border-default)]"
```

### ❌ Missing Accessibility
```tsx
// BAD
<div onClick={handleClick}>Click me</div>

// GOOD
<button onClick={handleClick} aria-label="Perform action">
  Click me
</button>
```

---

## Quick Copy-Paste Templates

### Empty Page Template
```tsx
import { PageContainer, EmptyState } from '@/components/layouts';

export function EmptyPage() {
  return (
    <PageContainer title="Page Title">
      <EmptyState
        title="No data yet"
        description="Create something to get started"
      />
    </PageContainer>
  );
}
```

### Data Page Template
```tsx
import { PageContainer, LoadingState, EmptyState, Grid, Card } from '@/components/layouts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { usePageNav } from '@/hooks/usePageNav';
import { queryKeys } from '@/core/contracts/queryKeys';
import { Suspense } from 'react';

export function DataPage({ repository }: Props) {
  return (
    <PageContainer title="Page Title">
      <Suspense fallback={<LoadingState />}>
        <Content repository={repository} />
      </Suspense>
    </PageContainer>
  );
}

function Content({ repository }: Props) {
  usePageNav({ onEscapeGoBack: true });
  const { data } = useSuspenseQuery({
    queryKey: queryKeys.myData,
    queryFn: () => repository.getMyData(),
  });

  if (!data?.length) {
    return <EmptyState title="No items" />;
  }

  return (
    <Grid columns={3} gap="normal">
      {data.map(item => (
        <Card key={item.id}>{item.title}</Card>
      ))}
    </Grid>
  );
}
```

---

*For more examples, check the actual code in `/src/pages/`, `/src/components/`, and `/src/hooks/`.*
