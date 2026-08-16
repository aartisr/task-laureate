import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useTheme } from '../core/themes/ThemeProvider';
import type { NavItem } from '../core/contracts/feature';
import { AccountStatus } from './AccountStatus';
import { NotificationCenter } from './NotificationCenter';
import { authProvider } from '../config/persistence.config';
import { recoveryNeedsAttention, undoJournal } from '../core/mutations/undoJournal';
import { QuickCapture } from './QuickCapture';
import { requestListCreation } from '../hooks/useListCreationCommand';

interface AppShellProps {
  children?: ReactNode;
  navItems: NavItem[];
}

const workspaceNavigationPreferenceKey = 'task-laureate.workspace-navigation-expanded';
const mobileBreakpointQuery = '(max-width: 48rem)';

function readWorkspaceNavigationPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(workspaceNavigationPreferenceKey) === 'true';
}

function subscribeToMobileViewport(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const mediaQuery = window.matchMedia(mobileBreakpointQuery);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getMobileViewportSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia(mobileBreakpointQuery).matches;
}

export function AppShell({ children, navItems }: AppShellProps) {
  const { currentTheme } = useTheme();
  const isDarkTheme = currentTheme !== 'luxury-minimal';
  const isMobileViewport = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, () => false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(readWorkspaceNavigationPreference);
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const recoveryAvailable = recoveryNeedsAttention(
    useSyncExternalStore(undoJournal.subscribe, undoJournal.getSnapshot, undoJournal.getSnapshot),
  );

  const mobileNavItems = useMemo(() => [
    { label: 'Now', to: '/now', icon: '⚡', description: 'Choose one feasible action' },
    { label: 'Tasks', to: '/tasks', icon: '✓', description: 'All active work' },
    { label: 'Search', to: '/search', icon: '⌕', description: 'Find anything' },
    { label: 'Progress', to: '/progress', icon: '◔', description: 'Reflect on momentum' },
    { label: 'Dashboard', to: '/', icon: '⌂', description: 'Workspace overview' },
    { label: 'Lists', to: '/lists-overview', icon: '☷', description: 'Projects and lists' },
    ...navItems,
    { label: 'Help & Support', to: '/support', icon: '?', description: 'Help center' },
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.to === item.to) === index), [navItems]);

  const desktopNavigation = useMemo(() => {
    const find = (to: string, fallback: NavItem) => navItems.find((item) => item.to === to) ?? fallback;
    const primary = [
      find('/now', { label: 'Now', to: '/now', icon: '⚡', description: 'Choose one feasible action' }),
      { label: 'Tasks', to: '/tasks', icon: '✓', description: 'All active work' },
      find('/search', { label: 'Search', to: '/search', icon: '⌕', description: 'Find anything' }),
      { label: 'Progress', to: '/progress', icon: '◔', description: 'Reflect on momentum' },
    ];
    const workspace = [{ label: 'Dashboard', to: '/', icon: '⌂', description: 'Workspace overview' }, { label: 'Lists', to: '/lists-overview', icon: '☷', description: 'Projects and lists' }, find('/shared-with-me', { label: 'Shared with me', to: '/shared-with-me', icon: '↗', description: 'Work shared with you' }), find('/activity', { label: 'Activity', to: '/activity', icon: '◌', description: 'Recent changes' })];
    const utility = [find('/settings', { label: 'Settings', to: '/settings', icon: '⚙', description: 'Preferences and privacy' })];
    return { primary, workspace, utility };
  }, [navItems]);

  const currentSection = useMemo(
    () =>
      mobileNavItems.find((item) =>
        item.to === '/'
          ? currentPath === '/'
          : currentPath === item.to || currentPath.startsWith(`${item.to}/`),
      ) ?? mobileNavItems[0],
    [currentPath, mobileNavItems],
  );

  const mobileTabConfig = useMemo(
    () => [
      { to: '/now', fallbackLabel: 'Now', displayLabel: 'Now', icon: '⚡' },
      { to: '/tasks', fallbackLabel: 'Tasks', displayLabel: 'Tasks', icon: '✓' },
      { to: '/search', fallbackLabel: 'Search', displayLabel: 'Search', icon: '🔍' },
    ],
    [],
  );

  const mobilePrimaryTabs = useMemo(() => {
    return mobileTabConfig.map((tab) => {
      const existing = mobileNavItems.find((item) => item.to === tab.to);
      return {
        label: tab.fallbackLabel,
        to: tab.to,
        icon: existing?.icon ?? tab.icon,
        description: existing?.description,
        mobileLabel: tab.displayLabel,
      };
    });
  }, [mobileNavItems, mobileTabConfig]);

  const mobileSecondaryItems = useMemo(
    () => mobileNavItems.filter((item) => !mobilePrimaryTabs.some((tab) => tab.to === item.to)),
    [mobileNavItems, mobilePrimaryTabs],
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const shellThemeClass = isDarkTheme ? 'app-shell--dark' : 'app-shell--light';
  const getLinkActiveOptions = (to: string) => (to === '/' ? { exact: true } : undefined);
  const workspaceNavigationIsActive = desktopNavigation.workspace.some((item) => item.to === '/' ? currentPath === '/' : currentPath === item.to || currentPath.startsWith(`${item.to}/`));
  useEffect(() => {
    if (workspaceNavigationIsActive) setIsWorkspaceExpanded(true);
  }, [workspaceNavigationIsActive]);

  const workspaceNavigationExpanded = isWorkspaceExpanded;
  const toggleWorkspaceNavigation = () => {
    const next = !workspaceNavigationExpanded;
    setIsWorkspaceExpanded(next);
    window.localStorage.setItem(workspaceNavigationPreferenceKey, String(next));
  };

  return (
    <div className={`app-shell ${shellThemeClass}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="mobile-topbar" aria-label="Mobile navigation">
        <div className="mobile-topbar__brand">
          <span>Task Laureate</span>
          <small>Now viewing: {currentSection?.label ?? 'Dashboard'}</small>
        </div>
        <div className="mobile-topbar__actions">
          <NotificationCenter />
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-panel"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span className="mobile-menu-toggle__icon" aria-hidden="true">
              ☰
            </span>
            Menu
          </button>
        </div>
      </header>
      <aside className="sidebar" aria-label="Navigation">
        <div className="brand-mark" aria-label="Task Laureate">
          <img src="/.well-known/logo-small.svg" alt="" aria-hidden="true" />
          <span>Task Laureate</span>
        </div>
        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <Link to="/?newList=1" className="sidebar-link sidebar-link--create" aria-label="Create a new List" onClick={requestListCreation}>
            <span className="sidebar-link__create-icon" aria-hidden="true">＋</span> New List
          </Link>
          <p className="sidebar-nav__label">Focus</p>
          {desktopNavigation.primary.map((item) => {
            const hasRecovery = item.to === '/settings' && recoveryAvailable;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={getLinkActiveOptions(item.to)}
                activeProps={{ className: 'active' }}
                className="sidebar-link"
                aria-label={hasRecovery ? 'Settings — recent changes available' : item.label}
              >
                {item.icon} {item.label}
                {hasRecovery ? <span className="sidebar-link__badge sidebar-link__badge--attention">Review</span> : null}
              </Link>
            );
          })}
          <div className="sidebar-nav__extensions">
            <button type="button" className="sidebar-nav__section-toggle" aria-expanded={workspaceNavigationExpanded} aria-controls="workspace-navigation-items" onClick={toggleWorkspaceNavigation}>
              <span><span className="sidebar-nav__section-label">Workspace</span><small>{workspaceNavigationExpanded ? 'Hide less-used views' : `${desktopNavigation.workspace.length} views`}</small></span><span className="sidebar-nav__section-chevron" aria-hidden="true">⌄</span>
            </button>
            <div id="workspace-navigation-items" className="sidebar-nav__section-items" hidden={!workspaceNavigationExpanded}>
              {desktopNavigation.workspace.map((item) => (
                <Link key={item.to} to={item.to} activeOptions={getLinkActiveOptions(item.to)} activeProps={{ className: 'active' }} className="sidebar-link" aria-label={item.label}>{item.icon} {item.label}</Link>
              ))}
            </div>
          </div>
          {desktopNavigation.utility.length > 0 && (
            <div className="sidebar-nav__extensions">
              <p className="sidebar-nav__label">Manage</p>
              {desktopNavigation.utility.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={getLinkActiveOptions(item.to)}
                  activeProps={{ className: 'active' }}
                  className="sidebar-link"
                  aria-label={item.label}
                >
                  {item.icon} {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="sidebar-spacer" />

        {/* ===== UTILITY SECTION ===== */}
        <div className="sidebar-footer">

          {!isMobileViewport ? <QuickCapture /> : null}

          <div className="sidebar-footer__divider">
            <span>Support</span>
          </div>

          {/* Support — highlighted, stands out */}
          <Link
            to="/support"
            activeOptions={getLinkActiveOptions('/support')}
            activeProps={{ className: 'active' }}
            className="sidebar-link sidebar-link--support"
            aria-label="Help & Support"
          >
            <span className="sidebar-link__icon">?</span>
            <span className="sidebar-link__label">Help & Support</span>
            <span className="sidebar-link__badge">FAQs</span>
          </Link>
          <AccountStatus provider={authProvider} />
          <NotificationCenter />

        </div>
      </aside>
      <div
        className={`mobile-navigation ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          type="button"
          className="mobile-navigation__backdrop"
          aria-label="Close navigation"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <nav
          id="mobile-navigation-panel"
          className="mobile-navigation__panel"
          aria-label="Primary Navigation"
        >
          <div className="mobile-navigation__header">
            <div>
              <p className="mobile-navigation__eyebrow">Quick access</p>
              <h2>Navigate the app</h2>
            </div>
            <button
              type="button"
              className="mobile-navigation__close"
              aria-label="Close menu"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="mobile-navigation__items">
            <Link to="/?newList=1" className="mobile-navigation__link mobile-navigation__link--create" onClick={() => { requestListCreation(); setIsMobileMenuOpen(false); }}>
              <span className="mobile-navigation__icon" aria-hidden="true">＋</span>
              <span className="mobile-navigation__text"><strong>New List</strong><small>Name it now; add tasks next.</small></span>
            </Link>
            <AccountStatus provider={authProvider} onNavigate={() => setIsMobileMenuOpen(false)} />
            <NotificationCenter onNavigate={() => setIsMobileMenuOpen(false)} />
            {mobilePrimaryTabs.map((item) => {
              const hasRecovery = item.to === '/settings' && recoveryAvailable;
              return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={getLinkActiveOptions(item.to)}
                activeProps={{ className: 'active' }}
                className="mobile-navigation__link"
                aria-label={hasRecovery ? 'Settings — recent changes available' : item.label}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="mobile-navigation__icon" aria-hidden="true">
                  {item.icon ?? '•'}
                </span>
                <span className="mobile-navigation__text">
                  <strong>{item.label}</strong>
                  <small>{item.description ?? 'Open section'}</small>
                </span>
                {hasRecovery ? <span className="mobile-navigation__attention">Review</span> : null}
              </Link>
              );
            })}
          </div>
          {mobileSecondaryItems.length > 0 ? (
            <div className="mobile-navigation__secondary">
              <p className="mobile-navigation__subheading">More destinations</p>
              <div className="mobile-navigation__items">
                {mobileSecondaryItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={getLinkActiveOptions(item.to)}
                    activeProps={{ className: 'active' }}
                    className="mobile-navigation__link mobile-navigation__link--secondary"
                    aria-label={item.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="mobile-navigation__icon" aria-hidden="true">
                      {item.icon ?? '•'}
                    </span>
                    <span className="mobile-navigation__text">
                      <strong>{item.label}</strong>
                      <small>{item.description ?? 'Open section'}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </nav>
      </div>
      <main id="main-content" className="workspace" tabIndex={-1}>
        {children ?? <Outlet />}
      </main>
      <nav className="mobile-bottom-nav" aria-label="Quick Navigation">
        {mobilePrimaryTabs.slice(0, 2).map((item) => {
          const hasRecovery = item.to === '/settings' && recoveryAvailable;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={getLinkActiveOptions(item.to)}
              activeProps={{ className: 'active' }}
              className="mobile-bottom-nav__link"
              aria-label={hasRecovery ? 'Settings — recent changes available' : item.mobileLabel ?? item.label}
            >
              <span className="mobile-bottom-nav__icon" aria-hidden="true">
                {item.icon ?? '•'}
              </span>
              <span className="mobile-bottom-nav__label">{item.mobileLabel ?? item.label}</span>
              {hasRecovery ? <span className="mobile-bottom-nav__attention" aria-hidden="true" /> : null}
            </Link>
          );
        })}
        {isMobileViewport ? <QuickCapture triggerVariant="mobile" /> : null}
        {mobilePrimaryTabs.slice(2).map((item) => {
          const hasRecovery = item.to === '/settings' && recoveryAvailable;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={getLinkActiveOptions(item.to)}
              activeProps={{ className: 'active' }}
              className="mobile-bottom-nav__link"
              aria-label={hasRecovery ? 'Settings — recent changes available' : item.mobileLabel ?? item.label}
            >
              <span className="mobile-bottom-nav__icon" aria-hidden="true">
                {item.icon ?? '•'}
              </span>
              <span className="mobile-bottom-nav__label">{item.mobileLabel ?? item.label}</span>
              {hasRecovery ? <span className="mobile-bottom-nav__attention" aria-hidden="true" /> : null}
            </Link>
          );
        })}
        <button
          type="button"
          className={`mobile-bottom-nav__link mobile-bottom-nav__button ${isMobileMenuOpen ? 'active' : ''}`}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-panel"
          aria-label="Open more navigation options"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true">☰</span>
          <span className="mobile-bottom-nav__label">More</span>
        </button>
      </nav>
    </div>
  );
}
