import { sendReminderEmail } from './notifications/providers.mjs';

export const maxDuration = 20;
const json = { 'Content-Type': 'application/json', Accept: 'application/json' };
const taskIdPattern = /^[0-9a-f-]{36}$/i;
const escape = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function fail(response, status, message) { return response.status(status).json({ message }); }

async function responseMessage(result, fallback) {
  try {
    const payload = await result.json();
    return typeof payload?.message === 'string' && payload.message.trim() ? payload.message.trim() : fallback;
  } catch { return fallback; }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(await responseMessage(response, `Request failed (${response.status}).`));
  return response.json();
}

async function recipientAllowsEmail({ supabaseUrl, serviceKey, recipientId }) {
  const rows = await fetchJson(`${supabaseUrl}/rest/v1/notification_preferences?owner_id=eq.${encodeURIComponent(recipientId)}&select=email_reminders&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  return rows[0]?.email_reminders !== false;
}

async function recipientEmail({ supabaseUrl, serviceKey, recipientId }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(recipientId)}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.email === 'string' ? user.email : null;
}

/**
 * One-time, owner-authorized request flow. The database creates the in-app
 * event atomically; optional email fan-out happens afterwards, so a mail
 * provider outage can never lose the request or leak recipient identities.
 */
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).setHeader('Allow', 'POST').json({ message: 'Method not allowed.' });
  const authorization = request.headers.authorization;
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!authorization?.startsWith('Bearer ')) return fail(response, 401, 'Sign in before requesting a status update.');
  if (!supabaseUrl || !publishableKey) return fail(response, 503, 'Status updates are not configured for this deployment.');
  const taskId = typeof request.body?.taskId === 'string' ? request.body.taskId.trim() : '';
  if (!taskIdPattern.test(taskId)) return fail(response, 400, 'Choose a valid task before requesting an update.');

  try {
    const identity = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: authorization } });
    if (!identity.ok) return fail(response, 401, 'Your session has expired. Sign in and try again.');
    const rows = await fetchJson(`${supabaseUrl}/rest/v1/rpc/request_task_status_update`, {
      method: 'POST', headers: { ...json, apikey: publishableKey, Authorization: authorization }, body: JSON.stringify({ p_task_id: taskId }),
    });
    if (!Array.isArray(rows) || rows.length === 0) return response.status(200).json({ requested: 0, emailSent: 0, emailSkipped: 0, alreadyRequested: true });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
    const canDeliverEmail = Boolean(serviceKey && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
    let emailSent = 0; let emailSkipped = 0;
    if (canDeliverEmail) {
      await Promise.all(rows.map(async (row) => {
        try {
          if (!await recipientAllowsEmail({ supabaseUrl, serviceKey, recipientId: row.recipient_id })) { emailSkipped++; return; }
          const email = await recipientEmail({ supabaseUrl, serviceKey, recipientId: row.recipient_id });
          if (!email) { emailSkipped++; return; }
          const taskUrl = appUrl ? `${appUrl}/lists/${encodeURIComponent(row.list_id)}/tasks/${encodeURIComponent(taskId)}` : null;
          const title = `Status update requested: ${row.task_title}`;
          const body = `Please update “${row.task_title}” in ${row.list_title} when you have a moment.`;
          const outcome = await sendReminderEmail({ to: email, subject: title, text: `${title}\n\n${body}${taskUrl ? `\n\nOpen task: ${taskUrl}` : ''}`, html: `<main style="font-family:Inter,Arial,sans-serif;color:#172033"><p style="color:#635bff;font-weight:700">TASK LAUREATE</p><h1>${escape(title)}</h1><p>${escape(body)}</p>${taskUrl ? `<p><a href="${escape(taskUrl)}" style="display:inline-block;background:#635bff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Open task</a></p>` : ''}</main>`, idempotencyKey: `status-update-request/${taskId}/${row.recipient_id}/${new Date().toISOString().slice(0, 10)}`, category: 'status_update_request' });
          if (outcome.status === 'sent') emailSent++; else emailSkipped++;
        } catch (error) { emailSkipped++; console.error('[Task-Laureate status updates] Email delivery failed.', { recipientId: row.recipient_id, message: error instanceof Error ? error.message : String(error) }); }
      }));
    } else {
      emailSkipped = rows.length;
    }
    return response.status(201).json({ requested: rows.length, emailSent, emailSkipped, alreadyRequested: false });
  } catch (error) {
    console.error('[Task-Laureate status updates] Request failed.', { message: error instanceof Error ? error.message : String(error) });
    return fail(response, 400, error instanceof Error ? error.message : 'We could not request a status update.');
  }
}
