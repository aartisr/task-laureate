import { describe, expect, it } from 'vitest';
import { createTestWorkspace } from '../../test/fixtures/workspace';
import { createWorkspaceExport } from './workspace';
import { createSupabaseWorkspaceAdapter } from './supabase';

const config = { url: 'https://example.supabase.co', publishableKey: 'publishable-key', workspaceId: 'main', table: 'workspace_snapshots', schema: 'public', debounceMs: 1, fallbackToLocal: false, requireAuth: true };

describe('Supabase workspace adapter', () => {
  it('uses one authenticated upsert for the entire workspace', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const request = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response('', { status: 201 });
    };
    const adapter = createSupabaseWorkspaceAdapter({ ...config, getAccessToken: () => 'user-jwt' }, request as typeof fetch);
    await adapter.save(createWorkspaceExport(createTestWorkspace()));
    expect(requests[0].url).toContain('on_conflict=workspace_id');
    expect(requests[0].init?.method).toBe('POST');
    expect(new Headers(requests[0].init?.headers).get('Authorization')).toBe('Bearer user-jwt');
    expect(JSON.parse(String(requests[0].init?.body))).toHaveLength(1);
  });

  it('validates snapshots loaded from the database', async () => {
    const adapter = createSupabaseWorkspaceAdapter({ ...config, getAccessToken: () => 'user-jwt' }, async () => new Response(JSON.stringify([{ workspace_id: 'main', version: 1, payload: createTestWorkspace(), updated_at: '2026-01-01T00:00:00.000Z' }])) as Response);
    await expect(adapter.load()).resolves.toMatchObject({ format: 'task-laureate/workspace', version: 1 });
  });
});
