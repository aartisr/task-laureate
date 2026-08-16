import { authProvider } from '../../config/persistence.config';

type Candidate = { user_id: string; email: string; access_role: 'owner' | 'editor' | 'viewer' };
type Assignment = { user_id: string };
export type TaskReminderConfiguration = { enabled: boolean; offset_minutes: number; channels: Array<'in_app' | 'email' | 'sms'> };

async function request(path: string, init: RequestInit = {}) {
  const session = await authProvider.getSession();
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!session || !url || !key) throw new Error('Sign in to manage task reminders.');
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) throw new Error('We could not update task reminders.');
  return response;
}

/** A narrow client adapter over owner-only RPCs. It contains no provider logic. */
export async function getTaskReminderSetup(taskId: string) {
  const [candidatesResponse, assignmentsResponse, rulesResponse] = await Promise.all([
    request('rpc/list_task_assignment_candidates', { method: 'POST', body: JSON.stringify({ p_task_id: taskId }) }),
    request(`task_assignments?task_id=eq.${encodeURIComponent(taskId)}&select=user_id`),
    request(`task_reminder_rules?task_id=eq.${encodeURIComponent(taskId)}&select=enabled,offset_minutes,channels&limit=1`),
  ]);
  const [candidates, assignments, rules] = await Promise.all([candidatesResponse.json() as Promise<Candidate[]>, assignmentsResponse.json() as Promise<Assignment[]>, rulesResponse.json() as Promise<TaskReminderConfiguration[]>]);
  return { candidates, assigned: new Set(assignments.map((item) => item.user_id)), rule: rules[0] ?? { enabled: false, offset_minutes: 1440, channels: ['in_app'] } };
}
export async function setTaskAssignee(taskId: string, userId: string, assigned: boolean) { await request('rpc/set_task_assignment', { method: 'POST', body: JSON.stringify({ p_task_id: taskId, p_user_id: userId, p_assigned: assigned }) }); }
export async function saveTaskReminder(taskId: string, configuration: TaskReminderConfiguration) { await request('rpc/configure_task_reminder', { method: 'POST', body: JSON.stringify({ p_task_id: taskId, p_enabled: configuration.enabled, p_offset_minutes: configuration.offset_minutes, p_channels: configuration.channels }) }); }
