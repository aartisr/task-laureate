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

  it('does not mislabel a real authorization denial as a setup error', () => {
    const error = collaborationError(403, { message: 'new row violates row-level security policy' }, '/collaboration_lists');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('no longer have permission');
  });
});
