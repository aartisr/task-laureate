import type { CollaborationRepository, CreateShareInvitationInput, ShareResourceInput } from '../../core/contracts/repository';
import type { CollaboratorRole, EffectiveRole, ShareInvitation, SharedByMeList, ShareResourceType, SharedResource } from '../../core/domain/sharing';
import { normalizeInvitationEmail } from '../../core/domain/sharing';
import type { SupabasePersistenceConfig } from './config';
import { collaborationError } from './collaborationErrors';

type FetchLike = typeof fetch;
type InvitationRow = {
  id: string; resource_type: ShareResourceType; resource_id: string; email_normalized: string; role: CollaboratorRole;
  status: ShareInvitation['status']; invited_by: string; expires_at: string; created_at: string; accepted_by: string | null;
};
type CollaboratorRow = { user_id: string; email: string; role: CollaboratorRole; granted_by: string; created_at: string; updated_at: string };
type SharedResourceRow = { resource_type: ShareResourceType; resource_id: string; title: string; description: string; role: CollaboratorRole; shared_by: string; updated_at: string };
type SharedByMeListRow = { list_id: string; title: string; description: string; updated_at: string; collaborator_count: number; pending_invitation_count: number };
const REQUEST_TIMEOUT_MS = 15_000;

function bytesToHex(bytes: Uint8Array) { return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

/**
 * Small transport adapter for the collaboration RPC boundary. It intentionally
 * knows no React/UI concerns, so it can be replaced with an API client later.
 * The raw invite token exists only in memory long enough to construct the
 * recipient URL; Postgres stores its SHA-256 digest only.
 */
export function createSupabaseCollaborationGateway(config: SupabasePersistenceConfig, request: FetchLike = fetch): CollaborationRepository {
  if (!config.url || !config.publishableKey) throw new Error('Collaboration requires configured Supabase credentials.');
  const rest = `${config.url.replace(/\/$/, '')}/rest/v1`;
  const authorized = async (path: string, init: RequestInit = {}) => {
    const accessToken = await config.getAccessToken?.();
    if (!accessToken) throw new Error('Sign in before sharing a List or Task.');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await request(`${rest}${path}`, {
        ...init, signal: controller.signal,
        headers: { apikey: config.publishableKey!, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Sharing request timed out. Check your connection and confirm the collaboration migrations are applied.');
      throw error;
    } finally { window.clearTimeout(timeout); }
    if (!response.ok) {
      let payload: { message?: string; hint?: string; details?: string } = { message: response.statusText };
      try { payload = await response.json() as typeof payload; } catch { /* response may be empty */ }
      throw collaborationError(response.status, payload, path);
    }
    return response;
  };
  const toInvitation = (row: InvitationRow): ShareInvitation => ({ id: row.id, resourceType: row.resource_type, resourceId: row.resource_id, email: row.email_normalized, role: row.role, status: row.status, invitedBy: row.invited_by, expiresAt: row.expires_at, createdAt: row.created_at, acceptedBy: row.accepted_by });

  return {
    async listSharedResources() {
      const rows = await (await authorized('/rpc/list_shared_resources', { method: 'POST', body: JSON.stringify({}) })).json() as SharedResourceRow[];
      return rows.map((row): SharedResource => ({ resourceType: row.resource_type, resourceId: row.resource_id, title: row.title, description: row.description, role: row.role, sharedBy: row.shared_by, updatedAt: row.updated_at }));
    },
    async listListsSharedByMe() {
      const rows = await (await authorized('/rpc/list_lists_shared_by_me', { method: 'POST', body: JSON.stringify({}) })).json() as SharedByMeListRow[];
      return rows.map((row): SharedByMeList => ({
        listId: row.list_id,
        title: row.title,
        description: row.description,
        updatedAt: row.updated_at,
        collaboratorCount: Number(row.collaborator_count),
        pendingInvitationCount: Number(row.pending_invitation_count),
      }));
    },
    async getResourceAccess({ resourceType, resourceId }: ShareResourceInput): Promise<EffectiveRole> {
      const role = await (await authorized('/rpc/get_collaboration_resource_access', { method: 'POST', body: JSON.stringify({ p_resource_type: resourceType, p_resource_id: resourceId }) })).json() as EffectiveRole | null;
      return role ?? null;
    },
    async listCollaborators({ resourceType, resourceId }: ShareResourceInput) {
      const rows = await (await authorized('/rpc/list_resource_collaborators', { method: 'POST', body: JSON.stringify({ p_resource_type: resourceType, p_resource_id: resourceId }) })).json() as CollaboratorRow[];
      return rows.map((row) => ({ resourceType, resourceId, userId: row.user_id, email: row.email, role: row.role, grantedBy: row.granted_by, createdAt: row.created_at, updatedAt: row.updated_at }));
    },
    async listOutgoingInvitations({ resourceType, resourceId }: ShareResourceInput) {
      const query = new URLSearchParams({ resource_type: `eq.${resourceType}`, resource_id: `eq.${resourceId}`, select: 'id,resource_type,resource_id,email_normalized,role,status,invited_by,expires_at,created_at,accepted_by', order: 'created_at.desc' });
      const rows = await (await authorized(`/share_invitations?${query}`, { method: 'GET' })).json() as InvitationRow[];
      return rows.map(toInvitation);
    },
    async createShareInvitation(input: CreateShareInvitationInput) {
      if (config.invitationDeliveryUrl) {
        const accessToken = await config.getAccessToken?.();
        if (!accessToken) throw new Error('Sign in before sharing a List or Task.');
        const response = await request(config.invitationDeliveryUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceType: input.resourceType, resourceId: input.resourceId, email: normalizeInvitationEmail(input.email), role: input.role, resourceTitle: input.resourceTitle }) });
        if (!response.ok) {
          let payload: { message?: string } = {};
          try { payload = await response.json() as typeof payload; } catch { /* a proxy or stale deployment may return HTML */ }
          const requestId = response.headers.get('x-vercel-id');
          const localViteWithoutFunction = response.status === 404
            && config.invitationDeliveryUrl.startsWith('/')
            && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
          // Vite serves the SPA but not Vercel functions. Preserve a usable,
          // secure manual invitation flow rather than presenting a false error.
          if (!localViteWithoutFunction) throw new Error(payload.message ?? `The invitation delivery service returned HTTP ${response.status}.${requestId ? ` Reference: ${requestId}.` : ''}`);
        } else {
          const result = await response.json() as { invitation: InvitationRow };
          return { invitation: toInvitation(result.invitation), delivery: 'sent' as const };
        }
      }
      const rawToken = token();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const response = await authorized('/rpc/create_share_invitation', { method: 'POST', body: JSON.stringify({
        p_resource_type: input.resourceType, p_resource_id: input.resourceId, p_email_normalized: normalizeInvitationEmail(input.email), p_role: input.role, p_token_digest: await digest(rawToken), p_expires_at: expiresAt,
      }) });
      const invitationId = await response.json() as string;
      const invitation: ShareInvitation = { id: invitationId, resourceType: input.resourceType, resourceId: input.resourceId, email: normalizeInvitationEmail(input.email), role: input.role, status: 'pending', invitedBy: '', expiresAt, createdAt: new Date().toISOString(), acceptedBy: null };
      return { invitation, acceptanceUrl: `${window.location.origin}/share/accept?token=${encodeURIComponent(rawToken)}`, delivery: 'manual' as const };
    },
    async acceptShareInvitation(rawToken: string) {
      return await (await authorized('/rpc/accept_share_invitation', { method: 'POST', body: JSON.stringify({ p_token: rawToken }) })).json() as { resourceType: ShareResourceType; resourceId: string; role: CollaboratorRole };
    },
    async revokeShareInvitation(invitationId: string) {
      await authorized('/rpc/revoke_share_invitation', { method: 'POST', body: JSON.stringify({ p_invitation_id: invitationId }) });
    },
    async revokeResourceAccess({ resourceType, resourceId, userId }) {
      await authorized('/rpc/revoke_resource_access', { method: 'POST', body: JSON.stringify({ p_resource_type: resourceType, p_resource_id: resourceId, p_user_id: userId }) });
    },
  };
}
