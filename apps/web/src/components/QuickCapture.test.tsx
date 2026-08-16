import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuickCapture } from './QuickCapture';

describe('QuickCapture mobile trigger', () => {
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

  it('provides a labelled, one-tap mobile entry point to the shared Inbox composer', async () => {
    await act(async () => { root.render(<QuickCapture triggerVariant="mobile" />); });

    const trigger = host.querySelector<HTMLButtonElement>('.mobile-bottom-nav__capture');
    expect(trigger?.getAttribute('aria-label')).toBe('Quick capture a task, idea, or reminder');
    expect(trigger?.textContent).toContain('Capture');

    await act(async () => trigger?.click());
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('quick-capture-title');
    expect(document.querySelector('textarea')?.getAttribute('placeholder')).toBe('Write the thought exactly as it arrives…');
  });
});
