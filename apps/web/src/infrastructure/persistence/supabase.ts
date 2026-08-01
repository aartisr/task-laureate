import type { SupabasePersistenceConfig } from './config';
import { assertSupabaseConfig } from './config';
import { parseWorkspaceExport, type WorkspaceExport, type WorkspacePersistenceAdapter } from './workspace';

type SnapshotRow = { workspace_id: string; version: number; payload: unknown; updated_at: string };
type FetchLike = typeof fetch;

/**
 * A one-row-per-workspace adapter using Supabase's PostgREST Data API directly.
 * This avoids a runtime SDK dependency while retaining the same supported
 * upsert semantics; inject `fetch` in tests or specialised runtimes.
 */
export function createSupabaseWorkspaceAdapter(config: SupabasePersistenceConfig, request: FetchLike = fetch): WorkspacePersistenceAdapter {
  assertSupabaseConfig(config);
  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(config.table)}`;
  const headers = {
    apikey: config.publishableKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Profile': config.schema,
    'Content-Profile': config.schema,
  };
  const requestJson = async (url: string, init: RequestInit) => {
    const operation = init.method ?? 'GET';
    const accessToken = await config.getAccessToken?.() ?? null;
    if (config.requireAuth && !accessToken) throw new Error('Supabase workspace persistence requires an authenticated access token. Configure getAccessToken or explicitly set requireAuth: false with restrictive anon RLS policies.');
    console.info('[Task-Laureate persistence] Supabase request', { operation, workspaceId: config.workspaceId, table: config.table });
    const response = await request(url, { ...init, headers: { ...headers, Authorization: `Bearer ${accessToken ?? config.publishableKey}`, ...init.headers } });
    if (!response.ok) {
      let details = response.statusText;
      try { details = (await response.json() as { message?: string }).message ?? details; } catch { /* non-JSON response */ }
      console.error('[Task-Laureate persistence] Supabase request failed', { operation, workspaceId: config.workspaceId, table: config.table, status: response.status, details });
      throw new Error(`Supabase workspace persistence failed (HTTP ${response.status}): ${details}`);
    }
    console.info('[Task-Laureate persistence] Supabase request succeeded', { operation, workspaceId: config.workspaceId, table: config.table, status: response.status });
    return response;
  };

  return {
    async load() {
      const response = await requestJson(`${endpoint}?workspace_id=eq.${encodeURIComponent(config.workspaceId)}&select=workspace_id,version,payload,updated_at&limit=1`, { method: 'GET' });
      const rows = await response.json() as SnapshotRow[];
      const data = rows[0];
      if (!data) return null;
      // Validate even trusted database content; it protects the app after manual edits or migrations.
      return parseWorkspaceExport({ format: 'task-laureate/workspace', version: data.version, exportedAt: data.updated_at, data: data.payload });
    },
    async save(workspace: WorkspaceExport) {
      await requestJson(`${endpoint}?on_conflict=workspace_id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{
        workspace_id: config.workspaceId,
        version: workspace.version,
        payload: workspace.data,
        updated_at: workspace.exportedAt,
        }]),
      });
    },
    async clear() {
      await requestJson(`${endpoint}?workspace_id=eq.${encodeURIComponent(config.workspaceId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
  };
}
