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
    expect(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Create secure invite')).toBeDefined();
  });

  it('does not block a secure invite when the roster RPC rejects a legacy resource value', async () => {
    const repository = {
      listOutgoingInvitations: vi.fn().mockResolvedValue([]),
      listCollaborators: vi.fn().mockRejectedValue(new Error('Task request failed: Invalid resource type')),
    } as unknown as CollaborationRepository;

    await act(async () => {
      root.render(<ShareResourcePanel repository={repository} resource={{ resourceType: 'task', resourceId: 'task-id' }} resourceName="Launch brief" onClose={vi.fn()} />);
      await Promise.resolve();
    });

    expect(host.textContent).toContain('You can still create a secure invitation.');
    expect(Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Create secure invite')).toBeDefined();
  });
});
