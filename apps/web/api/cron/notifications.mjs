const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };

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

    if (events.length > 0) await rest('notification_events?on_conflict=owner_id,event_key', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(events),
    });
    return response.status(200).json({ scannedAt: new Date().toISOString(), createdOrRetained: events.length });
  } catch (error) {
    console.error('[Task-Laureate notifications] Daily notification job failed.', { message: error instanceof Error ? error.message : String(error) });
    return response.status(500).json({ error: 'Notification job failed.' });
  }
}
