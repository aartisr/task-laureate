import { authProvider } from '../../config/persistence.config';

export type CalendarConnectionStatus = 'unavailable' | 'disconnected' | 'connected' | 'reauthorization_required';
export type CalendarOption = { id: string; summary: string; primary: boolean };
export type CalendarStatus = { status: CalendarConnectionStatus; connectionId?: string; defaultCalendarId?: string; calendars?: CalendarOption[] };
export type CalendarBlock = { id: string; calendar_id: string; starts_at: string; duration_minutes: number; external_event_url?: string | null };

async function request(path: string, init: RequestInit = {}) {
  const session = await authProvider.getSession();
  if (!session?.accessToken) throw new Error('Sign in to schedule a calendar block.');
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...(init.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { code?: string; [key: string]: unknown } | null;
  if (!response.ok) throw new Error(payload?.code ?? 'provider_unavailable');
  return payload;
}

export async function getCalendarStatus(): Promise<CalendarStatus> { return request('/api/calendar/status') as Promise<CalendarStatus>; }
export async function beginGoogleCalendarConnection() {
  const payload = await request('/api/calendar/google/connect', { method: 'POST' });
  if (typeof payload?.authorizationUrl !== 'string') throw new Error('provider_unavailable');
  window.location.assign(payload.authorizationUrl);
}
export async function scheduleCalendarBlock(input: { taskId: string; connectionId: string; calendarId: string; startsAt: string; durationMinutes: number }) {
  return request('/api/calendar/schedule', { method: 'POST', body: JSON.stringify(input) }) as Promise<{ block: CalendarBlock; eventUrl?: string | null }>;
}
export async function removeCalendarBlock(taskId: string, connectionId: string) { await request('/api/calendar/remove', { method: 'POST', body: JSON.stringify({ taskId, connectionId }) }); }
export async function disconnectGoogleCalendar() { await request('/api/calendar/disconnect', { method: 'POST' }); }
export async function getCalendarTaskBlock(taskId: string) {
  const session = await authProvider.getSession();
  if (!session?.accessToken) throw new Error('Sign in to view calendar scheduling.');
  const response = await fetch(`/api/calendar/task-block?taskId=${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  const payload = await response.json().catch(() => null) as { block?: CalendarBlock | null } | null;
  if (!response.ok) throw new Error('provider_unavailable');
  return payload?.block ?? null;
}
