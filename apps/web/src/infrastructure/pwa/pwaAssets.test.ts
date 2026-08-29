import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest transforms modules into browser-style URLs under jsdom, so resolve
// public assets from the package working directory rather than import.meta.url.
const publicDirectory = resolve(process.cwd(), 'public');
const publicFile = (path: string) => resolve(publicDirectory, path.replace(/^\//, ''));

describe('PWA production asset contract', () => {
  it('ships installable icons that exist in the public build input', () => {
    const manifest = JSON.parse(readFileSync(publicFile('/manifest.json'), 'utf8')) as {
      start_url: string;
      display: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest.start_url).toBe('/now');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/task-laureate-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/icons/task-laureate-512.png', sizes: '512x512' }),
      expect.objectContaining({ src: '/icons/task-laureate-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ]));
    for (const icon of manifest.icons) expect(existsSync(publicFile(icon.src))).toBe(true);
    expect(existsSync(publicFile('/icons/apple-touch-icon-180.png'))).toBe(true);
  });

  it('uses the same infinity mark for the browser favicon and installed app', () => {
    const document = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const favicon = readFileSync(publicFile('/favicon.svg'), 'utf8');

    expect(document).toContain('href="/favicon.svg?v=2"');
    expect(favicon).toContain('M 12 32 C 12 24');
    expect(favicon).toContain('fill="#fb923c"');
  });

  it('keeps offline, push, and notification-click handling in the one root worker', () => {
    const worker = readFileSync(publicFile('/service-worker.js'), 'utf8');
    expect(worker).toContain("addEventListener('fetch'");
    expect(worker).toContain("addEventListener('push'");
    expect(worker).toContain("addEventListener('notificationclick'");
    expect(worker).toContain("!url.pathname.startsWith('/api/')");
    expect(worker).toContain("const CACHE_NAME = 'task-laureate-shell-v3'");
    expect(worker).toContain('await self.skipWaiting()');
    expect(worker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(worker).toContain('hasExpectedAssetType(request, response)');
    expect(existsSync(publicFile('/push-worker.js'))).toBe(false);
  });
});
