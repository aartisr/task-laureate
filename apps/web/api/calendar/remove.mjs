import { config, decrypt, fullyConfigured, google, refreshGoogleAccessToken, respond, service, userFromRequest, userRpc } from './shared.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const { taskId, connectionId } = request.body ?? {};
  if (typeof taskId !== 'string' || typeof connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || !/^[0-9a-f-]{36}$/i.test(connectionId)) return respond(response, 400, { code: 'invalid_request' });
  const blockResult = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&connection_id=eq.${encodeURIComponent(connectionId)}&select=calendar_id,external_event_id&limit=1`);
  const block = blockResult.ok && Array.isArray(blockResult.payload) ? blockResult.payload[0] : null;
  if (!block) return respond(response, 404, { code: 'not_scheduled' });
  const connection = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(connectionId)}&owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&select=encrypted_refresh_token&limit=1`);
  const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row) return respond(response, 403, { code: 'connection_unavailable' });
  try {
    const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token));
    const deleted = await google(value, accessToken, `calendars/${encodeURIComponent(block.calendar_id)}/events/${encodeURIComponent(block.external_event_id)}`, { method: 'DELETE' });
    if (!deleted.ok && deleted.status !== 404) throw new Error(deleted.status === 401 || deleted.status === 403 ? 'reauthorization_required' : 'provider_unavailable');
    const removed = await userRpc(value, identity.authorization, 'remove_calendar_task_block', { p_task_id: taskId, p_connection_id: connectionId });
    return removed.ok ? respond(response, 200, { removed: true }) : respond(response, 502, { code: 'recording_failed' });
  } catch (error) { const reason = error instanceof Error ? error.message : 'provider_unavailable'; return respond(response, reason === 'reauthorization_required' ? 401 : 503, { code: reason }); }
}
