import { createHash, randomBytes } from 'node:crypto';

export const maxDuration = 15;
const json = { 'Content-Type': 'application/json' };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const token = () => randomBytes(32).toString('hex');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const escape = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function fail(response, status, message) { return response.status(status).json({ message }); }
async function responseMessage(result, fallback) {
  try {
    const payload = await result.json();
    return typeof payload?.message === 'string' && payload.message.trim() ? payload.message.trim() : fallback;
  } catch { return fallback; }
}

/**
 * Server-only invite delivery. The caller's JWT authorizes the database RPC;
 * Resend and Supabase server keys never reach the browser. A delivery failure
 * revokes the just-created invite so there is no inaccessible pending access.
 */
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).setHeader('Allow', 'POST').json({ message: 'Method not allowed.' });
  const auth = request.headers.authorization;
  // The public URL/key are safe to reuse server-side. Supporting the Vite names
  // makes this endpoint work with the project’s existing Supabase deployment
  // configuration while keeping Resend itself strictly server-only.
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO;
  const appUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
  const missing = [
    !resendKey && 'RESEND_API_KEY', !from && 'RESEND_FROM_EMAIL', !appUrl && 'PUBLIC_APP_URL', !supabaseUrl && 'SUPABASE_URL or VITE_SUPABASE_URL', !publishableKey && 'SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean);
  if (!auth?.startsWith('Bearer ')) return fail(response, 401, 'Sign in before sending an invitation.');
  if (missing.length) return fail(response, 503, `Invitation email delivery is not configured. Missing: ${missing.join(', ')}.`);
  const jwt = auth.slice(7);
  try {
    const identity = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: auth } });
    if (!identity.ok) return fail(response, 401, 'Your session has expired. Sign in and try again.');
    let user = null;
    try { user = await identity.json(); } catch { /* ignore */ }
    const inviterEmail = typeof user?.email === 'string' ? user.email.trim() : '';
    const inviterName = typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : '';
    const inviterDisplay = inviterName || inviterEmail || 'A Task Laureate collaborator';

    const { resourceType, resourceId, email, role, resourceTitle: clientTitle } = request.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!['list', 'task'].includes(resourceType) || !/^[0-9a-f-]{36}$/i.test(resourceId ?? '') || !emailPattern.test(normalizedEmail) || !['editor', 'viewer'].includes(role)) return fail(response, 400, 'The invitation details are invalid.');

    let resourceTitle = typeof clientTitle === 'string' && clientTitle.trim() ? clientTitle.trim() : '';
    if (!resourceTitle) {
      try {
        const table = resourceType === 'list' ? 'collaboration_lists' : 'collaboration_tasks';
        const resLookup = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${resourceId}&select=title`, {
          headers: { apikey: publishableKey, Authorization: `Bearer ${jwt}` }
        });
        if (resLookup.ok) {
          const rows = await resLookup.json();
          if (Array.isArray(rows) && rows[0]?.title) {
            resourceTitle = String(rows[0].title).trim();
          }
        }
      } catch {
        // Fallback silently if title lookup fails
      }
    }

    const rawToken = token(); const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_share_invitation`, { method: 'POST', headers: { ...json, apikey: publishableKey, Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ p_resource_type: resourceType, p_resource_id: resourceId, p_email_normalized: normalizedEmail, p_role: role, p_token_digest: digest(rawToken), p_expires_at: expiresAt }) });
    if (!inviteResponse.ok) {
      const reason = await responseMessage(inviteResponse, 'The collaboration database rejected this invitation.');
      return fail(response, inviteResponse.status, `Unable to create the invitation: ${reason}`);
    }
    const invitationId = await inviteResponse.json();
    const inviteUrl = `${appUrl}/share/accept?token=${encodeURIComponent(rawToken)}`;
    const roleLabel = role === 'editor' ? 'Can update' : 'Read-only';
    const roleDescription = role === 'editor' ? 'Can update (Add, edit & complete tasks)' : 'Read-only (View tasks & progress)';
    const subject = resourceTitle
      ? `${inviterDisplay} invited you to collaborate on “${resourceTitle}”`
      : `${inviterDisplay} invited you to collaborate on a Task Laureate ${resourceType}`;
    const html = `<main style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:24px 16px;color:#172033;line-height:1.5;">
<p style="color:#635bff;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px;margin:0 0 12px">Task Laureate</p>
<h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#0f172a">You’ve been invited to collaborate</h1>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 20px;">
<p style="margin:0 0 8px;font-size:14px;color:#334155;"><strong>${escape(inviterDisplay)}</strong>${inviterName && inviterEmail ? ` <span style="color:#64748b;font-size:13px;">(${escape(inviterEmail)})</span>` : ''} has invited you to collaborate on ${resourceTitle ? `<strong>“${escape(resourceTitle)}”</strong>` : `a shared ${escape(resourceType)}`}.</p>
<p style="margin:0;font-size:13px;color:#475569;">Access level: <strong>${escape(roleDescription)}</strong></p>
</div>
<p style="margin:0 0 20px;"><a href="${inviteUrl}" style="display:inline-block;background:#635bff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Open shared ${escape(resourceType)}</a></p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
<p style="color:#64748b;font-size:13px;margin:0">For your security, sign in with <strong>${escape(normalizedEmail)}</strong>. This invitation was sent by <strong>${escape(inviterDisplay)}${inviterName && inviterEmail ? ` (${escape(inviterEmail)})` : ''}</strong> and expires in seven days.</p>
</main>`;
    const text = `${inviterDisplay}${inviterName && inviterEmail ? ` (${inviterEmail})` : ''} invited you to collaborate on ${resourceTitle ? `“${resourceTitle}”` : `a Task Laureate ${resourceType}`} with ${roleLabel} access.\n\nOpen: ${inviteUrl}\n\nFor your security, sign in with ${normalizedEmail}. This invitation expires in seven days.`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { ...json, Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': `share-invitation/${invitationId}` },
      body: JSON.stringify({
        from,
        ...(replyTo ? { reply_to: replyTo } : (inviterEmail ? { reply_to: inviterEmail } : {})),
        to: [normalizedEmail],
        subject,
        tags: [{ name: 'category', value: 'share_invitation' }, { name: 'resource_type', value: resourceType }, { name: 'invitation_id', value: String(invitationId) }],
        html,
        text
      })
    });
    if (!emailResponse.ok) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/revoke_share_invitation`, { method: 'POST', headers: { ...json, apikey: publishableKey, Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ p_invitation_id: invitationId }) });
      const reason = await responseMessage(emailResponse, 'Resend did not provide a delivery reason.');
      // Resend error messages identify configuration issues such as a missing
      // verified sending domain. They contain no credentials, and are far more
      // useful to an owner than a generic retry prompt.
      return fail(response, 502, `Resend could not send this invitation: ${reason} No access was granted.`);
    }
    return response.status(201).json({ invitation: { id: invitationId, resource_type: resourceType, resource_id: resourceId, email_normalized: normalizedEmail, role, status: 'pending', invited_by: '', expires_at: expiresAt, created_at: new Date().toISOString(), accepted_by: null }, delivery: 'sent' });
  } catch (error) {
    console.error('[Task-Laureate invitations] Delivery failed.', { message: error instanceof Error ? error.message : String(error) });
    return fail(response, 500, 'The invitation could not be sent. Please try again.');
  }
}
