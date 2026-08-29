import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './exception-reports.mjs';

let sequence = 0;
const originalEnvironment = { ...process.env };

function responseRecorder() {
  return {
    code: null,
    body: null,
    allow: null,
    status(code) { this.code = code; return this; },
    setHeader(name, value) { if (name === 'Allow') this.allow = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

function report(overrides = {}) {
  sequence += 1;
  return {
    diagnostic: {
      message: `Could not save task ${sequence}`,
      route: '/lists/example',
      occurredAt: '2026-08-16T17:00:00.000Z',
      source: 'promise',
      stack: 'Error: save failed',
      release: 'abc123',
      browser: 'Test Browser',
      ...overrides,
    },
    note: 'I pressed Save.',
  };
}

function request({ method = 'POST', authorization = 'Bearer session-token', body = report() } = {}) {
  return { method, headers: authorization ? { authorization } : {}, body };
}

function configuredEnvironment() {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'public-key';
  process.env.GITHUB_ISSUES_REPOSITORY = 'owner/support-reports';
  process.env.GITHUB_ISSUES_TOKEN = 'github-server-secret';
}

function authenticatedFetch(issue = { html_url: 'https://github.com/owner/support-reports/issues/42', number: 42 }) {
  return vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => issue });
}

describe('support exception-report endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    configuredEnvironment();
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.unstubAllGlobals();
  });

  it('permits only POST and does not contact third parties for invalid methods', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();

    await handler(request({ method: 'GET' }), response);

    expect(response.code).toBe(405);
    expect(response.allow).toBe('POST');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires an authenticated caller before it accepts a report', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();

    await handler(request({ authorization: '' }), response);

    expect(response.code).toBe(401);
    expect(response.body.message).toMatch(/sign in/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the GitHub credential or repository configuration is missing', async () => {
    delete process.env.GITHUB_ISSUES_TOKEN;
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();

    await handler(request(), response);

    expect(response.code).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed reports before authenticating or calling GitHub', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();

    await handler(request({ body: report({ route: 'https://untrusted.example' }) }), response);

    expect(response.code).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an expired session and never attempts to create a GitHub issue', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();

    await handler(request(), response);

    expect(response.code).toBe(401);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('creates a sanitized issue with a server-only GitHub authorization header', async () => {
    const fetch = authenticatedFetch();
    vi.stubGlobal('fetch', fetch);
    const response = responseRecorder();
    const body = report({
      message: 'Token=super-secret could not save https://example.test/x?private=value',
      stack: 'Authorization: Bearer abc.def.ghi\napi_key=not-for-github',
      route: '/lists/example?share=hidden',
    });
    body.note = 'password=hunter2 github_pat_sensitive https://example.test/help?email=hidden';

    await handler(request({ body }), response);

    expect(response.code).toBe(201);
    expect(response.body).toEqual({ issueUrl: 'https://github.com/owner/support-reports/issues/42', issueNumber: 42 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://project.supabase.co/auth/v1/user');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
    expect(fetch.mock.calls[1][0]).toBe('https://api.github.com/repos/owner/support-reports/issues');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer github-server-secret');
    const issue = JSON.parse(fetch.mock.calls[1][1].body);
    expect(issue.title).not.toContain('super-secret');
    expect(issue.body).toMatch(/token=\[REDACTED\]/i);
    expect(issue.body).toContain('password=[REDACTED]');
    expect(issue.body).toContain('Authorization: Bearer [REDACTED]');
    expect(issue.body).toContain('/lists/example');
    expect(issue.body).not.toMatch(/super-secret|hunter2|github_pat_sensitive|private=value|email=hidden|share=hidden|not-for-github/);
  });

  it('returns a friendly failure when GitHub rejects issue creation', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: `user-${sequence}` }) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = responseRecorder();

    await handler(request(), response);

    expect(response.code).toBe(502);
    expect(response.body.message).toMatch(/could not create/i);
  });

  it('returns the existing issue on a repeat without creating a duplicate', async () => {
    const uniqueMessage = `Duplicate-safe report ${Date.now()}-${sequence}`;
    const payload = report({ message: uniqueMessage });
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-duplicate' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ html_url: 'https://github.com/owner/support-reports/issues/43', number: 43 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-duplicate' }) });
    vi.stubGlobal('fetch', fetch);
    const first = responseRecorder();
    const second = responseRecorder();

    await handler(request({ body: payload }), first);
    await handler(request({ body: payload }), second);

    expect(first.code).toBe(201);
    expect(second.code).toBe(200);
    expect(second.body).toEqual({ issueUrl: 'https://github.com/owner/support-reports/issues/43', issueNumber: 43, duplicate: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('api.github.com'))).toHaveLength(1);
  });
});
