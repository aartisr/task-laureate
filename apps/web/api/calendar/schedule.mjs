import { config, decrypt, fullyConfigured, google, refreshGoogleAccessToken, respond, service, userFromRequest, userRpc } from './shared.mjs';

const validInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { taskId, connectionId, calendarId, startsAt, durationMinutes } = body;
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId) || typeof connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(connectionId) || typeof calendarId !== 'string' || !calendarId.trim() || calendarId.length > 1000 || typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt)) || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) return null;
  return { taskId, connectionId, calendarId: calendarId.trim(), startsAt: new Date(startsAt).toISOString(), durationMinutes };
};

const stableEventId = (taskId, connectionId) => `tl${taskId.replaceAll('-', '').slice(0, 24)}${connectionId.replaceAll('-', '').slice(0, 24)}`.slice(0, 1024);

export default async function handler(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const input = validInput(request.body); if (!input) return respond(response, 400, { code: 'invalid_request' });
  const canonical = await userRpc(value, identity.authorization, 'get_calendar_schedule_task', { p_task_id: input.taskId });
  if (!canonical.ok || !canonical.payload?.title) return respond(response, 403, { code: 'task_unavailable' });
  const connection = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(input.connectionId)}&owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&status=eq.active&select=id,encrypted_refresh_token&limit=1`);
  const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row) return respond(response, 409, { code: 'connection_unavailable' });
  const priorBlock = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(input.taskId)}&connection_id=eq.${encodeURIComponent(input.connectionId)}&select=calendar_id&limit=1`);
  const prior = priorBlock.ok && Array.isArray(priorBlock.payload) ? priorBlock.payload[0] : null;
  // An event ID is idempotent only within one provider calendar. Requiring an
  // explicit removal before switching calendars prevents a quiet duplicate.
  if (prior?.calendar_id && prior.calendar_id !== input.calendarId) return respond(response, 409, { code: 'calendar_change_requires_removal' });
  try {
    const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token));
    const endAt = new Date(Date.parse(input.startsAt) + input.durationMinutes * 60_000).toISOString();
    const eventId = stableEventId(input.taskId, input.connectionId);
    const payload = { id: eventId, summary: canonical.payload.title, description: `Scheduled from Task-Laureate\n\nList: ${canonical.payload.listTitle ?? 'Task-Laureate'}`, start: { dateTime: input.startsAt }, end: { dateTime: endAt }, extendedProperties: { private: { taskLaureateTaskId: input.taskId, taskLaureateConnectionId: input.connectionId, schedulingMode: 'one-way' } } };
    const existing = await google(value, accessToken, `calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(eventId)}`);
    const saved = existing.ok
      ? await google(value, accessToken, `calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'PUT', body: JSON.stringify(payload) })
      : existing.status === 404
        ? await google(value, accessToken, `calendars/${encodeURIComponent(input.calendarId)}/events`, { method: 'POST', body: JSON.stringify(payload) })
        : existing;
    if (!saved.ok || typeof saved.payload?.id !== 'string') throw new Error(saved.status === 401 || saved.status === 403 ? 'reauthorization_required' : 'provider_unavailable');
    const recorded = await userRpc(value, identity.authorization, 'record_calendar_task_block', { p_task_id: input.taskId, p_connection_id: input.connectionId, p_provider: 'google_calendar', p_calendar_id: input.calendarId, p_external_event_id: saved.payload.id, p_external_event_url: saved.payload.htmlLink ?? null, p_provider_revision: saved.payload.etag ?? saved.payload.updated ?? saved.payload.id, p_starts_at: input.startsAt, p_duration_minutes: input.durationMinutes });
    if (!recorded.ok) return respond(response, 502, { code: 'recording_failed' });
    await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
    return respond(response, 200, { block: recorded.payload, eventUrl: saved.payload.htmlLink ?? null });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'provider_unavailable';
    if (reason === 'reauthorization_required') await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'reauthorization_required', updated_at: new Date().toISOString() }) });
    return respond(response, reason === 'reauthorization_required' ? 401 : 503, { code: reason === 'reauthorization_required' ? 'reauthorization_required' : 'provider_unavailable' });
  }
}
