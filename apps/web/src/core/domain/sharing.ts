/**
 * Sharing is intentionally resource-scoped. These types and policy helpers are
 * transport-agnostic so the browser, API, and database integration tests can
 * agree on the same vocabulary without trusting the browser for enforcement.
 */
export type ShareResourceType = 'list' | 'task';
export type CollaboratorRole = 'editor' | 'viewer';
export type EffectiveRole = 'owner' | CollaboratorRole | null;
export type CollaborationAction =
  | 'read'
  | 'update_task'
  | 'delete_task'
  | 'create_task'
  | 'reorder_task'
  | 'update_list'
  | 'manage_access'
  | 'transfer_ownership'
  | 'export_list';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface Collaborator {
  resourceType: ShareResourceType;
  resourceId: string;
  userId: string;
  /** Owner-only display identity returned by the collaboration roster RPC. */
  email: string;
  role: CollaboratorRole;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareInvitation {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  email: string;
  role: CollaboratorRole;
  status: InvitationStatus;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
  acceptedBy: string | null;
}

/** A recipient-facing, deliberately minimal resource summary. */
export interface SharedResource {
  resourceType: ShareResourceType;
  resourceId: string;
  title: string;
  description: string;
  role: CollaboratorRole;
  sharedBy: string;
  updatedAt: string;
}

/** An owner-facing List summary for the outgoing collaboration workspace. */
export interface SharedByMeList {
  listId: string;
  title: string;
  description: string;
  updatedAt: string;
  collaboratorCount: number;
  pendingInvitationCount: number;
}

export interface AccessContext {
  userId: string | null;
  ownerId: string;
  listMembership?: CollaboratorRole | null;
  taskMembership?: CollaboratorRole | null;
}

const ROLE_WEIGHT: Record<Exclude<EffectiveRole, null>, number> = { viewer: 1, editor: 2, owner: 3 };

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

/** The one and only precedence rule: owner > editor > viewer. */
export function highestRole(...roles: Array<EffectiveRole | undefined>): EffectiveRole {
  return roles.reduce<EffectiveRole>((highest, candidate) => {
    if (!candidate) return highest;
    return !highest || ROLE_WEIGHT[candidate] > ROLE_WEIGHT[highest] ? candidate : highest;
  }, null);
}

export function effectiveRole(context: AccessContext): EffectiveRole {
  if (!context.userId) return null;
  if (context.userId === context.ownerId) return 'owner';
  return highestRole(context.listMembership, context.taskMembership);
}

export function canPerform(role: EffectiveRole, action: CollaborationAction) {
  if (role === 'owner') return true;
  if (role !== 'editor') return action === 'read';
  return ['read', 'update_task', 'delete_task', 'create_task', 'reorder_task'].includes(action);
}

export function describeRole(role: EffectiveRole) {
  if (role === 'owner') return 'Owner';
  if (role === 'editor') return 'Can update';
  if (role === 'viewer') return 'Read-only';
  return 'No access';
}

export function invitationIsActive(invitation: Pick<ShareInvitation, 'status' | 'expiresAt'>, now = new Date()) {
  return invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() > now.getTime();
}
