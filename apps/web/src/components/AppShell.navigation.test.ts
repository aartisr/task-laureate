import { describe, expect, it } from 'vitest';
import { mobilePrimaryTabConfig, resolveDesktopNavigation, resolveMobilePrimaryTabs } from './AppShell';

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

describe('desktop navigation', () => {
  it('puts the default home and daily work flow before workspace management', () => {
    const navigation = resolveDesktopNavigation([]);

    expect(navigation.primary.map((item) => item.to)).toEqual(['/', '/now', '/tasks', '/search']);
    expect(navigation.workspace.map((item) => item.to)).toEqual(['/lists-overview', '/shared-with-me', '/activity', '/progress']);
  });

  it('allows feature metadata without changing the core journey', () => {
    const navigation = resolveDesktopNavigation([
      { label: 'Find workspace', to: '/search', icon: 'custom-search', description: 'Find any work' },
      { label: 'My moment', to: '/now', icon: 'custom-now', description: 'One next action' },
    ]);

    expect(navigation.primary.map((item) => item.to)).toEqual(['/', '/now', '/tasks', '/search']);
    expect(navigation.primary[1]).toMatchObject({ label: 'My moment', icon: 'custom-now' });
    expect(navigation.primary[3]).toMatchObject({ label: 'Find workspace', icon: 'custom-search' });
  });
});
