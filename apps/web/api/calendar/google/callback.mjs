import { callbackUrl, config, encrypt, fullyConfigured, readState, respond, service } from '../shared.mjs';

const redirect = (response, location) => { response.setHeader('Cache-Control', 'no-store'); response.writeHead(302, { Location: location }); response.end(); };

export default async function handler(request, response) {
  const value = config();
  if (!fullyConfigured(value)) return redirect(response, `${value.appUrl || ''}/settings?calendar=unavailable`);
  const url = new URL(request.url, value.appUrl); const state = readState(value, url.searchParams.get('state'));
  const code = url.searchParams.get('code');
  if (!state || !code || url.searchParams.get('error')) return redirect(response, `${value.appUrl}/settings?calendar=cancelled`);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: value.googleClientId, client_secret: value.googleClientSecret, redirect_uri: callbackUrl(value), grant_type: 'authorization_code' }) });
  const tokens = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || typeof tokens?.refresh_token !== 'string') return redirect(response, `${value.appUrl}/settings?calendar=failed`);
  const stored = await service(value, 'calendar_provider_connections?on_conflict=owner_id,provider', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ owner_id: state.userId, provider: 'google_calendar', encrypted_refresh_token: encrypt(value, tokens.refresh_token), scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [], default_calendar_id: 'primary', status: 'active', connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }]) });
  return redirect(response, `${value.appUrl}/settings?calendar=${stored.ok ? 'connected' : 'failed'}`);
}
