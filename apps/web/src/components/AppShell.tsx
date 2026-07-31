import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useTheme } from '../core/themes/ThemeProvider';
import type { NavItem } from '../core/contracts/feature';
import { UndoCenter } from './UndoCenter';

interface AppShellProps {
  children?: ReactNode;
  navItems: NavItem[];
}

export function AppShell({ children, navItems }: AppShellProps) {
  const { currentTheme } = useTheme();
  const isDarkTheme = currentTheme !== 'luxury-minimal';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  const mobileNavItems = useMemo(
    () =>
      [
        { label: 'Dashboard', to: '/', icon: '📊', description: 'Overview' },
        ...navItems,
        { label: 'Help & Support', to: '/support', icon: '💡', description: 'Help center' },
      ].filter((item, index, items) => items.findIndex((candidate) => candidate.to === item.to) === index),
    [navItems],
  );

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
      { to: '/', fallbackLabel: 'Home', displayLabel: 'Home', icon: '🏠' },
      { to: '/tasks', fallbackLabel: 'Tasks', displayLabel: 'Tasks', icon: '✓' },
      { to: '/search', fallbackLabel: 'Search', displayLabel: 'Search', icon: '🔍' },
      { to: '/settings', fallbackLabel: 'Settings', displayLabel: 'Settings', icon: '⚙️' },
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

  return (
    <div className={`app-shell ${shellThemeClass}`}>
      <header className="mobile-topbar" aria-label="Mobile navigation">
        <div className="mobile-topbar__brand">
          <span>Task-Laureate</span>
          <small>Now viewing: {currentSection?.label ?? 'Dashboard'}</small>
        </div>
        <div className="mobile-topbar__actions">
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
        <div className="brand-mark" title="Task-Laureate - Premium task management">
          <span>Task-Laureate</span>
          <small>Premium Tasks</small>
        </div>
        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <Link
            to="/"
            activeOptions={getLinkActiveOptions('/')}
            activeProps={{ className: 'active' }}
            className="sidebar-link"
            aria-label="Dashboard"
          >
            📊 Dashboard
          </Link>
          {navItems.map((item) => (
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
        </nav>
        <div className="sidebar-spacer" />

        {/* ===== UTILITY SECTION ===== */}
        <div className="sidebar-footer">

          {/* Divider with label */}
          <div className="sidebar-footer__divider">
            <span>Workspace</span>
          </div>

          {/* Support — highlighted, stands out */}
          <Link
            to="/support"
            activeOptions={getLinkActiveOptions('/support')}
            activeProps={{ className: 'active' }}
            className="sidebar-link sidebar-link--support"
            aria-label="Help & Support"
          >
            <span className="sidebar-link__icon">💡</span>
            <span className="sidebar-link__label">Help & Support</span>
            <span className="sidebar-link__badge">FAQs</span>
          </Link>

          {/* Creator attribution */}
          <div className="sidebar-credit">
            <a href="https://ai-aarti.com" target="_blank" rel="noopener noreferrer" className="sidebar-credit__name">
              Aarti S Ravikumar
            </a>
            <a href="https://saugus.pioneercss.org" target="_blank" rel="noopener noreferrer" className="sidebar-credit__school">
              PCSSII
            </a>
          </div>

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
            {mobilePrimaryTabs.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={getLinkActiveOptions(item.to)}
                activeProps={{ className: 'active' }}
                className="mobile-navigation__link"
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
      <main className="workspace" role="main">
        {children ?? <Outlet />}
      </main>
      <UndoCenter />
      <nav className="mobile-bottom-nav" aria-label="Quick Navigation">
        {mobilePrimaryTabs.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={getLinkActiveOptions(item.to)}
            activeProps={{ className: 'active' }}
            className="mobile-bottom-nav__link"
            aria-label={item.mobileLabel ?? item.label}
          >
            <span className="mobile-bottom-nav__icon" aria-hidden="true">
              {item.icon ?? '•'}
            </span>
            <span className="mobile-bottom-nav__label">{item.mobileLabel ?? item.label}</span>
          </Link>
        ))}
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
