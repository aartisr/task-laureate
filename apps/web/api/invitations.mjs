import { createHash, randomBytes } from 'node:crypto';

export const maxDuration = 15;
const json = { 'Content-Type': 'application/json' };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const token = () => randomBytes(32).toString('hex');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const escape = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function fail(response, status, message) { return response.status(status).json({ message }); }

/**
 * Server-only invite delivery. The caller's JWT authorizes the database RPC;
 * Resend and Supabase server keys never reach the browser. A delivery failure
 * revokes the just-created invite so there is no inaccessible pending access.
 */
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).setHeader('Allow', 'POST').json({ message: 'Method not allowed.' });
  const auth = request.headers.authorization;
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;
  const appUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!auth?.startsWith('Bearer ') || !supabaseUrl || !publishableKey || !resendKey || !from || !appUrl) return fail(response, 503, 'Invitation email delivery is not configured yet.');
  const jwt = auth.slice(7);
  try {
    const identity = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: auth } });
    if (!identity.ok) return fail(response, 401, 'Your session has expired. Sign in and try again.');
    const { resourceType, resourceId, email, role } = request.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!['list', 'task'].includes(resourceType) || !/^[0-9a-f-]{36}$/i.test(resourceId ?? '') || !emailPattern.test(normalizedEmail) || !['editor', 'viewer'].includes(role)) return fail(response, 400, 'The invitation details are invalid.');
    const rawToken = token(); const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_share_invitation`, { method: 'POST', headers: { ...json, apikey: publishableKey, Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ p_resource_type: resourceType, p_resource_id: resourceId, p_email_normalized: normalizedEmail, p_role: role, p_token_digest: digest(rawToken), p_expires_at: expiresAt }) });
    if (!inviteResponse.ok) return fail(response, inviteResponse.status, 'You do not have permission to invite people to this resource.');
    const invitationId = await inviteResponse.json();
    const inviteUrl = `${appUrl}/share/accept?token=${encodeURIComponent(rawToken)}`;
    const emailResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { ...json, Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': `share-invitation/${invitationId}` }, body: JSON.stringify({ from, ...(replyTo ? { reply_to: replyTo } : {}), to: [normalizedEmail], subject: `You were invited to a Task Laureate ${resourceType}`, tags: [{ name: 'category', value: 'share_invitation' }, { name: 'resource_type', value: resourceType }, { name: 'invitation_id', value: String(invitationId) }], html: `<main style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><p style="color:#635bff;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">Task Laureate</p><h1 style="font-size:24px">You’ve been invited to collaborate</h1><p>You have <strong>${escape(role === 'editor' ? 'Can update' : 'Read-only')}</strong> access to a shared ${escape(resourceType)}.</p><p><a href="${inviteUrl}" style="display:inline-block;background:#635bff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Open shared ${escape(resourceType)}</a></p><p style="color:#64748b;font-size:13px">For your security, sign in with ${escape(normalizedEmail)}. This invitation expires in seven days.</p></main>`, text: `You were invited to a Task Laureate ${resourceType} with ${role === 'editor' ? 'Can update' : 'Read-only'} access. Open: ${inviteUrl}` }) });
    if (!emailResponse.ok) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/revoke_share_invitation`, { method: 'POST', headers: { ...json, apikey: publishableKey, Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ p_invitation_id: invitationId }) });
      return fail(response, 502, 'The invitation email could not be sent. No access was granted; please try again.');
    }
    return response.status(201).json({ invitation: { id: invitationId, resource_type: resourceType, resource_id: resourceId, email_normalized: normalizedEmail, role, status: 'pending', invited_by: '', expires_at: expiresAt, created_at: new Date().toISOString(), accepted_by: null }, delivery: 'sent' });
  } catch (error) {
    console.error('[Task-Laureate invitations] Delivery failed.', { message: error instanceof Error ? error.message : String(error) });
    return fail(response, 500, 'The invitation could not be sent. Please try again.');
  }
}
