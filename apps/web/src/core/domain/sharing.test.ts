import { describe, expect, it } from 'vitest';
import { canPerform, effectiveRole, highestRole, invitationIsActive, normalizeInvitationEmail } from './sharing';

describe('sharing policy', () => {
  it('uses the documented owner > editor > viewer precedence', () => {
    expect(highestRole('viewer', 'editor')).toBe('editor');
    expect(effectiveRole({ userId: 'owner', ownerId: 'owner', listMembership: 'viewer' })).toBe('owner');
  });

  it('keeps access management and list structure owner-only', () => {
    expect(canPerform('editor', 'update_task')).toBe(true);
    expect(canPerform('editor', 'manage_access')).toBe(false);
    expect(canPerform('editor', 'update_list')).toBe(false);
    expect(canPerform('viewer', 'update_task')).toBe(false);
  });

  it('normalizes invitation identities and rejects expired invitations', () => {
    expect(normalizeInvitationEmail(' Maya@Example.COM ')).toBe('maya@example.com');
    expect(invitationIsActive({ status: 'pending', expiresAt: '2000-01-01T00:00:00.000Z' })).toBe(false);
  });
});
