import { sendWebPush } from './webPush.mjs';
import { sendReminderEmail, sendReminderSms } from '../notifications/providers.mjs';

const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
export const maxDuration = 60;
const CLAIM_LIMIT = 80;
const DELIVERY_CONCURRENCY = 8;

async function rest(path, options = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { ...options, headers: { ...jsonHeaders, apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...options.headers } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return response;
}

async function authEmail(userId) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, ''); const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.email === 'string' ? user.email : null;
}

async function record(delivery, status, providerMessageId = null, reason = null) {
  await rest('rpc/record_task_reminder_delivery', { method: 'POST', body: JSON.stringify({ p_delivery_id: delivery.delivery_id, p_status: status, p_provider_message_id: providerMessageId, p_last_error: reason }) });
}

function reminderCopy(delivery) {
  const due = new Date(`${delivery.due_date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const title = `Reminder: ${delivery.task_title}`;
  const body = `“${delivery.task_title}” in ${delivery.list_title} is due ${due}.`;
  return { title, body, text: `${title}\n\n${body}\n\nOpen Task Laureate to review it.`, html: `<main style="font-family:Inter,Arial,sans-serif;color:#172033"><p style="color:#635bff;font-weight:700">TASK LAUREATE</p><h1>${delivery.task_title}</h1><p>${body}</p><p>Open Task Laureate to review it.</p></main>` };
}

async function sendBrowserPushes(events) {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  if (!events.length || !publicKey || !privateKey || !subject) return { sent: 0, skipped: events.length };
  const subscriptions = await (await rest('push_subscriptions?select=id,owner_id,endpoint,p256dh,auth')).json();
  const byOwner = new Map(events.map((event) => [event.owner_id, event]));
  const targets = subscriptions.filter((subscription) => byOwner.has(subscription.owner_id)).slice(0, 40);
  const results = await Promise.allSettled(targets.map((subscription) => {
    const event = byOwner.get(subscription.owner_id);
    return sendWebPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: event.title, body: event.body, eventId: event.id, url: '/settings' }), { subject, publicKey, privateKey });
  }));
  const expired = results.flatMap((result, index) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode) ? [targets[index].id] : []);
  await Promise.all(expired.map((id) => rest(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })));
  return { sent: results.filter((result) => result.status === 'fulfilled').length, skipped: events.length - targets.length, removedExpired: expired.length };
}

/** Bounded fan-out prevents a large due-date cohort from overwhelming either
 * Supabase Auth or an external delivery provider in one serverless run. */
async function mapConcurrent(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export default async function handler(request, response) {
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: 'Unauthorized' });
  try {
    const claimed = await (await rest('rpc/claim_due_task_reminders', { method: 'POST', body: JSON.stringify({ p_now: new Date().toISOString(), p_limit: CLAIM_LIMIT }) })).json();
    const inAppEvents = [];
    const results = { claimed: claimed.length, sent: 0, skipped: 0, failed: 0 };
    await mapConcurrent(claimed, DELIVERY_CONCURRENCY, async (delivery) => {
      try {
      const copy = reminderCopy(delivery);
      if (delivery.channel === 'in_app') {
        if (!delivery.in_app_enabled) { await record(delivery, 'skipped', null, 'Recipient disabled in-app reminders.'); results.skipped++; return; }
        const inserted = await rest('notification_events?on_conflict=owner_id,event_key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify([{ owner_id: delivery.recipient_id, event_key: delivery.event_key, kind: 'task_reminder', title: copy.title, body: copy.body }]) });
        inAppEvents.push(...await inserted.json()); await record(delivery, 'sent'); results.sent++; return;
      }
      if (delivery.channel === 'email') {
        if (!delivery.email_enabled) { await record(delivery, 'skipped', null, 'Recipient disabled email reminders.'); results.skipped++; return; }
        const email = await authEmail(delivery.recipient_id);
        const outcome = email ? await sendReminderEmail({ to: email, ...copy, idempotencyKey: delivery.event_key }) : { status: 'skipped', reason: 'Recipient has no email address.' };
        await record(delivery, outcome.status, outcome.providerMessageId ?? null, outcome.reason ?? null); results[outcome.status]++; return;
      }
      if (!delivery.sms_enabled || !delivery.sms_opted_in_at || !/^\+[1-9]\d{7,14}$/.test(delivery.phone_e164 ?? '')) {
        await record(delivery, 'skipped', null, 'Recipient has not opted in with a valid E.164 SMS number.'); results.skipped++; return;
      }
      const outcome = await sendReminderSms({ to: delivery.phone_e164, body: copy.text });
      await record(delivery, outcome.status, outcome.providerMessageId ?? null, outcome.reason ?? null); results[outcome.status]++;
      } catch (error) {
        console.error('[Task-Laureate reminders] Delivery attempt failed.', { deliveryId: delivery.delivery_id, message: error instanceof Error ? error.message : String(error) });
        try { await record(delivery, 'failed', null, error instanceof Error ? error.message : 'Unknown delivery error.'); } catch { /* The pending record is retried by a later run. */ }
        results.failed++;
      }
    });
    let push = { sent: 0, skipped: 0 };
    try { push = await sendBrowserPushes(inAppEvents); } catch (error) { console.error('[Task-Laureate reminders] Browser push failed.', { message: error instanceof Error ? error.message : String(error) }); }
    return response.status(200).json({ scannedAt: new Date().toISOString(), ...results, push });
  } catch (error) {
    console.error('[Task-Laureate reminders] Job failed.', { message: error instanceof Error ? error.message : String(error) });
    return response.status(500).json({ error: 'Reminder job failed.' });
  }
}
