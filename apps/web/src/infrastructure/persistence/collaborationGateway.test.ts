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

  it('forwards resourceTitle to the invitation delivery service when configured', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createSupabaseCollaborationGateway({
      ...config,
      invitationDeliveryUrl: '/api/invitations',
    }, async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        invitation: {
          id: 'invite-123',
          resource_type: 'list',
          resource_id: '11111111-1111-1111-1111-111111111111',
          email_normalized: 'collab@example.com',
          role: 'editor',
          status: 'pending',
          invited_by: 'user-1',
          expires_at: '2026-09-05T00:00:00.000Z',
          created_at: '2026-08-29T00:00:00.000Z',
          accepted_by: null,
        },
        delivery: 'sent',
      }), { status: 200 });
    });

    const result = await gateway.createShareInvitation({
      resourceType: 'list',
      resourceId: '11111111-1111-1111-1111-111111111111',
      email: 'collab@example.com',
      role: 'editor',
      resourceTitle: 'Sprint 24 Tasks',
    });

    expect(requests[0].url).toBe('/api/invitations');
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.resourceTitle).toBe('Sprint 24 Tasks');
    expect(body.role).toBe('editor');
    expect(body.email).toBe('collab@example.com');
    expect(result.delivery).toBe('sent');
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

  it('loads outgoing sharing as compact owner-facing List summaries', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createSupabaseCollaborationGateway(config, async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify([{
        list_id: 'list-id', title: 'Launch plan', description: 'Shared work', updated_at: '2026-08-17T00:00:00Z',
        collaborator_count: 2, pending_invitation_count: 1,
      }]), { status: 200 });
    });

    await expect(gateway.listListsSharedByMe()).resolves.toEqual([{
      listId: 'list-id', title: 'Launch plan', description: 'Shared work', updatedAt: '2026-08-17T00:00:00Z',
      collaboratorCount: 2, pendingInvitationCount: 1,
    }]);
    expect(requests[0].url).toContain('/rpc/list_lists_shared_by_me');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({});
  });

  it('loads collaborator emails through the owner-only roster RPC, never a public user lookup', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const gateway = createSupabaseCollaborationGateway(config, async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify([{
        user_id: 'collaborator-id', email: 'person@example.com', role: 'editor', granted_by: 'owner-id',
        created_at: '2026-08-16T00:00:00Z', updated_at: '2026-08-16T00:00:00Z',
      }]), { status: 200 });
    });

    await expect(gateway.listCollaborators({ resourceType: 'list', resourceId: 'list-id' })).resolves.toEqual([
      expect.objectContaining({ userId: 'collaborator-id', email: 'person@example.com', role: 'editor' }),
    ]);
    expect(requests[0].url).toContain('/rpc/list_resource_collaborators');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ p_resource_type: 'list', p_resource_id: 'list-id' });
    expect(requests[0].url).not.toContain('auth.users');
  });
});
