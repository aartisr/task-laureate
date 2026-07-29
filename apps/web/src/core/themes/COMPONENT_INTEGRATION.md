# Component Theme Integration Guide

This guide shows how to apply the Laureate theme system to your components.

## Quick Reference: CSS Variable Names

### Colors
```css
/* Backgrounds */
--color-bg-primary       /* Main app background */
--color-bg-secondary     /* Cards, panels */
--color-bg-tertiary      /* Nested sections */
--color-bg-surface       /* Modals, dropdowns */
--color-bg-overlay       /* Overlays, dimming */

/* Text */
--color-text-primary     /* Main text */
--color-text-secondary   /* Secondary text, labels */
--color-text-tertiary    /* Hints, placeholders */
--color-text-inverse     /* Text on colored backgrounds */

/* Interactive Elements */
--color-action-primary   /* Main buttons, links */
--color-action-secondary /* Secondary buttons */
--color-action-hover     /* Hover state */
--color-action-active    /* Pressed state */
--color-action-disabled  /* Disabled state */

/* Status */
--color-status-success   /* Success, green */
--color-status-warning   /* Warning, yellow */
--color-status-error     /* Error, red */
--color-status-info      /* Info, blue */

/* Borders */
--color-border-default   /* Standard borders */
--color-border-light     /* Subtle borders */
--color-border-dark      /* Prominent borders */

/* Accents */
--color-accent-primary   /* Theme primary accent */
--color-accent-secondary /* Secondary accent */
--color-accent-tertiary  /* Tertiary accent */
```

### Typography, Spacing, etc.
```css
--font-family-sans       /* Primary font */
--font-family-mono       /* Monospace font */
--typography-scale       /* 0.8 to 1.2 multiplier */
--spacing-scale          /* 0.8 to 1.2 multiplier */
--border-radius-scale    /* 0.8 to 1.2 multiplier */
--shadow-sm, --shadow-md, --shadow-lg
```

---

## Pattern 1: Basic Component Styling

### Before (Hardcoded colors)
```tsx
export function TaskItem({ task }: Props) {
  return (
    <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
      <h3 className="text-white font-semibold">{task.title}</h3>
      <p className="text-gray-400 text-sm">{task.description}</p>
      <button className="mt-2 px-3 py-1 bg-purple-600 text-white rounded">
        Complete
      </button>
    </div>
  );
}
```

### After (Theme variables)
```tsx
export function TaskItem({ task }: Props) {
  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h3 className="text-[var(--color-text-primary)] font-semibold">{task.title}</h3>
      <p className="text-[var(--color-text-secondary)] text-sm">{task.description}</p>
      <button className="mt-2 px-3 py-1 bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] rounded">
        Complete
      </button>
    </div>
  );
}
```

---

## Pattern 2: Interactive States

### Using inline styles for dynamic states
```tsx
function TaskCard({ task, isHovered }: Props) {
  return (
    <div
      style={{
        backgroundColor: isHovered 
          ? 'var(--color-bg-tertiary)' 
          : 'var(--color-bg-secondary)',
        borderColor: isHovered 
          ? 'var(--color-border-dark)' 
          : 'var(--color-border-default)',
      }}
      className="transition-colors p-4 border rounded-lg"
    >
      {/* Content */}
    </div>
  );
}
```

### Using CSS classes with state
```tsx
function TaskCard({ task, isSelected }: Props) {
  return (
    <div 
      className={`p-4 border rounded-lg transition-all ${
        isSelected 
          ? 'border-[var(--color-action-primary)] bg-[var(--color-bg-tertiary)]' 
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]'
      }`}
    >
      {/* Content */}
    </div>
  );
}
```

---

## Pattern 3: Status/Priority Colors

### Task priority colors from status enum
```tsx
function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const statusColor = {
    high: 'var(--color-status-error)',
    medium: 'var(--color-status-warning)',
    low: 'var(--color-status-info)',
  }[priority];

  return (
    <span
      style={{ 
        backgroundColor: statusColor,
        color: 'var(--color-text-inverse)'
      }}
      className="px-2 py-1 rounded text-xs font-medium"
    >
      {priority}
    </span>
  );
}
```

---

## Pattern 4: Readable Text Over Colored Backgrounds

```tsx
function ActionButton({ variant = 'primary' }) {
  const styles = {
    primary: {
      bg: 'var(--color-action-primary)',
      text: 'var(--color-text-inverse)',
      hover: 'var(--color-action-hover)',
    },
    secondary: {
      bg: 'var(--color-action-secondary)',
      text: 'var(--color-text-inverse)',
      hover: 'var(--color-action-active)',
    },
  }[variant];

  return (
    <button
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = styles.hover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = styles.bg}
      className="px-4 py-2 rounded font-medium transition-colors"
    >
      Click me
    </button>
  );
}
```

