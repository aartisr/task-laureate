export interface SupabaseErrorPayload { message?: string; code?: string; hint?: string; details?: string; }

export class CollaborationPersistenceError extends Error {
  readonly status: number;
  readonly isConfigurationFailure: boolean;
  readonly reason: 'invitation-account-mismatch' | undefined;
  constructor(message: string, status: number, isConfigurationFailure = false, reason?: 'invitation-account-mismatch') {
    super(message);
    this.name = 'CollaborationPersistenceError';
    this.status = status;
    this.isConfigurationFailure = isConfigurationFailure;
    this.reason = reason;
  }
}

/** Maps low-level PostgREST failures to a stable, non-sensitive user message. */
export function collaborationError(status: number, payload: SupabaseErrorPayload, endpoint: string) {
  const detail = [payload.message, payload.hint, payload.details].filter(Boolean).join(' ').toLowerCase();
  if (endpoint.includes('/rpc/accept_share_invitation') && /invitation does not belong to this account/.test(detail)) {
    return new CollaborationPersistenceError(
      'This invitation was sent to a different account.',
      status,
      false,
      'invitation-account-mismatch',
    );
  }
  // PostgREST returns 404 when its schema cache has not yet learned about an RPC.
  // This can happen immediately after a migration even though the function exists;
  // it is not evidence that a particular migration was skipped.
  const missingRpc = status === 404
    && endpoint.includes('/rpc/')
    && (/could not find the function|schema cache|pgrst202/.test(detail));
  if (missingRpc) return new CollaborationPersistenceError(
    'A required Task service is temporarily unavailable. Refresh once, then ask an administrator to reload the Supabase PostgREST schema cache if it persists.',
    status,
    true,
  );
  if (status === 401) return new CollaborationPersistenceError('Your session has expired. Sign in again, then retry.', status);
  if (status === 403) {
    if (endpoint.includes('/rpc/delete_task_attachment')) {
      const reason = payload.message ?? payload.details ?? 'Supabase did not provide a reason.';
      return new CollaborationPersistenceError(`Attachment removal was denied by Supabase: ${reason}`, status);
    }
    if (endpoint.startsWith('/task_attachments')) {
      const reason = payload.message ?? payload.details ?? 'Supabase did not provide a reason.';
      return new CollaborationPersistenceError(`Attachment metadata update was denied by Supabase: ${reason}`, status);
    }
    if (/permission denied|not authorized/.test(detail)) {
      return new CollaborationPersistenceError('The invitation service denied this request. Confirm you are signed in to the email that received the invitation, then retry.', status);
    }
    return new CollaborationPersistenceError('You no longer have permission to perform this action.', status);
  }
  return new CollaborationPersistenceError(`Task request failed: ${payload.message ?? 'Please try again.'}`, status);
}
