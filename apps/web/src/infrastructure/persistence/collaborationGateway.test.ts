import { describe, expect, it } from 'vitest';
import { createSupabaseCollaborationGateway } from './collaborationGateway';

const config = {
  url: 'https://example.supabase.co', publishableKey: 'publishable-key', workspaceId: 'main', table: 'workspace_snapshots', schema: 'public', debounceMs: 1, fallbackToLocal: false, requireAuth: true,
  getAccessToken: () => 'member-jwt',
};

describe('Supabase collaboration gateway', () => {
  it('keeps the raw invitation token out of the database request', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createSupabaseCollaborationGateway(config, async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify('invite-id'), { status: 200 });
    });

    const result = await gateway.createShareInvitation({ resourceType: 'list', resourceId: '11111111-1111-1111-1111-111111111111', email: '  PERSON@Example.com ', role: 'viewer' });
    const body = JSON.parse(String(requests[0].init?.body));

    expect(requests[0].url).toContain('/rpc/create_share_invitation');
    expect(new Headers(requests[0].init?.headers).get('Authorization')).toBe('Bearer member-jwt');
    expect(body.p_email_normalized).toBe('person@example.com');
    expect(body.p_token_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.acceptanceUrl).toContain('/share/accept?token=');
    expect(result.acceptanceUrl).not.toContain(body.p_token_digest);
  });

  it('uses the narrow invitation-revocation RPC', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createSupabaseCollaborationGateway(config, async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    });
    await gateway.revokeShareInvitation('invite-id');
    expect(requests[0].url).toContain('/rpc/revoke_share_invitation');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ p_invitation_id: 'invite-id' });
  });
});