---

## Pattern 5: Complex Component Example

### DashboardPage (before)
```tsx
export function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-4xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Welcome back, Aarti</p>
        </header>

        <section className="grid grid-cols-3 gap-6">
          {/* Cards */}
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
            <h2 className="text-white font-semibold">Active Tasks</h2>
            <p className="text-gray-400 text-sm mt-2">42 tasks in progress</p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

### DashboardPage (after)
```tsx
import { useTheme } from '../core/themes/ThemeProvider';

export function DashboardPage() {
  const { isDark } = useTheme(); // For optional logic

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-[var(--color-border-default)] pb-6">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Welcome back, Aarti
          </p>
        </header>

        <section className="grid grid-cols-3 gap-6">
          <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg border border-[var(--color-border-default)]">
            <h2 className="text-[var(--color-text-primary)] font-semibold">
              Active Tasks
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-2">
              42 tasks in progress
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

---

## Pattern 6: Form Inputs

### Styled with theme colors
```tsx
function TaskForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block text-[var(--color-text-primary)] text-sm font-medium mb-2">
          Task Title
        </label>
        <input
          type="text"
          placeholder="Enter task..."
          className="w-full px-3 py-2 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]"
        />
      </div>

      <div>
        <label className="block text-[var(--color-text-primary)] text-sm font-medium mb-2">
          Priority
        </label>
        <select className="w-full px-3 py-2 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]">
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] rounded font-medium hover:bg-[var(--color-action-hover)] transition-colors"
      >
        Create Task
      </button>
    </form>
  );
}
```

---

## Pattern 7: Cards & Containers

```tsx
function Card({ children, variant = 'default' }: Props) {
  const classes = {
    default: 'bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]',
    elevated: 'bg-[var(--color-bg-secondary)] border border-[var(--color-border-dark)] shadow-[var(--shadow-md)]',
    subtle: 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border-light)]',
  }[variant];

  return (
    <div className={`${classes} rounded-lg p-6`}>
      {children}
    </div>
  );
}
```

---

## Pattern 8: Accessibility - Focus States

```tsx
function Button({ children }: Props) {
  return (
    <button
      className="px-4 py-2 bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-action-primary)]"
      style={{
        '--tw-ring-offset-color': 'var(--color-bg-primary)',
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}
```

---

## Pattern 9: Gradients & Effects

```tsx
function HeroSection() {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, var(--color-action-primary), var(--color-action-secondary))`,
      }}
      className="min-h-[400px] flex items-center justify-center rounded-lg text-[var(--color-text-inverse)]"
    >
      <h1>Welcome to Laureate</h1>
    </div>
  );
}
```

---

## Pattern 10: Dark/Light Specific Logic

```tsx
function ThemeAwareComponent() {
  const { isDark } = useTheme();

  return (
    <div className="p-4">
      {isDark ? (
        // Dark theme content
        <p className="text-[var(--color-text-secondary)]">
          This is visible in dark themes
        </p>
      ) : (
        // Light theme content
        <p className="text-[var(--color-text-secondary)]">
          This is visible in light themes
        </p>
      )}
    </div>
  );
}
```

---

## Migration Checklist

When converting a component to use themes:

- [ ] Replace hardcoded background colors with `var(--color-bg-*)`
- [ ] Replace hardcoded text colors with `var(--color-text-*)`
- [ ] Replace hardcoded button colors with `var(--color-action-*)`
- [ ] Replace hardcoded status colors with `var(--color-status-*)`
- [ ] Replace hardcoded borders with `var(--color-border-*)`
- [ ] Test component in all three themes
- [ ] Verify focus/hover states work
- [ ] Check WCAG contrast (at least 4.5:1 for text)
- [ ] Update any hardcoded color props in component API
- [ ] Document any theme-specific behavior

---

## Common Mistakes to Avoid

❌ **Don't** use Tailwind color names directly
```tsx
<div className="bg-blue-600">  // WRONG - doesn't respect theme
```

✅ **Do** use CSS variables
```tsx
<div className="bg-[var(--color-action-primary)]">  // CORRECT
```

---

❌ **Don't** hardcode colors in inline styles
```tsx
<div style={{ color: '#ffffff' }}>  // WRONG
```

✅ **Do** use CSS variables in inline styles
```tsx
<div style={{ color: 'var(--color-text-primary)' }}>  // CORRECT
```

---

## Need Help?

- Read: `/src/core/themes/THEMES_GUIDE.md` - Full documentation
- Reference: `/docs/THEMES_RESEARCH.md` - Design research & rationale
- Example: `/src/pages/SettingsPage.tsx` - Complete implementation
- Import: `import { useTheme } from '@/core/themes'`

Happy theming! 🎨
