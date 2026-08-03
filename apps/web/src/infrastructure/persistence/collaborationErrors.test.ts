import { describe, expect, it } from 'vitest';
import { collaborationError } from './collaborationErrors';

describe('collaboration error mapping', () => {
  it('turns a missing RPC into an actionable migration message', () => {
    const error = collaborationError(404, { message: 'Could not find the function' }, '/rpc/create_collaboration_task');
    expect(error.isConfigurationFailure).toBe(true);
    expect(error.message).toContain('migrations 005 through 008');
  });

  it('does not mislabel a real authorization denial as a setup error', () => {
    const error = collaborationError(403, { message: 'new row violates row-level security policy' }, '/collaboration_lists');
    expect(error.isConfigurationFailure).toBe(false);
    expect(error.message).toContain('no longer have permission');
  });
});
