import { config, createState, fullyConfigured, googleAuthorizationUrl, respond, userFromRequest } from '../shared.mjs';

export default async function handler(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 503, { code: 'disabled' });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  return respond(response, 200, { authorizationUrl: googleAuthorizationUrl(value, createState(value, identity.user.id)) });
}
