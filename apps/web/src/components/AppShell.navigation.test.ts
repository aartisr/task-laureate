import { describe, expect, it } from 'vitest';
import { mobilePrimaryTabConfig, resolveDesktopNavigation, resolveMobilePrimaryTabs } from './AppShell';

describe('mobile primary navigation', () => {
  it('keeps the mobile bottom bar focused on Now, My lists, Search, Capture, and More', () => {
    // QuickCapture is deliberately rendered between the first two and final
    // tab; AppShell then appends More as the fifth bottom-bar action.
    expect(mobilePrimaryTabConfig.map((item) => item.to)).toEqual(['/now', '/lists-overview', '/search']);
    expect(mobilePrimaryTabConfig.map((item) => item.displayLabel)).toEqual(['Now', 'My lists', 'Search']);
  });

  it('allows a feature to enrich a tab without allowing it to reorder the mobile information architecture', () => {
    const tabs = resolveMobilePrimaryTabs([
      { label: 'Search workspace', to: '/search', icon: 'custom-search', description: 'Find any work' },
      { label: 'All tasks', to: '/tasks', icon: '✓', description: 'Every task across your lists' },
    ]);

    expect(tabs.map((item) => item.to)).toEqual(['/now', '/lists-overview', '/search']);
    expect(tabs[2]).toMatchObject({ label: 'Search', mobileLabel: 'Search', icon: 'custom-search', description: 'Find any work' });
  });
});

describe('desktop navigation', () => {
  it('puts the default home and daily work flow before workspace management', () => {
    const navigation = resolveDesktopNavigation([]);

    expect(navigation.primary.map((item) => item.to)).toEqual(['/', '/now', '/tasks', '/search']);
    expect(navigation.organize.map((item) => item.to)).toEqual(['/lists-overview']);
    expect(navigation.review.map((item) => item.to)).toEqual(['/completed', '/activity', '/progress']);
    expect(navigation.collaborate).toEqual([]);
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

  it('keeps essential work destinations available while Focus Mode hides secondary views', () => {
    const navigation = resolveDesktopNavigation([]);
    const focusWorkspace = navigation.organize.filter((item) => item.to === '/lists-overview');
    expect(focusWorkspace.map((item) => item.to)).toEqual(['/lists-overview']);
    expect(navigation.review).toEqual([
      expect.objectContaining({ to: '/completed' }),
      expect.objectContaining({ to: '/activity' }),
      expect.objectContaining({ to: '/progress' }),
    ]);
  });
});
