import { config, decrypt, fullyConfigured, respond, service, userFromRequest } from './shared.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const connection = await service(value, `calendar_provider_connections?owner_id=eq.${encodeURIComponent(identity.user.id)}&provider=eq.google_calendar&select=id,encrypted_refresh_token&limit=1`);
  const row = connection.ok && Array.isArray(connection.payload) ? connection.payload[0] : null;
  if (!row) return respond(response, 200, { disconnected: true });
  // Revocation is best effort: a locally removed credential must never remain
  // merely because Google is temporarily unreachable.
  await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(value, row.encrypted_refresh_token) }) }).catch(() => undefined);
  const removed = await service(value, `calendar_provider_connections?id=eq.${encodeURIComponent(row.id)}&owner_id=eq.${encodeURIComponent(identity.user.id)}`, { method: 'DELETE' });
  return removed.ok ? respond(response, 200, { disconnected: true }) : respond(response, 502, { code: 'disconnect_failed' });
}
