import type { ReactNode } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useTheme } from '../core/themes/ThemeProvider';
import type { NavItem } from '../core/contracts/feature';

interface AppShellProps {
  children?: ReactNode;
  navItems: NavItem[];
}

export function AppShell({ children, navItems }: AppShellProps) {
  const { currentTheme } = useTheme();
  const isDarkTheme = currentTheme !== 'luxury-minimal';

  return (
    <div className="app-shell" style={{ colorScheme: isDarkTheme ? 'dark' : 'light' }}>
      <aside className="sidebar" aria-label="Navigation">
        <div className="brand-mark" title="Task-Laureate - Premium task management">
          <span>Task-Laureate</span>
          <small>Premium Tasks</small>
        </div>
        <nav className="sidebar-nav" aria-label="Primary Navigation">
          <Link 
            to="/" 
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
              activeProps={{ className: 'active' }}
              className="sidebar-link"
              aria-label={item.label}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />

        {/* ===== UTILITY SECTION ===== */}
        <div className="sidebar-footer">

          {/* Divider with label */}
          <div className="sidebar-footer__divider">
            <span>Workspace</span>
          </div>

          {/* Support — highlighted, stands out */}
          <Link
            to="/support"
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
      <main className="workspace" role="main">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
