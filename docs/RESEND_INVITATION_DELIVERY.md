# Resend invitation delivery

Task Laureate sends collaboration invitations through the server-only endpoint
`/api/invitations`. The browser supplies the signed-in user's JWT and invitation
details; the endpoint verifies that JWT, asks Supabase to create the invite
under the caller's RLS permissions, sends the one-time link through Resend, and
revokes the invite if email delivery fails.

## Vercel environment variables

Set these in Vercel for Preview and Production. Do not put any of them in
`apps/web/.env.local` or any variable beginning with `VITE_`.

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Resend API key, restricted to email sending where available |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Task Laureate <invites@yourdomain.com>` |
| `RESEND_REPLY_TO` | Optional monitored reply-to address |
| `SUPABASE_URL` | Your project URL (the existing `VITE_SUPABASE_URL` is also accepted) |
| `SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key (the existing `VITE_SUPABASE_PUBLISHABLE_KEY` is also accepted) |
| `PUBLIC_APP_URL` | Canonical deployed app URL, without a trailing slash |

Set `VITE_INVITATION_DELIVERY_URL=/api/invitations` in the Vercel build
environment. The client never receives `RESEND_API_KEY`.

## Resend setup

1. Create a Resend account and verify the sending domain.
2. Add the DNS records Resend provides (SPF/DKIM; DMARC is strongly recommended).
3. Create an API key only for this application and store it in Vercel.
4. Deploy, invite a test account, and verify the email arrives and the link can
   be accepted only by the addressed account.

Every invitation send carries a Resend idempotency key derived from the invite
ID, so retries cannot produce duplicate emails within Resend’s idempotency
window. It also carries `share_invitation`, resource-type, and invitation-ID
tags for filtering delivery events in the Resend dashboard.

For local Vite development, leave `VITE_INVITATION_DELIVERY_URL` unset. The
Share panel intentionally falls back to explicit copy-link delivery because
Vite does not execute Vercel server functions.
