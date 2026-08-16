/**
 * Resolve the browser-facing invitation delivery route.
 *
 * Vercel deploys the invite function with this application, so production
 * should never degrade to a copy-link-only experience merely because a
 * browser-safe environment variable was omitted during a build. Local Vite
 * development deliberately retains the manual-link path because it does not
 * run Vercel functions.
 */
export function resolveInvitationDeliveryUrl(explicitUrl: string | undefined, isProduction: boolean) {
  return explicitUrl?.trim() || (isProduction ? '/api/invitations' : undefined);
}
