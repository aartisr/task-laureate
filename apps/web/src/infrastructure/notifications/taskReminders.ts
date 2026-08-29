import { authProvider } from '../../config/persistence.config';

type Candidate = { user_id: string; email: string; access_role: 'owner' | 'editor' | 'viewer' };
type Assignment = { user_id: string };
export type TaskReminderChannel = 'in_app' | 'email';
export type TaskReminderConfiguration = { enabled: boolean; offset_minutes: number; channels: TaskReminderChannel[] };
export const defaultTaskReminderChannels: TaskReminderChannel[] = ['in_app', 'email'];

async function request(path: string, operation: string, init: RequestInit = {}) {
  const session = await authProvider.getSession();
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!session || !url || !key) throw new Error('Sign in to manage task reminders.');
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(`${operation} failed${payload.message ? `: ${payload.message}` : ` (HTTP ${response.status})`}.`);
  }
  return response;
}

/** A narrow client adapter over owner-only RPCs. It contains no provider logic. */
export async function getTaskReminderSetup(taskId: string) {
  const [candidatesResponse, assignmentsResponse, rulesResponse] = await Promise.all([
    request('rpc/list_task_assignment_candidates', 'Loading eligible collaborators', { method: 'POST', body: JSON.stringify({ p_task_id: taskId }) }),
    request(`task_assignments?task_id=eq.${encodeURIComponent(taskId)}&select=user_id`, 'Loading task assignments'),
    request(`task_reminder_rules?task_id=eq.${encodeURIComponent(taskId)}&select=enabled,offset_minutes,channels&limit=1`, 'Loading reminder settings'),
  ]);
  const [candidates, assignments, rules] = await Promise.all([candidatesResponse.json() as Promise<Candidate[]>, assignmentsResponse.json() as Promise<Assignment[]>, rulesResponse.json() as Promise<TaskReminderConfiguration[]>]);
  return { candidates, assigned: new Set(assignments.map((item) => item.user_id)), rule: rules[0] ?? { enabled: false, offset_minutes: 1440, channels: defaultTaskReminderChannels } };
}
export async function setTaskAssignee(taskId: string, userId: string, assigned: boolean) { await request('rpc/set_task_assignment', 'Updating the assignee', { method: 'POST', body: JSON.stringify({ p_task_id: taskId, p_user_id: userId, p_assigned: assigned }) }); }
export async function saveTaskReminder(taskId: string, configuration: TaskReminderConfiguration) { await request('rpc/configure_task_reminder', 'Saving reminder settings', { method: 'POST', body: JSON.stringify({ p_task_id: taskId, p_enabled: configuration.enabled, p_offset_minutes: configuration.offset_minutes, p_channels: configuration.channels }) }); }

export async function requestTaskStatusUpdate(taskId: string) {
  const session = await authProvider.getSession();
  if (!session) throw new Error('Sign in to request a status update.');
  const response = await fetch('/api/status-update-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'We could not request a status update.');
  return payload as { requested: number; emailSent: number; emailSkipped: number; alreadyRequested: boolean };
}
