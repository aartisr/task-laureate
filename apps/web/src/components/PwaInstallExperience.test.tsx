import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallExperience } from './PwaInstallExperience';

describe('PwaInstallExperience', () => {
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

  it('keeps installation details closed until the person deliberately opens the compact indicator', async () => {
    const nativePrompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: nativePrompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });

    await act(async () => { root.render(<PwaInstallExperience />); });
    expect(host.querySelector('[aria-label="Install Task Laureate"]')).toBeNull();

    await act(async () => window.dispatchEvent(installEvent));
    const indicator = host.querySelector<HTMLButtonElement>('.pwa-install__trigger');
    expect(indicator?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.pwa-install__panel')).toBeNull();

    await act(async () => indicator?.click());
    expect(host.querySelector('.pwa-install__panel')?.getAttribute('aria-label')).toBe('Install Task Laureate');

    const install = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Install');
    await act(async () => install?.click());
    expect(nativePrompt).toHaveBeenCalledOnce();
  });
});
