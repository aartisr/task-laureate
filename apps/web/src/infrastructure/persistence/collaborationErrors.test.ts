import { describe, expect, it } from 'vitest';
import { collaborationError } from './collaborationErrors';

describe('collaboration error mapping', () => {
  it('explains that a missing RPC may be a PostgREST schema-cache delay', () => {
    const error = collaborationError(404, { message: 'Could not find the function' }, '/rpc/create_collaboration_task');
    expect(error.isConfigurationFailure).toBe(true);
    expect(error.message).toContain('schema cache');
    expect(error.message).not.toContain('invitation service');
  });

  it('does not call an unrelated RPC 404 a configuration problem', () => {
    const error = collaborationError(404, { message: 'List not found' }, '/rpc/lookup_list');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('List not found');
  });

  it('does not claim missing migrations for a function permission denial', () => {
    const error = collaborationError(403, { message: 'permission denied for function accept_share_invitation' }, '/rpc/accept_share_invitation');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('signed in to the email');
  });

  it('turns an account-bound invitation rejection into a recoverable, typed error', () => {
    const error = collaborationError(400, { message: 'Invitation does not belong to this account' }, '/rpc/accept_share_invitation');
    expect(error.reason).toBe('invitation-account-mismatch');
    expect(error.message).toBe('This invitation was sent to a different account.');
    expect(error.message).not.toContain('Task request failed');
  });

  it('reports attachment-delete authorization separately from invitation errors', () => {
    const error = collaborationError(403, { message: 'permission denied for schema private' }, '/rpc/delete_task_attachment');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('Attachment removal was denied by Supabase');
    expect(error.message).toContain('permission denied for schema private');
    expect(error.message).not.toContain('invitation service');
  });

  it('keeps attachment metadata denials actionable', () => {
    const error = collaborationError(403, { message: 'permission denied for table task_attachments' }, '/task_attachments?id=eq.attachment-id');
    expect(error.message).toContain('Attachment metadata update was denied by Supabase');
    expect(error.message).toContain('permission denied for table task_attachments');
  });

  it('does not mislabel a real authorization denial as a setup error', () => {
    const error = collaborationError(403, { message: 'new row violates row-level security policy' }, '/collaboration_lists');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('no longer have permission');
  });
});
