import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('../config/persistence.config', () => ({
  authProvider: { getSession: mocked.getSession },
}));

import { NotificationInbox } from './NotificationInbox';

const session = { user: { id: 'owner-1' }, accessToken: 'session-token' };
const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('NotificationInbox', () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocked.getSession.mockResolvedValue(session);
    fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'notice-1', title: 'Due today: Submit report', body: 'Open Task-Laureate to review and complete this task.', kind: 'due_soon', created_at: '2026-08-02T13:00:00.000Z', read_at: null }]))
      .mockResolvedValueOnce(jsonResponse([{ due_soon: true, weekly_digest: false }]));
    vi.stubGlobal('fetch', fetchMock);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('loads only authenticated inbox data and persists a changed preference', async () => {
    await act(async () => {
      root.render(<NotificationInbox />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Due today: Submit report');
    expect(fetchMock.mock.calls[0][0]).toContain('/rest/v1/notification_events?');
    expect(fetchMock.mock.calls[1][0]).toContain('/rest/v1/notification_preferences?');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const weeklyDigest = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(weeklyDigest).not.toBeNull();
    await act(async () => weeklyDigest!.click());

    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toContain('notification_preferences?on_conflict=owner_id');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual([{ owner_id: 'owner-1', due_soon: false, weekly_digest: false, updated_at: expect.any(String) }]);
  });

  it('marks an unread notice read using the owner-scoped RLS endpoint', async () => {
    await act(async () => {
      root.render(<NotificationInbox />);
      await Promise.resolve();
      await Promise.resolve();
    });

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const button = Array.from(host.querySelectorAll('button')).find((candidate) => candidate.textContent === 'Mark read');
    await act(async () => button?.click());

    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toContain('notification_events?id=eq.notice-1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body).read_at).toEqual(expect.any(String));
    expect(host.querySelector('button')).toBeNull();
  });

  it('does not query a private inbox when nobody is signed in', async () => {
    mocked.getSession.mockResolvedValue(null);
    await act(async () => {
      root.render(<NotificationInbox />);
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Nothing needs your attention right now.');
  });
});
