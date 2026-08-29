import { createHash, randomUUID } from 'node:crypto';
import { googleTaskEventPayload, isMissingGoogleEventStatus, ownedEventChange, shouldApply, isFreshNotification } from './reconciliation.mjs';
import { callbackUrl, calendarConfigurationIssue, config, createState, decrypt, encrypt, fullyConfigured, google, googleAuthorizationUrl, readState, refreshGoogleAccessToken, respond, service, userFromRequest, userRpc, webhookToken, webhookUrl } from './shared.mjs';

const only = (request, response, method) => request.method === method || (response.setHeader('Allow', method), respond(response, 405, { code: 'method_not_allowed' }));
const redirect = (response, location) => { response.setHeader('Cache-Control', 'no-store'); response.writeHead(302, { Location: location }); response.end(); };
const connectionFor = async (value, userId, id, select) => { const result = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(userId)}&provider=eq.google_calendar&select=${select}&limit=1`); return result.ok && Array.isArray(result.payload) ? result.payload[0] : null; };
const stableEventId = (taskId, connectionId) => `tl${taskId.replaceAll('-', '').slice(0, 24)}${connectionId.replaceAll('-', '').slice(0, 24)}`.slice(0, 1024);
const cursorFor = async (value, connectionId, calendarId) => {
  const result = await service(value, `calendar_sync_cursors?connection_id=eq.${encodeURIComponent(connectionId)}&provider=eq.google_calendar&calendar_id=eq.${encodeURIComponent(calendarId)}&select=*&limit=1`);
  return result.ok && Array.isArray(result.payload) ? result.payload[0] ?? null : null;
};
const saveCursor = (value, body) => service(value, 'calendar_sync_cursors?on_conflict=connection_id,provider,calendar_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify([body]) });

/** Register or renew a provider watch. A watch only wakes sync; it never carries event data. */
async function ensureGoogleWatch(value, row, calendarId) {
  const cursor = await cursorFor(value, row.id, calendarId);
  if (cursor?.channel_expires_at && Date.parse(cursor.channel_expires_at) > Date.now() + 24 * 60 * 60_000) return cursor;
  const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token));
  const channelId = randomUUID();
  const watched = await google(value, accessToken, `calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: 'POST', body: JSON.stringify({ id: channelId, type: 'web_hook', address: webhookUrl(value), token: webhookToken(value, row.id, calendarId) }),
  });
  if (!watched.ok || typeof watched.payload?.resourceId !== 'string') throw new Error('provider_unavailable');
  const token = webhookToken(value, row.id, calendarId);
  const saved = await saveCursor(value, { connection_id: row.id, provider: 'google_calendar', calendar_id: calendarId, sync_token: cursor?.sync_token ?? null, channel_id: channelId, channel_resource_id: watched.payload.resourceId, channel_token_hash: createHash('sha256').update(token).digest('hex'), channel_expires_at: watched.payload.expiration ? new Date(Number(watched.payload.expiration)).toISOString() : null, last_message_number: 0, updated_at: new Date().toISOString() });
  return saved.ok && Array.isArray(saved.payload) ? saved.payload[0] : null;
}

/**
 * The Google-specific transport feeds the provider-neutral reconciliation
 * contract. Other adapters need only implement cursor pagination plus the
 * owned event shape consumed by `ownedEventChange`.
 */
