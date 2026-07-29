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
        <div style={{ paddingTop: 'var(--spacing-6)', borderTop: '1px solid var(--color-border-light)' }}>
          <Link 
            to="/settings" 
            activeProps={{ className: 'active' }}
            className="sidebar-link"
            aria-label="Settings"
            title="Settings & Theme"
          >
            ⚙️ Settings
          </Link>
        </div>
      </aside>
      <main className="workspace" role="main">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
