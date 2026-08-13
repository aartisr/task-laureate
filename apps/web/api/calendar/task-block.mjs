import { config, fullyConfigured, respond, service, userFromRequest, userRpc } from './shared.mjs';

export default async function handler(request, response) {
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return respond(response, 405, { code: 'method_not_allowed' }); }
  const value = config(); if (!fullyConfigured(value)) return respond(response, 200, { block: null });
  const identity = await userFromRequest(request, value); if (!identity) return respond(response, 401, { code: 'not_signed_in' });
  const taskId = new URL(request.url, value.appUrl).searchParams.get('taskId');
  if (!taskId || !/^[0-9a-f-]{36}$/i.test(taskId)) return respond(response, 400, { code: 'invalid_request' });
  const permission = await userRpc(value, identity.authorization, 'get_calendar_schedule_task', { p_task_id: taskId });
  if (!permission.ok) return respond(response, 403, { code: 'task_unavailable' });
  const block = await service(value, `calendar_task_blocks?task_id=eq.${encodeURIComponent(taskId)}&select=calendar_id,starts_at,duration_minutes,external_event_url&order=updated_at.desc&limit=1`);
  return respond(response, 200, { block: block.ok && Array.isArray(block.payload) ? block.payload[0] ?? null : null });
}
