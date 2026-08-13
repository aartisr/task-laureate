import { authProvider } from '../../config/persistence.config';

export type CalendarConnectionStatus = 'unavailable' | 'disconnected' | 'connected' | 'reauthorization_required';
export type CalendarConfigurationIssue = 'disabled' | 'missing_configuration' | 'invalid_token_encryption_key';
export type CalendarOption = { id: string; summary: string; primary: boolean };
export type CalendarStatus = { status: CalendarConnectionStatus; redirectUri?: string | null; configurationIssue?: CalendarConfigurationIssue; connectionId?: string; defaultCalendarId?: string; calendars?: CalendarOption[] };
export type CalendarBlock = { id: string; calendar_id: string; starts_at: string; duration_minutes: number; external_event_url?: string | null; sync_state?: 'active' | 'removed_external' | 'error' | 'reauthorization_required'; last_reconciled_at?: string | null };
const sessionTimeoutMs = 5_000;
const requestTimeoutMs = 8_000;
const calendarStatuses = new Set<CalendarConnectionStatus>(['unavailable', 'disconnected', 'connected', 'reauthorization_required']);

/** The API boundary is untrusted: UI code receives a safe, complete status only. */
export function normalizeCalendarStatus(value: unknown): CalendarStatus {
  if (!value || typeof value !== 'object') return { status: 'unavailable' };
  const payload = value as Record<string, unknown>;
  if (typeof payload.status !== 'string' || !calendarStatuses.has(payload.status as CalendarConnectionStatus)) return { status: 'unavailable' };
  const calendars = Array.isArray(payload.calendars)
    ? payload.calendars.filter((calendar): calendar is CalendarOption => Boolean(calendar) && typeof calendar === 'object' && typeof (calendar as CalendarOption).id === 'string' && typeof (calendar as CalendarOption).summary === 'string' && typeof (calendar as CalendarOption).primary === 'boolean')
    : undefined;
  return {
    status: payload.status as CalendarConnectionStatus,
    ...(typeof payload.redirectUri === 'string' || payload.redirectUri === null ? { redirectUri: payload.redirectUri } : {}),
    ...(payload.configurationIssue === 'disabled' || payload.configurationIssue === 'missing_configuration' || payload.configurationIssue === 'invalid_token_encryption_key' ? { configurationIssue: payload.configurationIssue } : {}),
    ...(typeof payload.connectionId === 'string' ? { connectionId: payload.connectionId } : {}),
    ...(typeof payload.defaultCalendarId === 'string' ? { defaultCalendarId: payload.defaultCalendarId } : {}),
    ...(calendars ? { calendars } : {}),
  };
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, errorCode = 'provider_unavailable'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }) as Promise<T>;
}

async function authenticatedRequest(path: string, init: RequestInit = {}) {
  const session = await withTimeout(authProvider.getSession(), sessionTimeoutMs);
  if (!session?.accessToken) throw new Error('Sign in to schedule a calendar block.');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(path, { ...init, signal: init.signal ?? controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}`, ...(init.headers ?? {}) } }).finally(() => clearTimeout(timeoutId));
  const payload = await response.json().catch(() => null) as { code?: string; [key: string]: unknown } | null;
  if (!response.ok) throw new Error(payload?.code ?? 'provider_unavailable');
  return payload;
}

export async function getCalendarStatus(): Promise<CalendarStatus> { return normalizeCalendarStatus(await authenticatedRequest('/api/calendar/status')); }
export async function beginGoogleCalendarConnection() {
  const payload = await authenticatedRequest('/api/calendar/google/connect', { method: 'POST' });
  if (typeof payload?.authorizationUrl !== 'string') throw new Error('provider_unavailable');
  window.location.assign(payload.authorizationUrl);
}
export async function scheduleCalendarBlock(input: { taskId: string; connectionId: string; calendarId: string; startsAt: string; durationMinutes: number }) {
  return authenticatedRequest('/api/calendar/schedule', { method: 'POST', body: JSON.stringify(input) }) as Promise<{ block: CalendarBlock; eventUrl?: string | null }>;
}
export async function removeCalendarBlock(taskId: string, connectionId: string) { await authenticatedRequest('/api/calendar/remove', { method: 'POST', body: JSON.stringify({ taskId, connectionId }) }); }
export async function reconcileCalendar(taskId: string, connectionId: string, calendarId: string) {
  return authenticatedRequest('/api/calendar/sync', { method: 'POST', body: JSON.stringify({ taskId, connectionId, calendarId }) }) as Promise<{ reconciled: true; block: CalendarBlock | null }>;
}
export async function disconnectGoogleCalendar() { await authenticatedRequest('/api/calendar/disconnect', { method: 'POST' }); }
export async function getCalendarTaskBlock(taskId: string) {
  const payload = await authenticatedRequest(`/api/calendar/task-block?taskId=${encodeURIComponent(taskId)}`) as { block?: CalendarBlock | null } | null;
  return payload?.block ?? null;
}
