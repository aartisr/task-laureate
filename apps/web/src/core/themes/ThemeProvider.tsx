import { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeName } from '../themes/themes';
import { THEMES, THEME_OPTIONS } from '../themes/themes';

interface ThemeContextType {
  currentTheme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: typeof THEME_OPTIONS;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentThemeState] = useState<ThemeName>(() => {
    // Get theme from localStorage or default to sleek-interface
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('laureate-theme');
      return (saved as ThemeName) || 'sleek-interface';
    }
    return 'sleek-interface';
  });

  const setTheme = (theme: ThemeName) => {
    setCurrentThemeState(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('laureate-theme', theme);
    }
    applyTheme(theme);
  };

  const isDark = currentTheme === 'dark-pro';

  // Apply theme to document on mount and change
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: THEME_OPTIONS, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * Apply theme by setting CSS variables on document root
 */
function applyTheme(themeName: ThemeName) {
  const theme = THEMES[themeName];
  const root = document.documentElement;
  const isDarkTheme = themeName === 'dark-pro';
  root.style.colorScheme = isDarkTheme ? 'dark' : 'light';
  // Decorative layers can adapt without coupling individual pages to a theme.
  root.dataset.theme = themeName;

  // Background colors
  root.style.setProperty('--color-bg-primary', theme.colors.bg.primary);
  root.style.setProperty('--color-bg-secondary', theme.colors.bg.secondary);
  root.style.setProperty('--color-bg-tertiary', theme.colors.bg.tertiary);
  root.style.setProperty('--color-bg-surface', theme.colors.bg.surface);
  root.style.setProperty('--color-bg-overlay', theme.colors.bg.overlay);

  // Text colors
  root.style.setProperty('--color-text-primary', theme.colors.text.primary);
  root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
  root.style.setProperty('--color-text-tertiary', theme.colors.text.tertiary);
  root.style.setProperty('--color-text-inverse', theme.colors.text.inverse);
  root.style.setProperty('--color-text-on-action', theme.colors.text.onAction);

  // Action colors
  root.style.setProperty('--color-action-primary', theme.colors.action.primary);
  root.style.setProperty('--color-action-secondary', theme.colors.action.secondary);
  root.style.setProperty('--color-action-hover', theme.colors.action.hover);
  root.style.setProperty('--color-action-active', theme.colors.action.active);
  root.style.setProperty('--color-action-disabled', theme.colors.action.disabled);

  // Neutral controls use their own tested foreground/surface pairing.
  root.style.setProperty('--control-quiet-bg', theme.colors.control.quiet.background);
  root.style.setProperty('--control-quiet-fg', theme.colors.control.quiet.foreground);
  root.style.setProperty('--control-quiet-border', theme.colors.control.quiet.border);
  root.style.setProperty('--control-quiet-hover-bg', theme.colors.control.quiet.hoverBackground);

  // Status colors
  root.style.setProperty('--color-status-success', theme.colors.status.success);
  root.style.setProperty('--color-status-warning', theme.colors.status.warning);
  root.style.setProperty('--color-status-error', theme.colors.status.error);
  root.style.setProperty('--color-status-info', theme.colors.status.info);

  // Border colors
  root.style.setProperty('--color-border-default', theme.colors.border.default);
  root.style.setProperty('--color-border-light', theme.colors.border.light);
  root.style.setProperty('--color-border-dark', theme.colors.border.dark);

  // Accent colors
  root.style.setProperty('--color-accent-primary', theme.colors.accent.primary);
  root.style.setProperty('--color-accent-secondary', theme.colors.accent.secondary);
  root.style.setProperty('--color-accent-tertiary', theme.colors.accent.tertiary);

  // Typography
  root.style.setProperty('--font-family-sans', theme.typography.fontFamily.sans);
  root.style.setProperty('--font-family-mono', theme.typography.fontFamily.mono);
  root.style.setProperty('--typography-scale', `${theme.typography.scale}`);

  // Spacing
  root.style.setProperty('--spacing-scale', `${theme.spacing.scale}`);

  // Border radius
  root.style.setProperty('--border-radius-scale', `${theme.borderRadius.scale}`);

  // Shadows
  root.style.setProperty('--shadow-sm', theme.shadows.sm);
  root.style.setProperty('--shadow-md', theme.shadows.md);
  root.style.setProperty('--shadow-lg', theme.shadows.lg);

  // Update Tailwind's color scheme if needed
  root.classList.toggle('dark', isDarkTheme);
}
