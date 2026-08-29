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

  it('accepts a plan through one atomic RPC with its provenance', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      requests.push({ endpoint: String(url), init });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    await repository.saveAcceptedSteps('task-id', [{ title: 'Call the clinic', estimateMinutes: 10, energyLevel: 'quick' }], 'ai');
    expect(requests[0].endpoint).toContain('/rpc/accept_task_plan');
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ p_task_id: 'task-id', p_origin: 'ai', p_steps: [{ title: 'Call the clinic' }] });
  });

  it('loads the durable event feed used by the retrospective', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      requests.push({ endpoint: String(url), init });
      return new Response(JSON.stringify([{ id: 'event-1', task_id: 'task-id', event_type: 'completed', occurred_at: '2026-08-13T12:00:00Z', payload: { estimateMinutes: 30, energyLevel: 'deep' } }]), { status: 200 });
    });
    await expect(repository.listTaskEvents({ since: '2026-08-06T00:00:00Z', limit: 20 })).resolves.toEqual([expect.objectContaining({ taskId: 'task-id', type: 'completed', payload: { estimateMinutes: 30, energyLevel: 'deep' } })]);
    expect(requests[0].endpoint).toContain('/task_events?select=id,task_id,event_type,occurred_at,payload');
    expect(requests[0].endpoint).toContain('occurred_at=gte.2026-08-06T00%3A00%3A00Z');
  });

  it('removes attachment variants through the Storage API before deleting metadata', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      const endpoint = String(url); requests.push({ endpoint, init });
      return new Response(null, { status: 204 });
    });

    await repository.deleteAttachment({
      id: 'attachment-id', taskId: 'task-id', name: 'reference.pdf', contentType: 'application/pdf', byteSize: 20,
      kind: 'pdf', status: 'ready', objectPath: 'tasks/task-id/attachment-id/original', thumbnailPath: 'tasks/task-id/attachment-id/thumbnail', previewPath: null, createdAt: '2026-08-01T00:00:00Z',
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].endpoint).toContain('/storage/v1/object/task-attachments');
    expect(requests[0].init?.method).toBe('DELETE');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ prefixes: ['tasks/task-id/attachment-id/original', 'tasks/task-id/attachment-id/thumbnail'] });
    expect(requests[1].endpoint).toContain('/task_attachments?id=eq.attachment-id');
    expect(requests[1].init?.method).toBe('DELETE');
  });

  it('creates a directed finish-to-start dependency and reads it back', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const dependency = {
      id: 'edge-id', prerequisite_task_id: 'prepare-id', dependent_task_id: 'publish-id', dependency_type: 'finish_to_start', is_required: true, created_at: '2026-08-03T00:00:00Z',
      prerequisite: { id: 'prepare-id', title: 'Prepare evidence', status: 'todo', due_date: null },
      dependent: { id: 'publish-id', title: 'Publish report', status: 'todo', due_date: null },
    };
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      const endpoint = String(url); requests.push({ endpoint, init });
      if (init?.method === 'POST') return new Response(JSON.stringify([{ id: 'edge-id' }]), { status: 201 });
      if (endpoint.includes('dependent_task_id=eq.publish-id')) return new Response(JSON.stringify([dependency]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const created = await repository.createDependency({ prerequisiteTaskId: 'prepare-id', dependentTaskId: 'publish-id' });

    expect(created.prerequisiteTask.title).toBe('Prepare evidence');
    expect(created.dependentTask.title).toBe('Publish report');
    expect(requests[0].endpoint).toContain('/task_dependencies?select=id');
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ prerequisite_task_id: 'prepare-id', dependent_task_id: 'publish-id', dependency_type: 'finish_to_start', is_required: true });
  });

  it('loads dependency pulses for a task list in one bounded RPC', async () => {
    const requests: Array<{ endpoint: string; init?: RequestInit }> = [];
    const repository = createSupabaseCollaborationTodoRepository(config, async (url, init) => {
      requests.push({ endpoint: String(url), init });
      return new Response(JSON.stringify([{ task_id: 'blocked-task', unresolved_prerequisite_count: 2, dependent_count: 1 }]), { status: 200 });
    });

    const summaries = await repository.getDependencySummaries(['blocked-task', 'ready-task']);

    expect(requests[0].endpoint).toContain('/rpc/get_task_dependency_summaries');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ p_task_ids: ['blocked-task', 'ready-task'] });
    expect(summaries['blocked-task']).toEqual({ unresolvedPrerequisiteCount: 2, dependentCount: 1, isReadyToComplete: false });
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
