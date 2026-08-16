import { describe, expect, it } from 'vitest';
import { mobilePrimaryTabConfig, resolveMobilePrimaryTabs } from './AppShell';

describe('mobile primary navigation', () => {
  it('keeps the mobile bottom bar focused on Dashboard, Now, Capture, Search, and More', () => {
    // QuickCapture is deliberately rendered between the first two and final
    // tab; AppShell then appends More as the fifth bottom-bar action.
    expect(mobilePrimaryTabConfig.map((item) => item.to)).toEqual(['/', '/now', '/search']);
    expect(mobilePrimaryTabConfig.map((item) => item.displayLabel)).toEqual(['Dashboard', 'Now', 'Search']);
    expect(mobilePrimaryTabConfig.some((item) => item.to === '/tasks')).toBe(false);
  });

  it('allows a feature to enrich a tab without allowing it to reorder the mobile information architecture', () => {
    const tabs = resolveMobilePrimaryTabs([
      { label: 'Search workspace', to: '/search', icon: 'custom-search', description: 'Find any work' },
      { label: 'Tasks', to: '/tasks', icon: '✓', description: 'All active work' },
    ]);

    expect(tabs.map((item) => item.to)).toEqual(['/', '/now', '/search']);
    expect(tabs[2]).toMatchObject({ label: 'Search', mobileLabel: 'Search', icon: 'custom-search', description: 'Find any work' });
  });
});
