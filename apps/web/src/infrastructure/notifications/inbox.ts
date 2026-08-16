import { authProvider } from '../../config/persistence.config';

export type NotificationEvent = {
  id: string;
  title: string;
  body: string;
  kind: 'due_soon' | 'weekly_digest' | 'task_assigned' | 'task_reminder' | 'status_update_request';
  created_at: string;
  read_at: string | null;
};

export type NotificationPreferences = {
  due_soon: boolean;
  weekly_digest: boolean;
  email_reminders: boolean;
  sms_reminders: boolean;
  phone_e164: string | null;
  sms_opted_in_at: string | null;
  time_zone: string;
};

async function request(path: string, init: RequestInit = {}) {
  const session = await authProvider.getSession();
  if (!session) return null;
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new Error(`Notification inbox request failed (${response.status}).`);
  return response;
}

export async function getNotificationEvents(limit = 12) {
  const response = await request(`notification_events?select=id,title,body,kind,created_at,read_at&order=created_at.desc&limit=${limit}`);
  return response ? await response.json() as NotificationEvent[] : [];
}

export async function getNotificationPreferences() {
  const response = await request('notification_preferences?select=due_soon,weekly_digest,email_reminders,sms_reminders,phone_e164,sms_opted_in_at,time_zone&limit=1');
  const preferences = response ? await response.json() as NotificationPreferences[] : [];
  return preferences[0] ?? null;
}

export async function markNotificationRead(id: string) {
  await request(`notification_events?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
}

export async function saveNotificationPreferences(preferences: NotificationPreferences) {
  const session = await authProvider.getSession();
  if (!session) throw new Error('Sign in to save notification preferences.');
  await request('notification_preferences?on_conflict=owner_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ owner_id: session.user.id, ...preferences, updated_at: new Date().toISOString() }]),
  });
}
