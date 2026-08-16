import { describe, expect, it } from 'vitest';
import { resolveInvitationDeliveryUrl } from './invitationDelivery';

describe('invitation delivery route', () => {
  it('uses the bundled Vercel function in production when no override is configured', () => {
    expect(resolveInvitationDeliveryUrl(undefined, true)).toBe('/api/invitations');
  });

  it('keeps manual links available in local Vite development', () => {
    expect(resolveInvitationDeliveryUrl(undefined, false)).toBeUndefined();
  });

  it('honors an explicit delivery endpoint in every environment', () => {
    expect(resolveInvitationDeliveryUrl(' https://delivery.example/invitations ', true)).toBe('https://delivery.example/invitations');
  });
});