async function syncGoogleCalendar(value, row, calendarId, retriedWithoutCursor = false) {
  let cursor = await cursorFor(value, row.id, calendarId);
  for (;;) {
    const blocksResult = await service(value, `calendar_task_blocks?connection_id=eq.${encodeURIComponent(row.id)}&calendar_id=eq.${encodeURIComponent(calendarId)}&select=task_id,external_event_id,provider_revision,provider_updated_at&sync_state=in.(active,removed_external)`);
    if (!blocksResult.ok || !Array.isArray(blocksResult.payload)) throw new Error('provider_unavailable');
    const blocks = new Map(blocksResult.payload.map((block) => [block.external_event_id, block]));
    const token = cursor?.sync_token;
    let pageToken = null;
    let nextSyncToken = null;
    do {
      const parameters = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '250' });
      if (token) parameters.set('syncToken', token);
      if (pageToken) parameters.set('pageToken', pageToken);
      const result = await google(value, await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token)), `calendars/${encodeURIComponent(calendarId)}/events?${parameters}`);
      if (result.status === 410 && token && !retriedWithoutCursor) {
        await service(value, `calendar_sync_cursors?connection_id=eq.${encodeURIComponent(row.id)}&provider=eq.google_calendar&calendar_id=eq.${encodeURIComponent(calendarId)}`, { method: 'PATCH', body: JSON.stringify({ sync_token: null, updated_at: new Date().toISOString() }) });
        return syncGoogleCalendar(value, row, calendarId, true);
      }
      if (!result.ok || !Array.isArray(result.payload?.items)) throw new Error(result.status === 401 || result.status === 403 ? 'reauthorization_required' : 'provider_unavailable');
      for (const event of result.payload.items) {
        const block = blocks.get(event?.id);
        const change = ownedEventChange(event, block, row.id);
        if (!shouldApply(change, block)) continue;
        const applied = await service(value, 'rpc/reconcile_calendar_task_block', { method: 'POST', body: JSON.stringify({ p_connection_id: row.id, p_calendar_id: calendarId, p_external_event_id: event.id, p_provider_revision: change.revision, p_provider_updated_at: change.updatedAt, p_starts_at: change.startsAt, p_duration_minutes: change.durationMinutes, p_external_event_url: change.eventUrl, p_deleted: change.deleted }) });
        if (!applied.ok) throw new Error('recording_failed');
      }
      pageToken = result.payload.nextPageToken ?? null;
      nextSyncToken = result.payload.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
    if (!nextSyncToken) throw new Error('provider_unavailable');
    const saved = await saveCursor(value, { connection_id: row.id, provider: 'google_calendar', calendar_id: calendarId, sync_token: nextSyncToken, channel_id: cursor?.channel_id ?? null, channel_resource_id: cursor?.channel_resource_id ?? null, channel_token_hash: cursor?.channel_token_hash ?? null, channel_expires_at: cursor?.channel_expires_at ?? null, last_message_number: cursor?.last_message_number ?? 0, last_synced_at: new Date().toISOString(), last_error_code: null, updated_at: new Date().toISOString() });
    if (!saved.ok) throw new Error('recording_failed');
    return { reconciled: true };
  }
}

export async function connect(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  return respond(response, 200, { authorizationUrl: googleAuthorizationUrl(value, createState(value, identity.user.id)) });
}

export async function callback(request, response) {
  const value = config();
  if (!fullyConfigured(value)) return redirect(response, `${value.appUrl || ''}/settings?calendar=unavailable`);
  try {
    const url = new URL(request.url, value.appUrl); const state = readState(value, url.searchParams.get('state')); const code = url.searchParams.get('code');
    if (!state || !code || url.searchParams.get('error')) return redirect(response, `${value.appUrl}/settings?calendar=cancelled`);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: value.googleClientId, client_secret: value.googleClientSecret, redirect_uri: callbackUrl(value), grant_type: 'authorization_code' }) });
    const tokens = await tokenResponse.json().catch(() => null); if (!tokenResponse.ok || typeof tokens?.refresh_token !== 'string') return redirect(response, `${value.appUrl}/settings?calendar=failed`);
    const stored = await service(value, 'calendar_provider_connections?on_conflict=owner_id,provider', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ owner_id: state.userId, provider: 'google_calendar', encrypted_refresh_token: encrypt(value, tokens.refresh_token), scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [], default_calendar_id: 'primary', status: 'active', connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }]) });
    return redirect(response, `${value.appUrl}/settings?calendar=${stored.ok ? 'connected' : 'failed'}`);
  } catch (error) {
    console.error('[calendar] OAuth callback failed', { reason: error instanceof Error ? error.message : 'unknown_error' });
    return redirect(response, `${value.appUrl}/settings?calendar=failed`);
  }
}

export async function status(request, response) {
  if (only(request, response, 'GET') !== true) return; const value = config(); const redirectUri = value.appUrl ? callbackUrl(value) : null; const configurationIssue = calendarConfigurationIssue(value); if (!fullyConfigured(value)) return respond(response, 200, { status: 'unavailable', redirectUri, configurationIssue });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const connection = await service(value, `calendar_provider_connections?owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&select=id,default_calendar_id,status,encrypted_refresh_token&limit=1`); const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row || row.status !== 'active') return respond(response, 200, { status: row?.status ?? 'disconnected', redirectUri });
  try { const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token)); const calendars = await google(value, accessToken, 'users/me/calendarList?minAccessRole=writer'); if (!calendars.ok) throw new Error('provider_unavailable'); return respond(response, 200, { status: 'connected', redirectUri, connectionId: row.id, defaultCalendarId: row.default_calendar_id, calendars: (calendars.payload?.items ?? []).filter((calendar) => typeof calendar?.id === 'string').map((calendar) => ({ id: calendar.id, summary: calendar.summaryOverride || calendar.summary || 'Untitled calendar', primary: calendar.primary === true })) }); } catch (error) { const reason = error instanceof Error ? error.message : 'provider_unavailable'; if (reason === 'reauthorization_required') await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'reauthorization_required', updated_at: new Date().toISOString() }) }); return respond(response, 200, { status: reason === 'reauthorization_required' ? 'reauthorization_required' : 'unavailable', redirectUri }); }
}

