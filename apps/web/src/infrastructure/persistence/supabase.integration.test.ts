import { afterEach, describe, expect, it } from 'vitest';
import { persistenceConfig } from '../../config/persistence.config';
import { createSupabaseCollaborationTodoRepository } from './supabaseCollaborationRepository';

/**
 * A real Supabase readiness check for the active, normalized collaboration
 * persistence model. It is deliberately opt-in: it creates and deletes a
 * unique List and Task, so it must only run against an isolated test user.
 *
 * Run with RUN_SUPABASE_INTEGRATION=true and SUPABASE_TEST_ACCESS_TOKEN set.
 * The token must belong to a non-service-role user permitted by the RLS
 * policies in supabase/migrations/005_collaboration_foundation.sql onward.
 *
 * `workspace_snapshots` was retired by migration 006. Do not restore it just
 * to make this test pass; this test protects the current collaboration schema.
 */
const environment = (globalThis as typeof globalThis & { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const enabled = environment.RUN_SUPABASE_INTEGRATION === 'true';
const testToken = environment.SUPABASE_TEST_ACCESS_TOKEN;
const supabase = persistenceConfig.supabase;
const testListIds = new Set<string>();

function assertConfigured() {
  expect(supabase.url, 'VITE_SUPABASE_URL must be set').toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
  expect(supabase.url, 'VITE_SUPABASE_URL cannot use the documentation placeholder').not.toContain('your-project');
  expect(supabase.publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY must be set').toBeTruthy();
  expect(supabase.publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY cannot use the documentation placeholder').not.toBe('your_publishable_key');
  expect(persistenceConfig.driver, 'The app must be configured to use Supabase').toBe('supabase');
  expect(supabase.requireAuth, 'Production persistence must require authenticated requests').toBe(true);
  expect(supabase.schema).toBe('public');
  expect(typeof supabase.getAccessToken, 'Connect getAccessToken to the app auth session before enabling Supabase persistence').toBe('function');
  expect(testToken, 'SUPABASE_TEST_ACCESS_TOKEN is required for this live integration test').toBeTruthy();

  const tokenParts = testToken!.split('.');
  expect(
    tokenParts,
    'SUPABASE_TEST_ACCESS_TOKEN must be a signed user-session JWT (three dot-separated segments). Use the access_token returned after signing in as an isolated test user—not VITE_SUPABASE_PUBLISHABLE_KEY, an sb_publishable_* project key, a refresh token, or a service-role key.',
  ).toHaveLength(3);

  const encodedPayload = (tokenParts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  let tokenPayload: { role?: string };
  try {
    tokenPayload = JSON.parse(atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '='))) as { role?: string };
  } catch {
    throw new Error('SUPABASE_TEST_ACCESS_TOKEN must contain a valid JSON JWT payload. Obtain a fresh user access_token from Supabase Auth for an isolated test account; do not use the project publishable key or a service-role key.');
  }
  expect(tokenPayload.role, 'Never run this browser-style CRUD test with a service-role key/token').not.toBe('service_role');
}

function createRepository() {
  return createSupabaseCollaborationTodoRepository({ ...supabase, getAccessToken: () => testToken! });
}

async function deleteCreatedLists() {
  if (!testToken || !supabase.url || !supabase.publishableKey) return;
  const url = supabase.url;
  const publishableKey = supabase.publishableKey;
  await Promise.all([...testListIds].map(async (listId) => {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/collaboration_lists?id=eq.${encodeURIComponent(listId)}`, {
      method: 'DELETE',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${testToken}`,
        'Content-Profile': supabase.schema,
        Prefer: 'return=minimal',
      },
    });
    expect(response.status, `Could not clean up integration-test List ${listId}: ${await response.text()}`).toBe(204);
  }));
  testListIds.clear();
}

