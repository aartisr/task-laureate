/**
 * Decides whether persistence must be rebuilt after an Auth event. Refreshes
 * for the same account and events during the OAuth callback do not alter the
 * data owner, so rebuilding there is both unnecessary and unsafe.
 */
export function shouldReinitializeForAuthChange(
  previousUserId: string | null | undefined,
  nextUserId: string | null,
  pathname: string,
): boolean {
  if (previousUserId === undefined) return false;
  if (previousUserId === nextUserId) return false;
  return pathname !== '/auth/callback';
}
