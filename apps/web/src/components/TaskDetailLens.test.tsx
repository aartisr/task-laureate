import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDetailLens } from './TaskDetailLens';

describe('TaskDetailLens', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('saves a selected priority with the edited task document', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<TaskDetailLens task={{ id: 'task-1', listId: 'list-1', title: 'Prepare launch', notes: '<p>Context</p>', status: 'todo', priority: 'medium', dueDate: null, tags: [], order: 0, createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z', completedAt: null, deletedAt: null }} onUpdate={update} onComplete={vi.fn().mockResolvedValue(undefined)} />));
    const edit = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Edit task');
    await act(async () => edit?.click());
    const high = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('High'));
    await act(async () => high?.click());
    const save = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Save changes');
    await act(async () => save?.click());
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prepare launch', priority: 'high', notes: '<p>Context</p>' }));
  });
});
