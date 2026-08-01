import { afterEach, describe, expect, it } from 'vitest';
import { persistenceConfig } from '../../config/persistence.config';
import { seedData } from '../mock/seed';
import { createSupabaseWorkspaceAdapter } from './supabase';
import { createWorkspaceExport } from './workspace';

/**
 * A real Supabase readiness check. It is deliberately opt-in: it creates and
 * deletes one unique row, so it must only run against an isolated test user.
 *
 * Run with RUN_SUPABASE_INTEGRATION=true and SUPABASE_TEST_ACCESS_TOKEN set.
 * The test token must belong to a non-service-role user permitted by the RLS
 * policies in supabase/migrations/001_workspace_snapshots.sql.
 */
const environment = (globalThis as typeof globalThis & { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const enabled = environment.RUN_SUPABASE_INTEGRATION === 'true';
const testToken = environment.SUPABASE_TEST_ACCESS_TOKEN;
const workspaceId = `supabase_test_${crypto.randomUUID().replaceAll('-', '')}`;
const supabase = persistenceConfig.supabase;
const endpoint = () => `${supabase.url?.replace(/\/$/, '')}/rest/v1/${supabase.table}`;

type SnapshotRow = {
  workspace_id: string;
  owner_id: string;
  version: number;
  payload: { lists: unknown[]; tasks: unknown[]; activity: unknown[]; templates: unknown[] };
  created_at: string;
  updated_at: string;
};

function assertConfigured() {
  expect(supabase.url, 'VITE_SUPABASE_URL must be set').toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
  expect(supabase.url, 'VITE_SUPABASE_URL cannot use the documentation placeholder').not.toContain('your-project');
  expect(supabase.publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY must be set').toBeTruthy();
  expect(supabase.publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY cannot use the documentation placeholder').not.toBe('your_publishable_key');
  expect(persistenceConfig.driver, 'The app must be configured to use Supabase').toBe('supabase');
  expect(supabase.requireAuth, 'Production persistence must require authenticated requests').toBe(true);
  expect(supabase.table).toBe('workspace_snapshots');
  expect(supabase.schema).toBe('public');
  expect(typeof supabase.getAccessToken, 'Connect getAccessToken to the app auth session before enabling Supabase persistence').toBe('function');
  expect(testToken, 'SUPABASE_TEST_ACCESS_TOKEN is required for this live integration test').toBeTruthy();

  const encodedPayload = (testToken!.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const tokenPayload = JSON.parse(atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '='))) as { role?: string };
  expect(tokenPayload.role, 'Never run this browser-style CRUD test with a service-role key/token').not.toBe('service_role');
}

async function selectTestRow(): Promise<SnapshotRow[]> {
  const response = await fetch(`${endpoint()}?workspace_id=eq.${workspaceId}&select=workspace_id,owner_id,version,payload,created_at,updated_at`, {
    headers: {
      apikey: supabase.publishableKey!,
      Authorization: `Bearer ${testToken!}`,
      'Accept-Profile': supabase.schema,
    },
  });
  expect(response.status, await response.text()).toBe(200);
  return response.json() as Promise<SnapshotRow[]>;
}

describe.runIf(enabled)('Supabase production-readiness integration', () => {
  afterEach(async () => {
    if (!testToken || !supabase.url || !supabase.publishableKey) return;
    await fetch(`${endpoint()}?workspace_id=eq.${workspaceId}`, {
      method: 'DELETE',
      headers: {
        apikey: supabase.publishableKey,
        Authorization: `Bearer ${testToken}`,
        'Content-Profile': supabase.schema,
        Prefer: 'return=minimal',
      },
    });
  });

  it('has a valid app configuration and reaches the Supabase Data API', async () => {
    assertConfigured();
    const response = await fetch(`${endpoint()}?select=workspace_id&limit=0`, {
      headers: { apikey: supabase.publishableKey!, Authorization: `Bearer ${testToken!}`, 'Accept-Profile': supabase.schema },
    });
    expect(response.status, `Cannot reach the configured Supabase table: ${await response.text()}`).toBe(200);
  });

  it('supports authenticated create, read, update, and delete with the required columns', async () => {
    assertConfigured();
    const adapter = createSupabaseWorkspaceAdapter({ ...supabase, workspaceId, getAccessToken: () => testToken! });

    const initial = createWorkspaceExport(seedData);
    await adapter.save(initial); // CREATE
    const first = await adapter.load(); // READ through the app adapter
    expect(first?.data).toEqual(initial.data);

    const rowsAfterCreate = await selectTestRow(); // Verifies the table and every required column are exposed.
    expect(rowsAfterCreate).toHaveLength(1);
    expect(rowsAfterCreate[0]).toMatchObject({ workspace_id: workspaceId, version: 1 });
    expect(rowsAfterCreate[0].payload).toEqual(initial.data);
    expect(rowsAfterCreate[0].owner_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isNaN(Date.parse(rowsAfterCreate[0].created_at))).toBe(false);
    expect(Number.isNaN(Date.parse(rowsAfterCreate[0].updated_at))).toBe(false);

    const updated = createWorkspaceExport({ ...seedData, lists: [...seedData.lists, { ...seedData.lists[0], id: 'supabase-integration-list', title: 'Updated by Supabase integration test' }] });
    await adapter.save(updated); // UPDATE via the workspace_id upsert
    const rowsAfterUpdate = await selectTestRow();
    expect(rowsAfterUpdate).toHaveLength(1);
    expect(rowsAfterUpdate[0].payload).toEqual(updated.data);

    await adapter.clear!(); // DELETE
    expect(await adapter.load()).toBeNull();
    expect(await selectTestRow()).toEqual([]);
  });
});
