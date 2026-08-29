import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollaborationRepository } from '../core/contracts/repository';
import { collaborationError } from '../infrastructure/persistence/collaborationErrors';
import { ShareResourcePanel } from './ShareResourcePanel';

describe('ShareResourcePanel', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps invitation creation available when the optional collaborator-email RPC is not deployed', async () => {
    const repository = {
      listOutgoingInvitations: vi.fn().mockResolvedValue([]),
      listCollaborators: vi.fn().mockRejectedValue(collaborationError(404, { message: 'Could not find the function' }, '/rpc/list_resource_collaborators')),
    } as unknown as CollaborationRepository;

    await act(async () => {
      root.render(<ShareResourcePanel repository={repository} resource={{ resourceType: 'task', resourceId: 'task-id' }} resourceName="Launch brief" onClose={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Share “Launch brief”');
    expect(host.textContent).toContain('Couldn’t load collaborator emails yet.');
    expect(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Invite as editor')).toBeDefined();
  });

  it('explains the actual recovery path when the signed-in account does not own the Task', async () => {
    const repository = {
      listOutgoingInvitations: vi.fn().mockResolvedValue([]),
      listCollaborators: vi.fn().mockRejectedValue(new Error('Task request failed: Only the Task owner can view collaborator identities')),
    } as unknown as CollaborationRepository;

    await act(async () => {
      root.render(<ShareResourcePanel repository={repository} resource={{ resourceType: 'task', resourceId: 'task-id' }} resourceName="Launch brief" onClose={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Your signed-in account does not own this Task.');
    expect(host.textContent).toContain('Only its owner can view collaborators or create, revoke, and manage Task invitations.');
    expect(host.textContent).toContain('If you own the enclosing List and intend to share all of its tasks, share the List instead.');
    expect(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Task owner required')?.disabled).toBe(true);
  });

  it('uses the database-compatible Task label for a legacy-cased resource type', async () => {
    const repository = {
      listOutgoingInvitations: vi.fn().mockResolvedValue([]),
      listCollaborators: vi.fn().mockRejectedValue(new Error('Task request failed: Only the Task owner can view collaborator identities')),
    } as unknown as CollaborationRepository;

    await act(async () => {
      root.render(<ShareResourcePanel repository={repository} resource={{ resourceType: 'Task' as never, resourceId: 'task-id' }} resourceName="Launch brief" onClose={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Your signed-in account does not own this Task.');
    expect(host.textContent).not.toContain('does not own this List');
  });
});