export async function taskBlock(request, response) {
  if (only(request, response, 'GET') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 200, { block: null });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' }); const taskId = new URL(request.url, value.appUrl).searchParams.get('taskId');
  if (!taskId || !/^[0-9a-f-]{36}$/i.test(taskId)) return respond(response, 400, { code: 'invalid_request' }); const permission = await userRpc(value, identity.authorization, 'get_calendar_schedule_task', { p_task_id: taskId }); if (!permission.ok) return respond(response, 403, { code: 'task_unavailable' });
  const block = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&select=calendar_id,starts_at,duration_minutes,external_event_url,sync_state,last_reconciled_at&order=updated_at.desc&limit=1`); return respond(response, 200, { block: block.ok && Array.isArray(block.payload) ? block.payload[0] ?? null : null });
}

export async function schedule(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' }); const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const { taskId, connectionId, calendarId, startsAt, durationMinutes } = request.body ?? {}; if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || typeof connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(connectionId) || typeof calendarId !== 'string' || !calendarId.trim() || calendarId.length > 1000 || typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt)) || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) return respond(response, 400, { code: 'invalid_request' });
  const canonical = await userRpc(value, identity.authorization, 'get_calendar_schedule_task', { p_task_id: taskId }); if (!canonical.ok || !canonical.payload?.title) return respond(response, 403, { code: 'task_unavailable' }); const row = await connectionFor(value, identity.user.id, connectionId, 'id,encrypted_refresh_token'); if (!row) return respond(response, 409, { code: 'connection_unavailable' });
  const priorResult = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&connection_id=eq.${encodeURIComponent(connectionId)}&select=calendar_id&limit=1`); const prior = priorResult.ok && Array.isArray(priorResult.payload) ? priorResult.payload[0] : null; if (prior?.calendar_id && prior.calendar_id !== calendarId.trim()) return respond(response, 409, { code: 'calendar_change_requires_removal' });
  try { const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token)); const normalizedStart = new Date(startsAt).toISOString(); const eventId = stableEventId(taskId, connectionId); const payload = googleTaskEventPayload({ eventId, taskId, connectionId, title: canonical.payload.title, listTitle: canonical.payload.listTitle, startsAt: normalizedStart, durationMinutes }); const existing = await google(value, accessToken, `calendars/${encodeURIComponent(calendarId.trim())}/events/${encodeURIComponent(eventId)}`); const saved = existing.ok ? await google(value, accessToken, `calendars/${encodeURIComponent(calendarId.trim())}/events/${encodeURIComponent(eventId)}`, { method: 'PUT', body: JSON.stringify(payload) }) : existing.status === 404 ? await google(value, accessToken, `calendars/${encodeURIComponent(calendarId.trim())}/events`, { method: 'POST', body: JSON.stringify(payload) }) : existing; if (!saved.ok || typeof saved.payload?.id !== 'string') throw new Error(saved.status === 401 || saved.status === 403 ? 'reauthorization_required' : 'provider_unavailable'); const recorded = await userRpc(value, identity.authorization, 'record_calendar_task_block', { p_task_id: taskId, p_connection_id: connectionId, p_provider: 'google_calendar', p_calendar_id: calendarId.trim(), p_external_event_id: saved.payload.id, p_external_event_url: saved.payload.htmlLink ?? null, p_provider_revision: saved.payload.etag ?? saved.payload.updated ?? saved.payload.id, p_starts_at: normalizedStart, p_duration_minutes: durationMinutes }); if (!recorded.ok) return respond(response, 502, { code: 'recording_failed' }); await ensureGoogleWatch(value, row, calendarId.trim()).catch(() => undefined); await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }); return respond(response, 200, { block: recorded.payload, eventUrl: saved.payload.htmlLink ?? null }); } catch (error) { const reason = error instanceof Error ? error.message : 'provider_unavailable'; if (reason === 'reauthorization_required') await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'reauthorization_required', updated_at: new Date().toISOString() }) }); return respond(response, reason === 'reauthorization_required' ? 401 : 503, { code: reason === 'reauthorization_required' ? 'reauthorization_required' : 'provider_unavailable' }); }
}

