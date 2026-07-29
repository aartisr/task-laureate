import { useTheme } from './ThemeProvider';
import { THEME_OPTIONS } from './themes';

/**
 * Premium Theme Switcher Component
 * 
 * Elegant dropdown allowing users to switch between themes.
 * Features smooth transitions and visual feedback.
 */
export function ThemeSwitcher() {
  const { currentTheme, setTheme } = useTheme();

  return (
    <div className="theme-switcher">
      <label htmlFor="theme-select" className="block text-sm font-semibold mb-3 text-[var(--color-text-primary)]">
        Choose Your Theme
      </label>
      <select
        id="theme-select"
        value={currentTheme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="w-full px-4 py-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] focus:border-transparent transition-all duration-200 cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '20px',
          paddingRight: '40px',
        }}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.name} value={option.name}>
            {option.label} — {option.description}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
        Changes apply instantly across the entire app
      </p>
    </div>
  );
}

/**
 * Compact Theme Switcher - for headers/toolbars
 * Shows emoji + theme name with click-to-cycle interaction
 */
export function ThemeSwitcherCompact() {
  const { currentTheme, setTheme } = useTheme();
  const currentIndex = THEME_OPTIONS.findIndex((t) => t.name === currentTheme);

  const handleCycle = () => {
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    setTheme(THEME_OPTIONS[nextIndex].name);
  };

  const current = THEME_OPTIONS[currentIndex];
  const themeEmojis: Record<string, string> = {
    'dark-pro': '🌙',
    'luxury-minimal': '✨',
    'warm-community': '🔥',
  };

  return (
    <button
      onClick={handleCycle}
      title={`Click to cycle themes (currently: ${current.label})`}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-sm font-semibold text-[var(--color-text-primary)] transition-all duration-200 border border-transparent hover:border-[var(--color-border-default)]"
      aria-label={`Theme switcher. Current: ${current.label}`}
    >
      <span className="text-lg">{themeEmojis[current.name]}</span>
      <span className="hidden sm:inline">{current.label}</span>
    </button>
  );
}

/**
 * Premium Theme Preview Card
 * Beautiful visual preview of what the theme looks like
 * Includes interactive elements and smooth transitions
 */
export function ThemePreviewCard({ themeName }: { themeName: string }) {
  const { currentTheme, setTheme } = useTheme();
  const theme = THEME_OPTIONS.find((t) => t.name === themeName);

  if (!theme) return null;

  const isActive = currentTheme === themeName;
  const themeEmojis: Record<string, string> = {
    'dark-pro': '🌙',
    'luxury-minimal': '✨',
    'warm-community': '🔥',
  };

  return (
    <button
      onClick={() => setTheme(theme.name as any)}
      style={{
        position: 'relative',
        padding: 'var(--spacing-5)',
        borderRadius: 'var(--radius-xl)',
        border: '2px solid',
        borderColor: isActive ? 'var(--color-action-primary)' : 'var(--color-border-default)',
        backgroundColor: isActive ? 'var(--color-action-primary)' : 'var(--color-bg-secondary)',
        boxShadow: isActive ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
        transition: 'all var(--transition-base)',
        textAlign: 'left',
        cursor: 'pointer',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-action-primary)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-default)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)';
        }
      }}
      aria-label={`${theme.label} theme${isActive ? ' (active)' : ''}`}
      type="button"
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-3)',
        gap: 'var(--spacing-3)',
      }}>
        <div>
          <h3 style={{
            fontWeight: 'var(--font-weight-bold)',
            fontSize: '1.125rem',
            marginBottom: 'var(--spacing-1)',
            margin: '0 0 var(--spacing-1) 0',
            color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
          }}>
            {themeEmojis[themeName]} {theme.label}
          </h3>
          <p style={{
            fontSize: '0.75rem',
            color: isActive ? 'rgba(255, 255, 255, 0.8)' : 'var(--color-text-secondary)',
            margin: 0,
          }}>
            {theme.description}
          </p>
        </div>
        {isActive && (
          <div style={{ flexShrink: 0 }}>
            <svg style={{
              width: '1.5rem',
              height: '1.5rem',
              color: 'var(--color-text-inverse)',
              fill: 'currentColor',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Color swatches */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-2)',
        marginTop: 'var(--spacing-4)',
        paddingTop: 'var(--spacing-4)',
        borderTop: `1px solid ${isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-border-light)'}`,
      }}>
        <div style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '9999px',
          backgroundColor: 'var(--color-action-primary)',
        }} title="Action primary" />
        <div style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '9999px',
          backgroundColor: 'var(--color-accent-secondary)',
        }} title="Accent secondary" />
        <div style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '9999px',
          backgroundColor: 'var(--color-status-success)',
        }} title="Status success" />
        <div style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '9999px',
          backgroundColor: 'var(--color-status-warning)',
        }} title="Status warning" />
      </div>
    </button>
  );
}
