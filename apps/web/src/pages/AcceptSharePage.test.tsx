import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collaborationError } from '../infrastructure/persistence/collaborationErrors';

const mocked = vi.hoisted(() => ({
  acceptShareInvitation: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock('../app/runtime/appServices', () => ({ appServices: { repository: { acceptShareInvitation: mocked.acceptShareInvitation } } }));
vi.mock('../config/persistence.config', () => ({ authProvider: { getSession: mocked.getSession, signOut: mocked.signOut } }));
vi.mock('../core/contracts/repository', () => ({ supportsCollaboration: () => true }));
vi.mock('../hooks/usePageSEO', () => ({ usePageSEO: () => undefined }));

import { AcceptSharePage } from './AcceptSharePage';

describe('AcceptSharePage', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/share/accept?token=secure-invite-token');
    mocked.getSession.mockResolvedValue({ user: { id: 'wrong-account', email: 'personal@example.com' }, accessToken: 'token' });
    mocked.acceptShareInvitation.mockRejectedValue(collaborationError(400, { message: 'Invitation does not belong to this account' }, '/rpc/accept_share_invitation'));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('turns an account mismatch into a clear, account-aware recovery path', async () => {
    await act(async () => { root.render(<AcceptSharePage />); await Promise.resolve(); await Promise.resolve(); });

    expect(host.textContent).toContain('This invite is for a different account.');
    expect(host.textContent).toContain('personal@example.com');
    expect(host.textContent).toContain('Use a different account');
    expect(host.textContent).not.toContain('Task request failed');
    expect(host.textContent).not.toContain('Invitation does not belong to this account');
  });
});
