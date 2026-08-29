import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailConfirmationAuthProvider, PasswordAuthProvider } from '../core/contracts/auth';
import { CloudSyncAuthPanel } from './CloudSyncAuthPanel';

describe('CloudSyncAuthPanel', () => {
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

  it('hands a completed password session to its owner so the sign-in page can redirect', async () => {
    const onAuthenticated = vi.fn();
    const provider: PasswordAuthProvider = {
      configured: true,
      getSession: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(() => () => undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      signIn: vi.fn().mockResolvedValue({ user: { id: 'user-1', email: 'aarti@example.com' }, accessToken: 'token' }),
      signUp: vi.fn(),
    };

    await act(async () => {
      root.render(<CloudSyncAuthPanel provider={provider} presentation="embedded" onAuthenticated={onAuthenticated} />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('.email-auth__mode button:last-child')?.click();
    });
    expect(host.textContent).toContain('Create a private workspace');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('.email-auth__mode button:first-child')?.click();
      const [email, password] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(email, 'aarti@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter?.call(password, 'correct horse battery staple');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      const form = host.querySelector<HTMLFormElement>('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(provider.signIn).toHaveBeenCalledWith({ email: 'aarti@example.com', password: 'correct horse battery staple' });
    expect(onAuthenticated).toHaveBeenCalledWith({ user: { id: 'user-1', email: 'aarti@example.com' }, accessToken: 'token' });
  });

  it('explains the confirmation step after a new email account is created', async () => {
    const provider: PasswordAuthProvider & EmailConfirmationAuthProvider = {
      configured: true,
      getSession: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(() => () => undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      signIn: vi.fn(),
      signUp: vi.fn().mockResolvedValue(null),
      resendSignupConfirmation: vi.fn().mockResolvedValue(undefined),
    };

    await act(async () => {
      root.render(<CloudSyncAuthPanel provider={provider} presentation="embedded" />);
      await Promise.resolve();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('.email-auth__mode button:last-child')?.click();
    });
    const [email, password] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(email, 'aarti@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter?.call(password, 'a-safe-password');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(provider.signUp).toHaveBeenCalledWith({ email: 'aarti@example.com', password: 'a-safe-password' });
    expect(host.textContent).toContain('Confirm your email');
    expect(host.textContent).toContain('aarti@example.com');
    const resend = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Resend confirmation email');
    await act(async () => { resend?.click(); await Promise.resolve(); });
    expect(provider.resendSignupConfirmation).toHaveBeenCalledWith({ email: 'aarti@example.com' });
  });

  it('turns disabled email signup into an actionable Supabase configuration message', async () => {
    const provider: PasswordAuthProvider = {
      configured: true,
      getSession: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(() => () => undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      signIn: vi.fn(),
      signUp: vi.fn().mockRejectedValue(new Error('Email signups are disabled')),
    };
    await act(async () => {
      root.render(<CloudSyncAuthPanel provider={provider} presentation="embedded" />);
      await Promise.resolve();
    });
    await act(async () => host.querySelector<HTMLButtonElement>('.email-auth__mode button:last-child')?.click());
    const [email, password] = Array.from(host.querySelectorAll<HTMLInputElement>('input'));
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      valueSetter?.call(email, 'aarti@example.com');
      email.dispatchEvent(new Event('input', { bubbles: true }));
      valueSetter?.call(password, 'a-safe-password');
      password.dispatchEvent(new Event('input', { bubbles: true }));
      host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Enable Authentication → Providers → Email');
  });
});
