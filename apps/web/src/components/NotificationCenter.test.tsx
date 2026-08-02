import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  getSession: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
  getNotificationEvents: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }));
vi.mock('../config/persistence.config', () => ({ authProvider: { getSession: mocked.getSession, subscribe: mocked.subscribe } }));
vi.mock('../infrastructure/notifications/inbox', () => ({ getNotificationEvents: mocked.getNotificationEvents, markNotificationRead: mocked.markNotificationRead }));

import { NotificationCenter } from './NotificationCenter';

describe('NotificationCenter', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocked.getSession.mockResolvedValue({ user: { id: 'owner-1' }, accessToken: 'session-token' });
    mocked.getNotificationEvents.mockResolvedValue([{ id: 'notice-1', title: 'Due today: Report', body: 'Open the task.', kind: 'due_soon', created_at: '2026-08-02T13:00:00.000Z', read_at: null }]);
    mocked.markNotificationRead.mockResolvedValue(undefined);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it('shows a signed-in person an unread count and a non-blocking preview', async () => {
    await act(async () => { root.render(<NotificationCenter />); await Promise.resolve(); await Promise.resolve(); });
    const trigger = host.querySelector<HTMLButtonElement>('.notification-center__trigger');
    expect(trigger?.getAttribute('aria-label')).toBe('1 unread notification');
    expect(trigger?.textContent).toContain('1');

    await act(async () => trigger?.click());
    expect(host.textContent).toContain('1 needs your attention');
    expect(host.textContent).toContain('Due today: Report');

    const markRead = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Mark read');
    await act(async () => markRead?.click());
    expect(mocked.markNotificationRead).toHaveBeenCalledWith('notice-1');
    expect(host.querySelector<HTMLButtonElement>('.notification-center__trigger')?.getAttribute('aria-label')).toBe('Notifications');
  });

  it('stays absent when no authenticated user exists', async () => {
    mocked.getSession.mockResolvedValue(null);
    await act(async () => { root.render(<NotificationCenter />); await Promise.resolve(); });
    expect(host.querySelector('.notification-center')).toBeNull();
    expect(mocked.getNotificationEvents).not.toHaveBeenCalled();
  });
});
