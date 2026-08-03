export interface SupabaseErrorPayload { message?: string; code?: string; hint?: string; details?: string; }

export class CollaborationPersistenceError extends Error {
  readonly status: number;
  readonly isConfigurationFailure: boolean;
  constructor(message: string, status: number, isConfigurationFailure = false) {
    super(message);
    this.name = 'CollaborationPersistenceError';
    this.status = status;
    this.isConfigurationFailure = isConfigurationFailure;
  }
}

/** Maps low-level PostgREST failures to a stable, non-sensitive user message. */
export function collaborationError(status: number, payload: SupabaseErrorPayload, endpoint: string) {
  const detail = [payload.message, payload.hint, payload.details].filter(Boolean).join(' ').toLowerCase();
  const missingRpc = status === 404 && endpoint.includes('/rpc/');
  const missingGrant = status === 403 && /permission denied|not authorized/.test(detail);
  if (missingRpc || missingGrant) return new CollaborationPersistenceError(
    'Your collaboration database is not ready. Apply Supabase migrations 005 through 008, then refresh this page.', status, true,
  );
  if (status === 401) return new CollaborationPersistenceError('Your session has expired. Sign in again, then retry.', status);
  if (status === 403) return new CollaborationPersistenceError('You no longer have permission to perform this action.', status);
  return new CollaborationPersistenceError(`Task request failed: ${payload.message ?? 'Please try again.'}`, status);
}
