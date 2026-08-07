# Code Snippets: Mutations and Keyboard Patterns

## Create mutation pattern

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

## Update mutation pattern

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

## Page-level Escape behavior

```tsx
import { usePageNav } from '@/hooks/usePageNav';

export function MyPage() {
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });
  return null;
}
```

## Custom keyboard shortcuts

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
```

## Mutation quality checklist

- Handle pending state in button/UI.
- Keep navigation side effects in success path only.
- Announce failures accessibly (not just console).
- Keep mutation payloads typed and minimal.
