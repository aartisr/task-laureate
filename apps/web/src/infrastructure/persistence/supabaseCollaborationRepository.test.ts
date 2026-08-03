import { describe, expect, it } from 'vitest';
import { createSupabaseCollaborationTodoRepository } from './supabaseCollaborationRepository';

const config = {
  url: 'https://example.supabase.co', publishableKey: 'publishable-key', workspaceId: 'main', table: 'workspace_snapshots', schema: 'public', debounceMs: 1, fallbackToLocal: false, requireAuth: true,
  getAccessToken: () => 'member-jwt',
};

describe('normalized collaboration repository', () => {
  it('initializes a normalized workspace and never writes a snapshot', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      const endpoint = String(url); requests.push({ endpoint, init });
      if (endpoint.includes('/rpc/create_collaboration_list')) return new Response(JSON.stringify({ id: 'list-id', title: 'Launch', description: '', status: 'active', created_at: '2026-08-03T00:00:00Z', updated_at: '2026-08-03T00:00:00Z', deleted_at: null }), { status: 200 });
      throw new Error(`Unexpected request: ${endpoint}`);
    });

    await repository.createList({ title: 'Launch' });

    expect(requests.map((request) => request.endpoint)).toEqual([expect.stringContaining('/rpc/create_collaboration_list')]);
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ p_title: 'Launch', p_description: '' });
    expect(requests.map((request) => request.endpoint).join('\n')).not.toContain('workspace_snapshots');
  });

  it('creates Tasks through the owner-safe task RPC', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      const endpoint = String(url); requests.push({ endpoint, init });
      return new Response(JSON.stringify({ id: 'task-id', list_id: 'list-id', title: 'Write brief', note_document: '', status: 'todo', priority: 'medium', due_date: null, tags: [], order_key: 1, created_at: '2026-08-03T00:00:00Z', updated_at: '2026-08-03T00:00:00Z', completed_at: null, deleted_at: null }), { status: 200 });
    });
    await repository.createTask({ listId: 'list-id', title: 'Write brief' });
    expect(requests[0].endpoint).toContain('/rpc/create_collaboration_task');
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ p_list_id: 'list-id', p_title: 'Write brief' });
  });

  it('fails fast after discovering a missing collaboration migration', async () => {
    let calls = 0;
    const repository = createSupabaseCollaborationTodoRepository(config, async () => {
      calls += 1;
      return new Response(JSON.stringify({ message: 'Could not find the function public.create_collaboration_list' }), { status: 404 });
    });
    await expect(repository.createList({ title: 'Launch' })).rejects.toThrow('schema cache');
    await expect(repository.createList({ title: 'Retry' })).rejects.toThrow('schema cache');
    expect(calls).toBe(1);
  });
});