export async function sync(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const { taskId, connectionId, calendarId } = request.body ?? {};
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || typeof connectionId !== 'string' || typeof calendarId !== 'string' || !calendarId.trim()) return respond(response, 400, { code: 'invalid_request' });
  const task = await userRpc(value, identity.authorization, 'get_calendar_schedule_task', { p_task_id: taskId });
  if (!task.ok) return respond(response, 403, { code: 'task_unavailable' });
  const row = await connectionFor(value, identity.user.id, connectionId, 'id,encrypted_refresh_token');
  if (!row) return respond(response, 403, { code: 'connection_unavailable' });
  try { await ensureGoogleWatch(value, row, calendarId.trim()).catch(() => undefined); await syncGoogleCalendar(value, row, calendarId.trim()); const block = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&connection_id=eq.${encodeURIComponent(connectionId)}&select=calendar_id,starts_at,duration_minutes,external_event_url,sync_state,last_reconciled_at&limit=1`); return respond(response, 200, { reconciled: true, block: block.ok && Array.isArray(block.payload) ? block.payload[0] ?? null : null }); }
  catch (error) { const code = error instanceof Error && error.message === 'reauthorization_required' ? 'reauthorization_required' : 'provider_unavailable'; return respond(response, code === 'reauthorization_required' ? 401 : 503, { code }); }
}

export async function googleNotification(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 204, {});
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, item]) => [key.toLowerCase(), Array.isArray(item) ? item[0] : item]));
  const channelId = headers['x-goog-channel-id'];
  if (typeof channelId !== 'string') return respond(response, 401, { code: 'invalid_notification' });
  const found = await service(value, `calendar_sync_cursors?channel_id=eq.${encodeURIComponent(channelId)}&select=*&limit=1`);
  const cursor = found.ok && Array.isArray(found.payload) ? found.payload[0] : null;
  const expectedToken = cursor ? webhookToken(value, cursor.connection_id, cursor.calendar_id) : '';
  if (!cursor || headers['x-goog-channel-token'] !== expectedToken || createHash('sha256').update(expectedToken).digest('hex') !== cursor.channel_token_hash || !isFreshNotification(cursor, headers)) return respond(response, 204, {});
  const connection = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(cursor.connection_id)}&provider=eq.google_calendar&status=eq.active&select=id,encrypted_refresh_token&limit=1`);
  const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row) return respond(response, 204, {});
  try { await syncGoogleCalendar(value, row, cursor.calendar_id); await service(value, `calendar_sync_cursors?id=eq.${encodeURIComponent(cursor.id)}`, { method: 'PATCH', body: JSON.stringify({ last_message_number: Number(headers['x-goog-message-number']), updated_at: new Date().toISOString() }) }); return respond(response, 204, {}); }
  catch (error) { await service(value, `calendar_sync_cursors?id=eq.${encodeURIComponent(cursor.id)}`, { method: 'PATCH', body: JSON.stringify({ last_error_code: error instanceof Error ? error.message : 'provider_unavailable', updated_at: new Date().toISOString() }) }); return respond(response, 503, { code: 'provider_unavailable' }); }
}

export async function remove(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' }); const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' }); const { taskId, connectionId } = request.body ?? {}; if (typeof taskId !== 'string' || typeof connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(connectionId)) return respond(response, 400, { code: 'invalid_request' }); const blockResult = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&connection_id=eq.${encodeURIComponent(connectionId)}&select=calendar_id,external_event_id,sync_state&limit=1`); const block = blockResult.ok && Array.isArray(blockResult.payload) ? blockResult.payload[0] : null; if (!block) return respond(response, 404, { code: 'not_scheduled' }); const row = await connectionFor(value, identity.user.id, connectionId, 'encrypted_refresh_token'); if (!row) return respond(response, 403, { code: 'connection_unavailable' }); try { if (block.sync_state !== 'removed_external') { const deleted = await google(value, await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token)), `calendars/${encodeURIComponent(block.calendar_id)}/events/${encodeURIComponent(block.external_event_id)}`, { method: 'DELETE' }); if (!deleted.ok && !isMissingGoogleEventStatus(deleted.status)) throw new Error(deleted.status === 401 || deleted.status === 403 ? 'reauthorization_required' : 'provider_unavailable'); } const removed = await userRpc(value, identity.authorization, 'remove_calendar_task_block', { p_task_id: taskId, p_connection_id: connectionId }); return removed.ok ? respond(response, 200, { removed: true }) : respond(response, 502, { code: 'recording_failed' }); } catch (error) { const reason = error instanceof Error ? error.message : 'provider_unavailable'; return respond(response, reason === 'reauthorization_required' ? 401 : 503, { code: reason }); }
}

export async function disconnect(request, response) {
  if (only(request, response, 'POST') !== true) return; const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' }); const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' }); const connection = await service(value, `calendar_provider_connections?owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&select=id,encrypted_refresh_token&limit=1`); const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null; if (!row) return respond(response, 200, { disconnected: true }); await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(value, row.encrypted_refresh_token) }) }).catch(() => undefined); const removed = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}&owner_id=eq.${encodeURIComponent(identity.user.id)}`, { method: 'DELETE' }); return removed.ok ? respond(response, 200, { disconnected: true }) : respond(response, 502, { code: 'disconnect_failed' });
}
