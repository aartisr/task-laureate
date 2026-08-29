import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTheme } from '../core/themes/ThemeProvider';
import type { NavItem } from '../core/contracts/feature';
import { AccountStatus } from './AccountStatus';
import { NotificationCenter } from './NotificationCenter';
import { authProvider } from '../config/persistence.config';
import { recoveryNeedsAttention, undoJournal } from '../core/mutations/undoJournal';
import { QuickCapture } from './QuickCapture';
import { requestListCreation } from '../hooks/useListCreationCommand';
import { AppIcon, appIconFromLegacy } from './AppIcon';
import { useWorkspaceExperience } from '../core/preferences/workspaceExperience';
import { pruneListFavorites, useFavoriteListIds } from '../core/preferences/listFavorites';
import { sortListsForAttention } from '../core/domain/listOrdering';
import { queryKeys } from '../core/contracts/queryKeys';
import { appServices } from '../app/runtime/appServices';
import { VoiceAssistantModal } from './VoiceAssistantModal';

interface AppShellProps {
  children?: ReactNode;
  navItems: NavItem[];
}

type MobileTabDefinition = Readonly<{ to: string; fallbackLabel: string; displayLabel: string; icon: string }>;
type ResolvedMobileTab = NavItem & { mobileLabel: string };
type DesktopNavigation = Readonly<{ primary: NavItem[]; organize: NavItem[]; review: NavItem[]; collaborate: NavItem[]; utility: NavItem[] }>;

const reviewNavigationPreferenceKey = 'task-laureate.review-navigation-expanded';
const mobileBreakpointQuery = '(max-width: 48rem)';

/**
 * The bottom bar is intentionally limited to the four most frequent mobile
 * destinations. Capture occupies the center action; everything else belongs
 * behind More, where it remains available without competing for attention.
 */
export const mobilePrimaryTabConfig: readonly MobileTabDefinition[] = [
  { to: '/now', fallbackLabel: 'Now', displayLabel: 'Now', icon: '⚡' },
  { to: '/lists-overview', fallbackLabel: 'My lists', displayLabel: 'My lists', icon: '☷' },
  { to: '/search', fallbackLabel: 'Search', displayLabel: 'Search', icon: '🔍' },
];

/** Resolves optional feature-provided metadata without changing mobile IA. */
export function resolveMobilePrimaryTabs(navItems: readonly NavItem[]): ResolvedMobileTab[] {
  return mobilePrimaryTabConfig.map((tab) => {
    const existing = navItems.find((item) => item.to === tab.to);
    return {
      label: tab.fallbackLabel,
      to: tab.to,
      icon: existing?.icon ?? tab.icon,
      description: existing?.description,
      mobileLabel: tab.displayLabel,
    };
  });
}

/**
 * The sidebar follows the user's work sequence: decide what to do, organize
 * it, then reflect only when useful. It never becomes a catalogue of features.
 */
export function resolveDesktopNavigation(navItems: readonly NavItem[]): DesktopNavigation {
  const find = (to: string, fallback: NavItem) => navItems.find((item) => item.to === to) ?? fallback;

  return {
    primary: [
      { label: 'Home', to: '/', icon: '⌂', description: 'Your calm starting point' },
      find('/now', { label: 'Now', to: '/now', icon: '⚡', description: 'Choose one feasible action' }),
      { label: 'All tasks', to: '/tasks', icon: '✓', description: 'Every task across your lists' },
      find('/search', { label: 'Search', to: '/search', icon: '⌕', description: 'Find anything' }),
    ],
    organize: [
      { label: 'My lists', to: '/lists-overview', icon: '☷', description: 'Your projects and lists' },
    ],
    review: [
      { label: 'Completed', to: '/completed', icon: '✓', description: 'Work you have finished' },
      find('/activity', { label: 'Activity', to: '/activity', icon: '◌', description: 'Recent changes' }),
      { label: 'Progress', to: '/progress', icon: '◔', description: 'Reflect on momentum' },
    ],
    collaborate: navItems.some((item) => item.to === '/shared-with-me' || item.to === '/shared-by-me')
      ? [
          find('/shared-with-me', { label: 'Shared with me', to: '/shared-with-me', icon: '↗', description: 'Work shared with you' }),
          find('/shared-by-me', { label: 'Shared by me', to: '/shared-by-me', icon: '↗', description: 'Lists you share with others' }),
        ]
      : [],
    utility: [find('/settings', { label: 'Settings', to: '/settings', icon: '⚙', description: 'Preferences and privacy' })],
  };
}

function readWorkspaceNavigationPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(reviewNavigationPreferenceKey) === 'true';
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

function MobileBottomNavLink({ item }: { item: ResolvedMobileTab }) {
  return <Link
    to={item.to}
    activeOptions={item.to === '/' ? { exact: true } : undefined}
    activeProps={{ className: 'active' }}
    className="mobile-bottom-nav__link"
    aria-label={item.mobileLabel}
  >
    <span className="mobile-bottom-nav__icon" aria-hidden="true"><NavigationIcon icon={item.icon} /></span>
    <span className="mobile-bottom-nav__label">{item.mobileLabel}</span>
  </Link>;
}

function NavigationIcon({ icon }: { icon?: string }) {
  const name = appIconFromLegacy(icon);
  return name ? <AppIcon name={name} /> : <span>{icon ?? '•'}</span>;
}

export function AppShell({ children, navItems }: AppShellProps) {
  const { currentTheme } = useTheme();
  const experience = useWorkspaceExperience();
  const favoriteListIds = useFavoriteListIds();
  const favoriteListQueries = useQueries({
    queries: favoriteListIds.map((listId) => ({ queryKey: queryKeys.list(listId), queryFn: () => appServices.repository.getList(listId), staleTime: 30_000 })),
  });
  const favoriteListResolution = favoriteListQueries.map((query) => `${query.status}:${query.data?.id ?? ''}:${query.data?.status ?? ''}`).join('|');
  const navigate = useNavigate();
  const isDarkTheme = currentTheme !== 'luxury-minimal';
  const isMobileViewport = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, () => false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isReviewExpanded, setIsReviewExpanded] = useState(readWorkspaceNavigationPreference);
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const recoveryAvailable = recoveryNeedsAttention(
    useSyncExternalStore(undoJournal.subscribe, undoJournal.getSnapshot, undoJournal.getSnapshot),
  );

  useEffect(() => {
    if (favoriteListQueries.some((query) => query.isLoading || query.isError)) return;
    const visibleIds = new Set(favoriteListQueries.map((query) => query.data).filter((list) => list?.status === 'active' || list?.status === 'completed').map((list) => list!.id));
    pruneListFavorites(visibleIds);
  }, [favoriteListResolution, favoriteListIds]);

  const favoriteLists = useMemo(() => {
    return sortListsForAttention(favoriteListQueries.map((query) => query.data).filter((list): list is NonNullable<typeof list> => Boolean(list && (list.status === 'active' || list.status === 'completed'))));
  }, [favoriteListResolution]);

  const mobileNavItems = useMemo(() => [
    { label: 'Now', to: '/now', icon: '⚡', description: 'Choose one feasible action' },
    { label: 'All tasks', to: '/tasks', icon: '✓', description: 'Every task across your lists' },
    { label: 'Search', to: '/search', icon: '⌕', description: 'Find anything' },
    { label: 'Progress', to: '/progress', icon: '◔', description: 'Reflect on momentum' },
    { label: 'Dashboard', to: '/', icon: '⌂', description: 'Workspace overview' },
    { label: 'My lists', to: '/lists-overview', icon: '☷', description: 'Your projects and lists' },
    { label: 'Completed', to: '/completed', icon: '✓', description: 'Work you have finished' },
    ...navItems,
    { label: 'Help & Support', to: '/support', icon: '?', description: 'Help center' },
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.to === item.to) === index), [navItems]);

  const desktopNavigation = useMemo(() => {
    const navigation = resolveDesktopNavigation(navItems);
    return experience === 'focus'
      ? { ...navigation, review: [], collaborate: [] }
      : navigation;
  }, [experience, navItems]);

  const currentSection = useMemo(
    () =>
      mobileNavItems.find((item) =>
        item.to === '/'
          ? currentPath === '/'
          : currentPath === item.to || currentPath.startsWith(`${item.to}/`),
      ) ?? mobileNavItems[0],
    [currentPath, mobileNavItems],
  );

  const mobilePrimaryTabs = useMemo(() => resolveMobilePrimaryTabs(mobileNavItems), [mobileNavItems]);

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
  const reviewNavigationIsActive = desktopNavigation.review.some((item) => item.to === '/' ? currentPath === '/' : currentPath === item.to || currentPath.startsWith(`${item.to}/`));
  useEffect(() => {
    const handleOpenVoice = () => setIsVoiceAssistantOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceAssistantOpen(true);
      }
    };
    window.addEventListener('open-voice-assistant', handleOpenVoice);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-voice-assistant', handleOpenVoice);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (reviewNavigationIsActive) setIsReviewExpanded(true);
  }, [reviewNavigationIsActive]);

  const reviewNavigationExpanded = isReviewExpanded;
  const toggleReviewNavigation = () => {
    const next = !reviewNavigationExpanded;
    setIsReviewExpanded(next);
    window.localStorage.setItem(reviewNavigationPreferenceKey, String(next));
  };

  // A button is intentional here. A route string containing a query parameter
  // can be treated differently by router versions, which previously made this
  // high-value action look inert. The durable command is issued first, then we
  // navigate to its one canonical destination.
  const beginListCreation = () => {
    requestListCreation();
    void navigate({ to: '/' });
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
          <button
            type="button"
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="mobile-menu-toggle"
            aria-label="Voice Assistant"
            title="Voice Assistant"
            style={{ marginRight: '6px', background: '#4f46e5', color: '#fff', border: 'none' }}
          >
            🎙️ Voice
          </button>
          <NotificationCenter />
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-panel"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span className="mobile-menu-toggle__icon" aria-hidden="true">
              <AppIcon name="menu" />
            </span>
            Menu
          </button>
        </div>
      </header>
      <aside className="sidebar" aria-label="Navigation">
        <Link to="/" className="brand-mark" aria-label="Go to Dashboard">
          <img src="/.well-known/logo-small.svg" alt="" aria-hidden="true" />
          <span>Task Laureate</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <button type="button" className="sidebar-link sidebar-link--create" aria-label="Create a new List" title="Create a new List (⌘N / Ctrl+N)" onClick={beginListCreation}>
            <span className="sidebar-link__create-icon" aria-hidden="true"><AppIcon name="plus" /></span> New List
          </button>
          <p className="sidebar-nav__label">Do next</p>
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
                <NavigationIcon icon={item.icon} /> <span>{item.label}</span>
                {hasRecovery ? <span className="sidebar-link__badge sidebar-link__badge--attention">Review</span> : null}
              </Link>
            );
          })}
          {favoriteLists.length > 0 && <div className="sidebar-nav__extensions sidebar-nav__extensions--favorites">
            <p className="sidebar-nav__label">Favorites</p>
            {favoriteLists.map((list) => <Link key={list.id} to="/lists/$listId" params={{ listId: list.id }} activeProps={{ className: 'active' }} className={`sidebar-link sidebar-link--favorite${list.status === 'completed' ? ' sidebar-link--favorite-completed' : ''}`} aria-label={`${list.title}${list.status === 'completed' ? ', completed' : ''}`}><NavigationIcon icon="★" /> <span>{list.title}</span>{list.status === 'completed' ? <small>Done</small> : null}</Link>)}
          </div>}
          <div className="sidebar-nav__extensions">
            <p className="sidebar-nav__label">Organize</p>
            {desktopNavigation.organize.map((item) => (
              <Link key={item.to} to={item.to} activeOptions={getLinkActiveOptions(item.to)} activeProps={{ className: 'active' }} className="sidebar-link" aria-label={item.label}><NavigationIcon icon={item.icon} /> <span>{item.label}</span></Link>
            ))}
          </div>
          {desktopNavigation.review.length > 0 && <div className="sidebar-nav__extensions">
            <button type="button" className="sidebar-nav__section-toggle" aria-expanded={reviewNavigationExpanded} aria-controls="review-navigation-items" onClick={toggleReviewNavigation}>
              <span><span className="sidebar-nav__section-label">Review &amp; history</span><small>{reviewNavigationExpanded ? 'Hide' : 'Completed work and insights'}</small></span><span className="sidebar-nav__section-chevron" aria-hidden="true"><AppIcon name="chevron-down" /></span>
            </button>
            <div id="review-navigation-items" className="sidebar-nav__section-items" hidden={!reviewNavigationExpanded}>
              {desktopNavigation.review.map((item) => (
                <Link key={item.to} to={item.to} activeOptions={getLinkActiveOptions(item.to)} activeProps={{ className: 'active' }} className="sidebar-link" aria-label={item.label}><NavigationIcon icon={item.icon} /> <span>{item.label}</span></Link>
              ))}
            </div>
          </div>}
          {desktopNavigation.collaborate.length > 0 && <div className="sidebar-nav__extensions">
            <p className="sidebar-nav__label">Collaborate</p>
            {desktopNavigation.collaborate.map((item) => <Link key={item.to} to={item.to} activeOptions={getLinkActiveOptions(item.to)} activeProps={{ className: 'active' }} className="sidebar-link" aria-label={item.label}><NavigationIcon icon={item.icon} /> <span>{item.label}</span></Link>)}
          </div>}
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
                  <NavigationIcon icon={item.icon} /> <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="sidebar-spacer" />

        {/* ===== UTILITY SECTION ===== */}
        <div className="sidebar-footer">

          {!isMobileViewport ? <QuickCapture /> : null}

          {/* Voice Assistant button */}
          <button
            type="button"
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="sidebar-link"
            style={{ background: '#4f46e5', color: '#fff', borderRadius: '12px', justifyContent: 'center', marginBottom: '8px' }}
            aria-label="Voice Assistant"
          >
            <span>🎙️</span> <span>Voice Assistant</span>
          </button>

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
            <span className="sidebar-link__icon"><AppIcon name="help" /></span>
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
              <AppIcon name="close" />
            </button>
          </div>

          <div className="mobile-navigation__items">
            <button type="button" className="mobile-navigation__link mobile-navigation__link--create" onClick={() => { beginListCreation(); setIsMobileMenuOpen(false); }}>
              <span className="mobile-navigation__icon" aria-hidden="true"><AppIcon name="plus" /></span>
              <span className="mobile-navigation__text"><strong>New List</strong><small>Name it now; add tasks next.</small></span>
            </button>
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
                  <NavigationIcon icon={item.icon} />
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
                      <NavigationIcon icon={item.icon} />
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
        {mobilePrimaryTabs.slice(0, 2).map((item) => <MobileBottomNavLink key={item.to} item={item} />)}
        {isMobileViewport ? <QuickCapture triggerVariant="mobile" /> : null}
        {mobilePrimaryTabs.slice(2).map((item) => <MobileBottomNavLink key={item.to} item={item} />)}
        <button
          type="button"
          className={`mobile-bottom-nav__link mobile-bottom-nav__button ${isMobileMenuOpen ? 'active' : ''}`}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-panel"
          aria-label="Open more navigation options"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true"><AppIcon name="menu" /></span>
          <span className="mobile-bottom-nav__label">More</span>
        </button>
      </nav>
      <VoiceAssistantModal isOpen={isVoiceAssistantOpen} onClose={() => setIsVoiceAssistantOpen(false)} />
    </div>
  );
}
