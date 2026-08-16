import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListComposer } from './ListComposer';

describe('ListComposer', () => {
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

  it('starts with one required decision and keeps context out of the fast path', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    await act(async () => { root.render(<ListComposer onCreate={vi.fn()} onCancel={vi.fn()} />); });

    const titleInput = host.querySelector<HTMLInputElement>('#list-composer-title');
    expect(titleInput).not.toBeNull();
    expect(document.activeElement).toBe(titleInput);
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
    expect(host.textContent).toContain('Create & add tasks');
    expect(host.textContent).toContain('Press Enter to create');

    const advanced = host.querySelector<HTMLDetailsElement>('.list-composer__details');
    expect(advanced?.open).toBe(false);
    await act(async () => advanced?.querySelector('summary')?.click());
    expect(advanced?.open).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>('#list-composer-description')).not.toBeNull();
  });
});
