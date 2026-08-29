import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutations: { updateTask: { mutateAsync: vi.fn() }, deleteTask: { mutateAsync: vi.fn() } }, planning: { save: vi.fn(), acceptSteps: vi.fn() }, repository: { recordTaskEvent: vi.fn() }, aiEnabled: false, requestAiDecomposition: vi.fn() }));

vi.mock('../app/runtime/appServices', () => ({ appServices: { repository: mocks.repository, queryClient: new QueryClient() } }));
vi.mock('../core/mutations/useTodoMutations', () => ({ useTodoMutations: () => mocks.mutations }));
vi.mock('../core/services/taskPlanning', () => ({ createTaskPlanningService: () => mocks.planning }));
vi.mock('../infrastructure/antiBacklog/aiDecomposition', () => ({ aiDecompositionPreviewEnabled: () => mocks.aiEnabled, requestAiDecomposition: mocks.requestAiDecomposition }));

import { TaskExecutionControls } from './TaskExecutionControls';

const task = { id: 'task-1', listId: 'list-1', title: 'Prepare launch', notes: '', status: 'todo' as const, priority: 'medium' as const, dueDate: null, tags: [], order: 0, createdAt: '2026-08-13T00:00:00Z', updatedAt: '2026-08-13T00:00:00Z', completedAt: null, deletedAt: null };
const click = (host: HTMLElement, text: string) => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === text)?.click();

describe('TaskExecutionControls UI workflow', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); mocks.aiEnabled = false; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const render = async () => { await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><TaskExecutionControls task={task} /></QueryClientProvider>)); };

  it('edits, selects, and atomically accepts exactly the reviewed proposal steps', async () => {
    await render(); await act(async () => click(host, 'Deconstruct task'));
    const first = host.querySelector('textarea.task-execution-controls__step-title') as HTMLTextAreaElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(first, 'Confirm launch audience'); first.dispatchEvent(new Event('input', { bubbles: true })); first.dispatchEvent(new Event('change', { bubbles: true })); });
    const checks = host.querySelectorAll('input[type="checkbox"]');
    await act(async () => (checks[1] as HTMLInputElement).click());
    await act(async () => click(host, 'Add selected steps'));
    expect(mocks.planning.acceptSteps).toHaveBeenCalledWith('task-1', expect.arrayContaining([expect.objectContaining({ title: 'Confirm launch audience' })]), 'template');
    expect(mocks.planning.acceptSteps.mock.calls[0][1]).toHaveLength(checks.length - 1);
  });

  it('records durable snooze, park, and archive actions after each task mutation succeeds', async () => {
    await render(); const details = host.querySelector('details') as HTMLDetailsElement;
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')); });
    await act(async () => click(host, 'Snooze to tomorrow'));
    await act(async () => click(host, 'Park for review'));
    await act(async () => click(host, 'Archive'));
    expect(mocks.mutations.updateTask.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', input: expect.objectContaining({ dueDate: expect.any(String) }) }));
    expect(mocks.mutations.updateTask.mutateAsync).toHaveBeenCalledWith({ taskId: 'task-1', input: { status: 'blocked' } });
    expect(mocks.mutations.deleteTask.mutateAsync).toHaveBeenCalledWith('task-1');
    expect(mocks.repository.recordTaskEvent).toHaveBeenCalledTimes(3);
    expect(mocks.repository.recordTaskEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'snoozed', taskId: 'task-1' }));
    expect(mocks.repository.recordTaskEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'parked', taskId: 'task-1' }));
    expect(mocks.repository.recordTaskEvent).toHaveBeenNthCalledWith(3, expect.objectContaining({ type: 'archived', taskId: 'task-1' }));
  });

  it('makes AI assistance explicit at consent, invocation, and review—not elsewhere', async () => {
    mocks.aiEnabled = true;
    mocks.requestAiDecomposition.mockResolvedValue({ kind: 'proposal', cache: 'miss', proposal: { taskTitle: task.title, summary: 'A reviewable breakdown.', firstAction: 'Open the brief.', source: 'ai', steps: [{ title: 'Open the brief', estimateMinutes: 5, energyLevel: 'quick' }] } });
    await render();
    expect(host.textContent).toContain('Optional AI preview');
    expect(host.textContent).toContain('Uses Gemini only after you opt in');
    const consent = host.querySelector('.task-execution-controls__ai-preview input[type="checkbox"]') as HTMLInputElement;
    await act(async () => consent.click());
    await act(async () => click(host, 'Try AI breakdown'));
    expect(host.textContent).toContain('AI-assisted · review required');
    expect(host.textContent).toContain('Review, edit, select, or discard them before anything changes.');
    expect(host.querySelectorAll('.task-execution-controls__step-provenance')).toHaveLength(1);
    expect(host.textContent).toContain('AI-assisted start');
  });
});
