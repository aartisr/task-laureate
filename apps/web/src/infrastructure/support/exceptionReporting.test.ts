import { afterEach, describe, expect, it, vi } from 'vitest';
import { authProvider } from '../../config/persistence.config';
import { createExceptionReportDraft, sanitizeSupportNote, submitExceptionReport } from './exceptionReporting';

describe('support-report sanitization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('removes common credentials and URL query strings before a report leaves the browser', () => {
    const report = sanitizeSupportNote('token=secret-value Authorization: Bearer abc.def.ghi https://example.test/tasks?invite=hidden github_pat_abc123');

    expect(report).toContain('token=[REDACTED]');
    expect(report).toContain('Authorization: Bearer [REDACTED]');
    expect(report).toContain('https://example.test/tasks');
    expect(report).not.toContain('secret-value');
    expect(report).not.toContain('invite=hidden');
    expect(report).not.toContain('github_pat_abc123');
  });

  it('does not retain a JWT-shaped value', () => {
    const jwt = `eyJ${'a'.repeat(12)}.payload.signature`;
    expect(sanitizeSupportNote(jwt)).toBe('[REDACTED]');
  });

  it('creates a bounded, query-free diagnostic preview from the current route', () => {
    window.history.replaceState({}, '', '/lists/work?share=do-not-report');
    const error = new Error(`token=not-safe ${'x'.repeat(1_000)}`);
    error.stack = `Authorization: Bearer abc.def.ghi\n${'s'.repeat(7_000)}`;

    const draft = createExceptionReportDraft(error, 'promise');

    expect(draft.route).toBe('/lists/work');
    expect(draft.source).toBe('promise');
    expect(draft.message).toContain('token=[REDACTED]');
    expect(draft.message).not.toContain('not-safe');
    expect(draft.message.length).toBeLessThanOrEqual(600);
    expect(draft.stack).toContain('Authorization: Bearer [REDACTED]');
    expect(draft.stack?.length).toBeLessThanOrEqual(6_000);
  });

  it('sends only a sanitized, authenticated payload when the user explicitly submits', async () => {
    const session = { user: { id: 'user-1', email: 'person@example.test', provider: null }, accessToken: 'session-token' };
    vi.spyOn(authProvider, 'getSession').mockResolvedValue(session);
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ issueUrl: 'https://github.com/owner/repo/issues/7', issueNumber: 7 }) });
    vi.stubGlobal('fetch', fetch);
    const draft = createExceptionReportDraft(new Error('Could not update task'), 'window');

    await expect(submitExceptionReport(draft, 'api_key=private-value')).resolves.toEqual({ issueUrl: 'https://github.com/owner/repo/issues/7', issueNumber: 7 });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe('/api/support/exception-reports');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload.note).toBe('api_key=[REDACTED]');
    expect(payload.note).not.toContain('private-value');
  });

  it('does not call the endpoint when there is no active session', async () => {
    vi.spyOn(authProvider, 'getSession').mockResolvedValue(null);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const draft = createExceptionReportDraft(new Error('Could not update task'));

    await expect(submitExceptionReport(draft, '')).rejects.toThrow(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});
