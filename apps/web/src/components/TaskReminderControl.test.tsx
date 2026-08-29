import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskReminderControl } from './TaskReminderControl';
import { getTaskReminderSetup } from '../infrastructure/notifications/taskReminders';

vi.mock('../infrastructure/notifications/taskReminders', () => ({
  defaultTaskReminderChannels: ['in_app', 'email'],
  getTaskReminderSetup: vi.fn(),
  requestTaskStatusUpdate: vi.fn(),
  saveTaskReminder: vi.fn(),
  setTaskAssignee: vi.fn(),
}));

const getSetup = vi.mocked(getTaskReminderSetup);

describe('TaskReminderControl', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });

  it('keeps the status-update destination visible with a clear share-first next step', async () => {
    getSetup.mockResolvedValue({ candidates: [{ user_id: 'owner-id', email: 'owner@example.com', access_role: 'owner' }], assigned: new Set(), rule: { enabled: false, offset_minutes: 1440, channels: ['in_app', 'email'] } });
    await act(async () => root.render(<TaskReminderControl taskId="task-1" />));

    expect(host.textContent).toContain('Assignment & reminders');
    expect(host.textContent).toContain('Share this List to request an update');
    expect(host.querySelector('button')).toBeNull();
  });

  it('shows an assignable collaborator and a disabled status request until they are selected', async () => {
    getSetup.mockResolvedValue({ candidates: [{ user_id: 'person-id', email: 'person@example.com', access_role: 'editor' }], assigned: new Set(), rule: { enabled: false, offset_minutes: 1440, channels: ['in_app', 'email'] } });
    await act(async () => root.render(<TaskReminderControl taskId="task-2" />));

    expect(host.textContent).toContain('person@example.com');
    const requestButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Request status update');
    expect(requestButton).toBeTruthy();
    expect(requestButton?.disabled).toBe(true);
  });

  it('renders a retry path instead of hiding setup failures', async () => {
    getSetup.mockRejectedValue(new Error('Loading eligible collaborators failed: Only the Task owner can view assignee candidates.'));
    await act(async () => root.render(<TaskReminderControl taskId="task-3" />));

    expect(host.textContent).toContain('We could not load the people who can work on this task.');
    expect(host.textContent).toContain('Loading eligible collaborators failed: Only the Task owner can view assignee candidates.');
    expect(Array.from(host.querySelectorAll('button')).some((button) => button.textContent === 'Retry')).toBe(true);
  });
});
