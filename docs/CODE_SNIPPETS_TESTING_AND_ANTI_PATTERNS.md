# Code Snippets: Testing and Anti-Patterns

## Hook test template

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMyData } from '@/hooks/useMyData';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

it('fetches data', async () => {
  const { result } = renderHook(() => useMyData(repository), { wrapper });

  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
});
```

## Component test template

```tsx
import { render, screen } from '@testing-library/react';
import { SimpleCard } from '@/components/SimpleCard';

it('renders card with title', () => {
  render(<SimpleCard title="Test" onClick={() => {}} />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

## Anti-pattern: data fetching in random component effect

```tsx
// BAD
function MyComponent() {
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
```

## Anti-pattern: hardcoded colors

```tsx
// BAD
className="bg-blue-600 text-white border border-gray-300"

// GOOD
className="bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] border border-[var(--color-border-default)]"
```

## Anti-pattern: non-semantic click targets

```tsx
// BAD
<div onClick={handleClick}>Click me</div>

// GOOD
<button onClick={handleClick} aria-label="Perform action">Click me</button>
```

## Regression checklist

- Tests assert behavior, not implementation details.
- Keyboard interactions are covered for key controls.
- Empty/loading/error states are covered.
- New events/mutations include failure-path tests.
