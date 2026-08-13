import { config, decrypt, fullyConfigured, google, refreshGoogleAccessToken, respond, service, userFromRequest } from './shared.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 200, { status: 'unavailable' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const connection = await service(value, `calendar_provider_connections?owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&select=id,default_calendar_id,status,encrypted_refresh_token&limit=1`);
  const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row || row.status !== 'active') return respond(response, 200, { status: row?.status ?? 'disconnected' });
  try {
    const accessToken = await refreshGoogleAccessToken(value, decrypt(value, row.encrypted_refresh_token));
    const calendars = await google(value, accessToken, 'users/me/calendarList?minAccessRole=writer');
    if (!calendars.ok) throw new Error('provider_unavailable');
    return respond(response, 200, { status: 'connected', connectionId: row.id, defaultCalendarId: row.default_calendar_id, calendars: (calendars.payload?.items ?? []).filter((calendar) => typeof calendar?.id === 'string').map((calendar) => ({ id: calendar.id, summary: calendar.summaryOverride || calendar.summary || 'Untitled calendar', primary: calendar.primary === true })) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'provider_unavailable';
    if (reason === 'reauthorization_required') await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'reauthorization_required', updated_at: new Date().toISOString() }) });
    return respond(response, 200, { status: reason === 'reauthorization_required' ? 'reauthorization_required' : 'unavailable' });
  }
}
