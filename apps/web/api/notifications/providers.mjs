const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

function missing(...names) { return names.filter((name) => !process.env[name]); }

/**
 * Provider adapters deliberately return a normalized result. Adding another
 * vendor is isolated here; the scheduler and its delivery audit do not change.
 */
export async function sendReminderEmail({ to, subject, text, html, idempotencyKey, category = 'task_reminder' }) {
  const absent = missing('RESEND_API_KEY', 'RESEND_FROM_EMAIL');
  if (absent.length) return { status: 'skipped', reason: `Email is not configured (${absent.join(', ')}).` };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { ...json, Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}), to: [to], subject, text, html, tags: [{ name: 'category', value: category }] }),
  });
  if (!response.ok) return { status: 'failed', reason: `Resend returned HTTP ${response.status}.` };
  const body = await response.json().catch(() => ({}));
  return { status: 'sent', providerMessageId: typeof body?.id === 'string' ? body.id : null };
}

/** Twilio is optional and is activated only with an explicit provider setting. */
export async function sendReminderSms({ to, body }) {
  if (process.env.SMS_PROVIDER !== 'twilio') return { status: 'skipped', reason: 'No SMS provider is configured.' };
  const absent = missing('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER');
  if (absent.length) return { status: 'skipped', reason: `SMS is not configured (${absent.join(', ')}).` };
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const credentials = Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body }).toString(),
  });
  if (!response.ok) return { status: 'failed', reason: `SMS provider returned HTTP ${response.status}.` };
  const result = await response.json().catch(() => ({}));
  return { status: 'sent', providerMessageId: typeof result?.sid === 'string' ? result.sid : null };
}
