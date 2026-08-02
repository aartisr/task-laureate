import { sendWebPush } from './webPush.mjs';

const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
export const maxDuration = 60;

function utcDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function rest(path, options = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...jsonHeaders, apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...options.headers },
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return response;
}

function toTasks(payload) {
  return Array.isArray(payload?.tasks) ? payload.tasks : [];
}

async function deleteSubscription(id) {
  await rest(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

async function sendBrowserPushes(events) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!events.length || !publicKey || !privateKey || !subject) return { sent: 0, skipped: events.length };
  const subscriptionsResponse = await rest('push_subscriptions?select=id,owner_id,endpoint,p256dh,auth');
  const subscriptions = await subscriptionsResponse.json();
  const eventByOwner = new Map(events.map((event) => [event.owner_id, event]));
  // Hobby functions have limited execution time. The durable inbox contains every
  // event; this cap keeps best-effort push delivery from delaying the cron.
  const deliveries = subscriptions.filter((subscription) => eventByOwner.has(subscription.owner_id)).slice(0, 40);
  const results = await Promise.allSettled(deliveries.map((subscription) => {
    const event = eventByOwner.get(subscription.owner_id);
    return sendWebPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: event.title, body: event.body, eventId: event.id, url: '/settings' }), { subject, publicKey, privateKey });
  }));
  const expired = results.flatMap((result, index) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode) ? [deliveries[index].id] : []);
  await Promise.all(expired.map((id) => deleteSubscription(id)));
  return { sent: results.filter((result) => result.status === 'fulfilled').length, skipped: events.length - deliveries.length, removedExpired: expired.length };
}

export default async function handler(request, response) {
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: 'Unauthorized' });
  try {
    const [preferencesResponse, snapshotsResponse] = await Promise.all([
      rest('notification_preferences?select=owner_id,due_soon,weekly_digest'),
      rest('workspace_snapshots?select=owner_id,payload'),
    ]);
    const preferences = await preferencesResponse.json();
    const snapshots = await snapshotsResponse.json();
    const workspaceByOwner = new Map(snapshots.map((snapshot) => [snapshot.owner_id, snapshot.payload]));
    const preferenceByOwner = new Map(preferences.map((preference) => [preference.owner_id, preference]));
    const today = utcDate();
    const tomorrow = utcDate(1);
    const isSunday = new Date(`${today}T00:00:00.000Z`).getUTCDay() === 0;
    const events = [];

    for (const [ownerId, workspace] of workspaceByOwner) {
      const preference = preferenceByOwner.get(ownerId) ?? { owner_id: ownerId, due_soon: true, weekly_digest: false };
      const tasks = toTasks(workspace);
      const activeTasks = tasks.filter((task) => task && !['done', 'deleted'].includes(task.status));
      if (preference.due_soon) {
        for (const task of activeTasks) {
          const dueDate = typeof task.dueDate === 'string' ? task.dueDate.slice(0, 10) : null;
          if (!dueDate || dueDate < today || dueDate > tomorrow) continue;
          events.push({ owner_id: preference.owner_id, event_key: `due:${task.id}:${dueDate}`, kind: 'due_soon', title: `Due ${dueDate === today ? 'today' : 'tomorrow'}: ${String(task.title).slice(0, 220)}`, body: 'Open Task-Laureate to review and complete this task.' });
        }
      }
      if (preference.weekly_digest && isSunday) {
        const dueThisWeek = activeTasks.filter((task) => typeof task.dueDate === 'string' && task.dueDate.slice(0, 10) >= today).length;
        events.push({ owner_id: preference.owner_id, event_key: `digest:${today}`, kind: 'weekly_digest', title: 'Your weekly Task-Laureate digest', body: `${activeTasks.length} active task${activeTasks.length === 1 ? '' : 's'} · ${dueThisWeek} with an upcoming due date.` });
      }
    }

    let created = [];
    if (events.length > 0) {
      const inserted = await rest('notification_events?on_conflict=owner_id,event_key', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(events),
      });
      created = await inserted.json();
    }
    let push;
    try { push = await sendBrowserPushes(created); }
    catch (pushError) {
      console.error('[Task-Laureate notifications] Browser push delivery failed; in-app inbox remains available.', { message: pushError instanceof Error ? pushError.message : String(pushError) });
      push = { sent: 0, skipped: created.length, error: 'Browser push delivery failed.' };
    }
    return response.status(200).json({ scannedAt: new Date().toISOString(), createdOrRetained: events.length, created: created.length, push });
  } catch (error) {
    console.error('[Task-Laureate notifications] Daily notification job failed.', { message: error instanceof Error ? error.message : String(error) });
    return response.status(500).json({ error: 'Notification job failed.' });
  }
}
