import { afterEach, describe, expect, it, vi } from 'vitest';
import { recoverFromModuleVersionMismatch } from './moduleRecovery';

describe('recoverFromModuleVersionMismatch', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reloads once when a lazy chunk belongs to an older deployment', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });

    expect(recoverFromModuleVersionMismatch(new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/TasksPage-old.js'))).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(recoverFromModuleVersionMismatch(new TypeError('Failed to fetch dynamically imported module'))).toBe(false);
  });

  it('does not reload for unrelated application errors', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });

    expect(recoverFromModuleVersionMismatch(new Error('A request timed out'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('recovers from the iOS MIME message produced when a stale chunk receives the HTML shell', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });

    expect(recoverFromModuleVersionMismatch(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
