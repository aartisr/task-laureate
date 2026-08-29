import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionReporter } from './GlobalExceptionReporter';

describe('GlobalExceptionReporter', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<GlobalExceptionReporter />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('offers a non-blocking, user-controlled report after an unhandled runtime error', async () => {
    await act(async () => window.dispatchEvent(new ErrorEvent('error', { error: new Error('Save did not finish') })));

    expect(host.textContent).toContain('Something didn’t finish as expected.');
    const report = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Report issue');
    await act(async () => report?.click());
    expect(host.textContent).toContain('Send a support report?');

    const close = host.querySelector<HTMLButtonElement>('[aria-label="Close support report"]');
    await act(async () => close?.click());
    expect(host.textContent).not.toContain('Something didn’t finish as expected.');
  });

  it('does not distract the user when deployment recovery owns a stale-module error', async () => {
    await act(async () => window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('Failed to fetch dynamically imported module') })));

    expect(host.textContent).toBe('');
  });
});
