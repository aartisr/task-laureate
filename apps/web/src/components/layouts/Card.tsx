import { ReactNode } from 'react';

export interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Click handler - makes card interactive */
  onClick?: () => void;
  /** Card variant/style */
  variant?: 'default' | 'elevated' | 'subtle';
  /** Hover effect (default: true if onClick provided) */
  hoverable?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Optional className override */
  className?: string;
}

/**
 * Generic card component
 * 
 * Provides:
 * - Consistent card styling
 * - Optional click handler
 * - Variants (default, elevated, subtle)
 * - Accessibility
 * 
 * Usage:
 * ```tsx
 * <Card onClick={handleClick} ariaLabel="List item">
 *   <h3>Title</h3>
 *   <p>Description</p>
 * </Card>
 * ```
 */
export function Card({
  children,
  onClick,
  variant = 'default',
  hoverable = !!onClick,
  ariaLabel,
  className = '',
}: CardProps) {
  const variantStyles = {
    default: {
      backgroundColor: 'var(--color-bg-secondary)',
      borderColor: 'var(--color-border-default)',
      boxShadow: 'none',
    },
    elevated: {
      backgroundColor: 'var(--color-bg-secondary)',
      borderColor: 'var(--color-border-dark)',
      boxShadow: 'var(--shadow-md)',
    },
    subtle: {
      backgroundColor: 'var(--color-bg-tertiary)',
      borderColor: 'var(--color-border-light)',
      boxShadow: 'none',
    },
  }[variant];

  return (
    <article
      onClick={onClick}
      style={{
        ...variantStyles,
        border: '1px solid',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-6)',
        transition: 'all var(--transition-base)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={className}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = variantStyles.boxShadow || 'none';
        }
      }}
    >
      {children}
    </article>
  );
}

// ─────────────────────────────────────────

export interface GridProps {
  /** Grid items */
  children: ReactNode;
  /** Number of columns (default: 'auto') */
  columns?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  /** Responsive column behavior */
  responsive?: boolean;
  /** Gap between items */
  gap?: 'compact' | 'normal' | 'spacious';
}

/**
 * Generic grid layout component
 * 
 * Provides:
 * - Consistent grid styling
 * - Responsive column control
 * - Gap/spacing options
 * 
 * Usage:
 * ```tsx
 * <Grid columns={3} gap="normal">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 * ```
 */
export function Grid({
  children,
  columns = 'auto',
  responsive = true,
  gap = 'normal',
}: GridProps) {
  const gapMap = {
    compact: 'var(--spacing-3)',
    normal: 'var(--spacing-6)',
    spacious: 'var(--spacing-8)',
  };

  const getGridTemplateColumns = () => {
    if (columns === 'auto') return 'auto';
    if (!responsive) {
      return `repeat(${columns}, minmax(0, 1fr))`;
    }
    // Responsive behavior
    if (columns === 1) return '1fr';
    if (columns === 2) return 'repeat(auto-fit, minmax(250px, 1fr))';
    if (columns === 3) return 'repeat(auto-fit, minmax(300px, 1fr))';
    if (columns === 4) return 'repeat(auto-fit, minmax(280px, 1fr))';
    if (columns === 5) return 'repeat(auto-fit, minmax(200px, 1fr))';
    if (columns === 6) return 'repeat(auto-fit, minmax(180px, 1fr))';
    return 'auto';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplateColumns(),
        gap: gapMap[gap],
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────

export interface SectionProps {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Section content */
  children: ReactNode;
  /** Aria label override */
  ariaLabel?: string;
}

/**
 * Generic section component
 * 
 * Provides:
 * - Consistent section styling
 * - Title and description
 * - Semantic HTML
 * 
 * Usage:
 * ```tsx
 * <Section title="Recent Lists" description="Your most recent projects">
 *   <Grid>
 *     {lists.map(list => <Card key={list.id}>{list.title}</Card>)}
 *   </Grid>
 * </Section>
 * ```
 */
export function Section({
  title,
  description,
  children,
  ariaLabel,
}: SectionProps) {
  return (
    <section
      aria-label={ariaLabel || title}
      style={{
        display: 'grid',
        gap: 'var(--spacing-4)',
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--spacing-2)',
              marginBottom: 0,
              fontSize: '0.95rem',
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