describe.runIf(enabled)('Supabase production-readiness integration', () => {
  afterEach(deleteCreatedLists);

  it('has a valid app configuration and reaches the active collaboration Data API', async () => {
    assertConfigured();
    await expect(createRepository().listLists()).resolves.toEqual(expect.any(Array));
  });

  it('supports authenticated List and Task create, read, update, and cleanup through RLS', async () => {
    assertConfigured();
    const repository = createRepository();
    const suffix = crypto.randomUUID();
    const list = await repository.createList({ title: `Supabase integration ${suffix}`, description: 'Temporary RLS-protected integration fixture.' });
    testListIds.add(list.id);
    expect(list).toMatchObject({ id: expect.any(String), title: `Supabase integration ${suffix}`, status: 'active' });

    const task = await repository.createTask({ listId: list.id, title: `CRUD task ${suffix}`, notes: 'Initial integration-test note.', priority: 'medium', tags: ['integration-test'] });
    expect(task).toMatchObject({ id: expect.any(String), listId: list.id, priority: 'medium', status: 'todo', tags: ['integration-test'] });

    const read = await repository.getTask(task.id);
    expect(read).toMatchObject({ id: task.id, notes: 'Initial integration-test note.' });

    const updated = await repository.updateTask(task.id, { title: `Updated CRUD task ${suffix}`, notes: 'Updated integration-test note.', priority: 'high' });
    expect(updated).toMatchObject({ id: task.id, title: `Updated CRUD task ${suffix}`, notes: 'Updated integration-test note.', priority: 'high' });

    const deleted = await repository.deleteTask(task.id);
    expect(deleted).toMatchObject({ id: task.id, status: 'deleted' });
  });

  it('proves idempotent creation, execution-event persistence, and retrospective reads end to end', async () => {
    assertConfigured();
    const repository = createRepository();
    const suffix = crypto.randomUUID();
    const listKey = `integration:list:${suffix}`;
    const list = await repository.createListIdempotent({ title: `Offline-safe ${suffix}`, description: 'Disposable durable-sync fixture.' }, listKey);
    testListIds.add(list.id);
    const repeatedList = await repository.createListIdempotent({ title: `Offline-safe ${suffix}`, description: 'Disposable durable-sync fixture.' }, listKey);
    expect(repeatedList.id).toBe(list.id);

    const taskKey = `integration:task:${suffix}`;
    const task = await repository.createTaskIdempotent({ listId: list.id, title: `Execution evidence ${suffix}`, priority: 'medium' }, taskKey);
    const repeatedTask = await repository.createTaskIdempotent({ listId: list.id, title: `Execution evidence ${suffix}`, priority: 'medium' }, taskKey);
    expect(repeatedTask.id).toBe(task.id);

    await repository.saveTaskPlanning(task.id, { estimateMinutes: 30, energyLevel: 'deep', scheduledStartAt: null, parentTaskId: null, needsClarity: false });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await repository.updateTask(task.id, { dueDate: tomorrow });
    await repository.recordTaskEvent({ taskId: task.id, type: 'snoozed', occurredAt: new Date().toISOString(), idempotencyKey: `integration:snoozed:${suffix}`, payload: { until: tomorrow } });
    await repository.updateTask(task.id, { status: 'blocked' });
    await repository.recordTaskEvent({ taskId: task.id, type: 'parked', occurredAt: new Date().toISOString(), idempotencyKey: `integration:parked:${suffix}` });
    await repository.completeTask(task.id, true);
    await repository.recordTaskEvent({ taskId: task.id, type: 'completed', occurredAt: new Date().toISOString(), idempotencyKey: `integration:completed:${suffix}`, payload: { estimateMinutes: 30, energyLevel: 'deep' } });

    const events = await repository.listTaskEvents({ since: new Date(Date.now() - 60_000).toISOString(), limit: 50 });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: task.id, type: 'snoozed', payload: expect.objectContaining({ until: tomorrow }) }),
      expect.objectContaining({ taskId: task.id, type: 'parked' }),
      expect.objectContaining({ taskId: task.id, type: 'completed', payload: expect.objectContaining({ estimateMinutes: 30, energyLevel: 'deep' }) }),
    ]));
  });
});
