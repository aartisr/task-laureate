import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDetailLens } from './TaskDetailLens';

vi.mock('./TaskReminderControl', () => ({
  TaskReminderControl: ({ taskId }: { taskId: string }) => <div data-testid="task-reminder-control">Reminder controls for {taskId}</div>,
}));

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

  it('edits, persists, and clears a due date through the same update boundary', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const task = { id: 'task-2', listId: 'list-1', title: 'Ship release', notes: '', status: 'todo' as const, priority: 'medium' as const, dueDate: '2026-08-05T00:00:00.000Z', tags: [], order: 0, createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z', completedAt: null, deletedAt: null };
    await act(async () => root.render(<TaskDetailLens task={task} onUpdate={update} onComplete={vi.fn().mockResolvedValue(undefined)} />));
    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Edit task')?.click());

    const input = host.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input.value).toBe('2026-08-05');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '2026-08-17');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Save changes')?.click());
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ dueDate: '2026-08-17' }));

    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Edit task')?.click());
    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Clear date')?.click());
    await act(async () => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Save changes')?.click());
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ dueDate: null }));
  });

  it('renders reminder and status-request controls only when the parent grants owner access', async () => {
    const task = { id: 'task-reminders', listId: 'list-1', title: 'Confirm launch date', notes: '', status: 'todo' as const, priority: 'medium' as const, dueDate: null, tags: [], order: 0, createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z', completedAt: null, deletedAt: null };
    const props = { task, onUpdate: vi.fn().mockResolvedValue(undefined), onComplete: vi.fn().mockResolvedValue(undefined) };

    await act(async () => root.render(<TaskDetailLens {...props} />));
    expect(host.querySelector('[data-testid="task-reminder-control"]')).toBeNull();

    await act(async () => root.render(<TaskDetailLens {...props} canManageReminders />));
    expect(host.querySelector('[data-testid="task-reminder-control"]')?.textContent).toContain('task-reminders');

    await act(async () => root.render(<TaskDetailLens {...props} canManageReminders readOnly />));
    expect(host.querySelector('[data-testid="task-reminder-control"]')).toBeNull();
  });
});
