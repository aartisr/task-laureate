import { afterEach, describe, expect, it } from 'vitest';
import { persistenceConfig } from '../../config/persistence.config';

/**
 * Opt-in, live proof of the owner/editor/viewer permission matrix.
 *
 * It needs three isolated non-production user sessions. The test creates a
 * disposable List and Tasks and removes them afterwards. Accepted invitation
 * audit records are intentionally retained by the production schema, so never
 * run it against customer accounts or a production data set.
 */
const environment = (globalThis as typeof globalThis & { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const enabled = environment.RUN_SUPABASE_PERMISSION_INTEGRATION === 'true';
const supabase = persistenceConfig.supabase;
const tokens = {
  owner: environment.SUPABASE_TEST_OWNER_ACCESS_TOKEN,
  editor: environment.SUPABASE_TEST_EDITOR_ACCESS_TOKEN,
  viewer: environment.SUPABASE_TEST_VIEWER_ACCESS_TOKEN,
};
const createdListIds = new Set<string>();

type Identity = { token: string; userId: string; email: string; role?: string };
type ListRow = { id: string; title: string };
type TaskRow = { id: string; title: string; list_id: string };
type CollaboratorRow = { user_id: string; email: string; role: 'editor' | 'viewer' };

function decodeIdentity(token: string | undefined, label: string): Identity {
  expect(token, `${label} access token is required`).toBeTruthy();
  const parts = token!.split('.');
  expect(parts, `${label} token must be a three-part user-session JWT`).toHaveLength(3);
  const encoded = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { sub?: string; email?: string; role?: string };
  expect(payload.role, `${label} must not use a service-role token`).not.toBe('service_role');
  expect(payload.sub, `${label} JWT must contain the signed-in user ID`).toMatch(/^[0-9a-f-]{36}$/i);
  expect(payload.email, `${label} JWT must contain a verified user email for invitation acceptance`).toMatch(/@/);
  return { token: token!, userId: payload.sub!, email: payload.email!.toLowerCase(), role: payload.role };
}

function configured() {
  expect(supabase.url, 'VITE_SUPABASE_URL must be configured').toBeTruthy();
  expect(supabase.publishableKey, 'VITE_SUPABASE_PUBLISHABLE_KEY must be configured').toBeTruthy();
  expect(supabase.requireAuth, 'Supabase persistence must require authentication').toBe(true);
  return { url: supabase.url!, key: supabase.publishableKey! };
}

async function api<T>(identity: Identity, path: string, init: RequestInit = {}): Promise<{ response: Response; body: T }> {
  const { url, key } = configured();
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
  });
  const text = await response.text();
  let body: T;
  try { body = JSON.parse(text) as T; } catch { body = text as T; }
  return { response, body };
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function invite(owner: Identity, recipient: Identity, listId: string, role: 'editor' | 'viewer') {
  const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const created = await api<string>(owner, '/rpc/create_share_invitation', {
    method: 'POST',
    body: JSON.stringify({ p_resource_type: 'list', p_resource_id: listId, p_email_normalized: recipient.email, p_role: role, p_token_digest: await digest(rawToken), p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
  });
  expect(created.response.status, `Owner could not invite ${role}: ${String(created.body)}`).toBe(200);
  const accepted = await api<{ resourceType: string; resourceId: string; role: string }>(recipient, '/rpc/accept_share_invitation', { method: 'POST', body: JSON.stringify({ p_token: rawToken }) });
  expect(accepted.response.status, `${role} could not accept their invitation: ${String(accepted.body)}`).toBe(200);
  expect(accepted.body).toMatchObject({ resourceType: 'list', resourceId: listId, role });
  return rawToken;
}

async function cleanup() {
  if (!tokens.owner || !supabase.url || !supabase.publishableKey) return;
  const owner = decodeIdentity(tokens.owner, 'Owner');
  await Promise.all([...createdListIds].map(async (listId) => {
    const result = await api<unknown>(owner, `/collaboration_lists?id=eq.${encodeURIComponent(listId)}`, { method: 'DELETE', headers: { 'Content-Profile': supabase.schema, Prefer: 'return=minimal' } });
    expect(result.response.status, `Could not remove permission-test List ${listId}: ${String(result.body)}`).toBe(204);
  }));
  createdListIds.clear();
}

describe.runIf(enabled)('Supabase collaborator permission matrix', () => {
  afterEach(cleanup);

  it('enforces owner, editor, and viewer capabilities through RLS', async () => {
    const owner = decodeIdentity(tokens.owner, 'Owner');
    const editor = decodeIdentity(tokens.editor, 'Editor');
    const viewer = decodeIdentity(tokens.viewer, 'Viewer');
    expect(new Set([owner.userId, editor.userId, viewer.userId]).size, 'Owner, editor, and viewer must be three different accounts').toBe(3);
    configured();

    const suffix = crypto.randomUUID();
    const privateList = await api<ListRow | ListRow[]>(owner, '/rpc/create_collaboration_list', { method: 'POST', body: JSON.stringify({ p_title: `Private matrix ${suffix}`, p_description: '' }) });
    expect(privateList.response.status, String(privateList.body)).toBe(200);
    const privateListId = (Array.isArray(privateList.body) ? privateList.body[0] : privateList.body).id;
    createdListIds.add(privateListId);

    const sharedList = await api<ListRow | ListRow[]>(owner, '/rpc/create_collaboration_list', { method: 'POST', body: JSON.stringify({ p_title: `Shared matrix ${suffix}`, p_description: 'Disposable RLS integration fixture.' }) });
    expect(sharedList.response.status, String(sharedList.body)).toBe(200);
    const sharedListId = (Array.isArray(sharedList.body) ? sharedList.body[0] : sharedList.body).id;
    createdListIds.add(sharedListId);

    const ownerTask = await api<TaskRow | TaskRow[]>(owner, '/rpc/create_collaboration_task', { method: 'POST', body: JSON.stringify({ p_list_id: sharedListId, p_title: `Owner task ${suffix}`, p_note_document: '', p_priority: 'medium', p_due_date: null, p_tags: [], p_order_key: Date.now() }) });
    expect(ownerTask.response.status, String(ownerTask.body)).toBe(200);
    const taskId = (Array.isArray(ownerTask.body) ? ownerTask.body[0] : ownerTask.body).id;

    const editorInvitationToken = await invite(owner, editor, sharedListId, 'editor');
    await invite(owner, viewer, sharedListId, 'viewer');

    // This exercises the SECURITY DEFINER roster boundary through PostgREST
    // with a real signed owner JWT. It catches both authorization regressions
    // and a PL/pgSQL RETURN QUERY fall-through before production.
    const ownerRoster = await api<CollaboratorRow[]>(owner, '/rpc/list_resource_collaborators', {
      method: 'POST',
      body: JSON.stringify({ p_resource_type: 'list', p_resource_id: sharedListId }),
    });
    expect(ownerRoster.response.status, String(ownerRoster.body)).toBe(200);
    expect(ownerRoster.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: editor.userId, email: editor.email, role: 'editor' }),
      expect.objectContaining({ user_id: viewer.userId, email: viewer.email, role: 'viewer' }),
    ]));

    // A mail client, browser history, or a second tap may reopen an accepted
    // link. The recipient must still reach this exact List, not a dead end.
    const reopenAcceptedInvite = await api<{ resourceType: string; resourceId: string; role: string }>(editor, '/rpc/accept_share_invitation', { method: 'POST', body: JSON.stringify({ p_token: editorInvitationToken }) });
    expect(reopenAcceptedInvite.response.status, String(reopenAcceptedInvite.body)).toBe(200);
    expect(reopenAcceptedInvite.body).toMatchObject({ resourceType: 'list', resourceId: sharedListId, role: 'editor' });

    const editorPrivateRead = await api<ListRow[]>(editor, `/collaboration_lists?id=eq.${encodeURIComponent(privateListId)}&select=id`);
    expect(editorPrivateRead.response.status).toBe(200);
    expect(editorPrivateRead.body).toEqual([]);

    const editorAccess = await api<string>(editor, '/rpc/get_collaboration_resource_access', { method: 'POST', body: JSON.stringify({ p_resource_type: 'list', p_resource_id: sharedListId }) });
    expect(editorAccess.body).toBe('editor');
    const editorUpdate = await api<TaskRow[]>(editor, `/collaboration_tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: `Edited by editor ${suffix}` }) });
    expect(editorUpdate.response.status, String(editorUpdate.body)).toBe(200);
    expect(editorUpdate.body).toHaveLength(1);

    const viewerAccess = await api<string>(viewer, '/rpc/get_collaboration_resource_access', { method: 'POST', body: JSON.stringify({ p_resource_type: 'list', p_resource_id: sharedListId }) });
    expect(viewerAccess.body).toBe('viewer');
    const viewerRead = await api<TaskRow[]>(viewer, `/collaboration_tasks?list_id=eq.${encodeURIComponent(sharedListId)}&select=id,title`);
    expect(viewerRead.response.status).toBe(200);
    expect(viewerRead.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId, title: `Edited by editor ${suffix}` })]));
    const viewerUpdate = await api<TaskRow[]>(viewer, `/collaboration_tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: 'Viewer must not write' }) });
    expect(viewerUpdate.response.status).toBe(200);
    expect(viewerUpdate.body).toEqual([]);
    const ownerRead = await api<TaskRow[]>(owner, `/collaboration_tasks?id=eq.${encodeURIComponent(taskId)}&select=id,title`);
    expect(ownerRead.body).toEqual([expect.objectContaining({ id: taskId, title: `Edited by editor ${suffix}` })]);

    const revoke = await api<unknown>(owner, '/rpc/revoke_resource_access', { method: 'POST', body: JSON.stringify({ p_resource_type: 'list', p_resource_id: sharedListId, p_user_id: viewer.userId }) });
    expect(revoke.response.status, String(revoke.body)).toBe(204);
    const viewerAfterRevoke = await api<ListRow[]>(viewer, `/collaboration_lists?id=eq.${encodeURIComponent(sharedListId)}&select=id`);
    expect(viewerAfterRevoke.response.status).toBe(200);
    expect(viewerAfterRevoke.body).toEqual([]);
  });
});
