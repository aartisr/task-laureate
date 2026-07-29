import { ReactNode } from 'react';

export interface PageContainerProps {
  title: string;
  subtitle?: string;
  backButton?: { label?: string; to: string };
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  spacing?: 'compact' | 'normal' | 'spacious';
  ariaLabel?: string;
}

export function PageContainer({
  title,
  subtitle,
  backButton,
  children,
  footer,
  maxWidth = 'lg',
  spacing = 'normal',
  ariaLabel,
}: PageContainerProps) {
  const maxWidthMap = {
    sm: '640px',
    md: '768px',
    lg: '1200px',
    xl: '1400px',
    full: '100%',
  };

  const spacingMap = {
    compact: 'var(--spacing-4)',
    normal: 'var(--spacing-8)',
    spacious: 'var(--spacing-12)',
  };

  return (
    <main
      role="main"
      aria-label={ariaLabel || title}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        padding: 'var(--spacing-6)',
      }}
    >
      <div
        style={{
          maxWidth: maxWidthMap[maxWidth],
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <header
          style={{
            display: 'grid',
            gap: spacingMap[spacing],
            marginBottom: spacingMap[spacing],
          }}
        >
          {backButton && (
            <nav style={{ marginBottom: 'var(--spacing-4)' }}>
              <a
                href={backButton.to}
                style={{
                  color: 'var(--color-action-primary)',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  transition: 'color var(--transition-base)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-action-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-action-primary)';
                }}
                aria-label={`Back to ${backButton.label || 'previous page'}`}
              >
                ← {backButton.label || 'Back'}
              </a>
            </nav>
          )}
          <div>
            <h1
              style={{
                fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--spacing-2)',
                marginTop: 0,
                lineHeight: 'var(--line-height-tight)',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 0,
                  marginTop: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </header>

        <div>{children}</div>

        {footer && (
          <footer
            style={{
              marginTop: 'var(--spacing-12)',
              paddingTop: 'var(--spacing-8)',
              borderTop: '1px solid var(--color-border-default)',
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </main>
  );
}
