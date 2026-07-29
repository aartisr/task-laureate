import { ReactNode } from 'react';

export interface LoadingStateProps {
  /** Custom loading message (default: "Loading...") */
  message?: string;
  /** Show a loading spinner (default: true) */
  showSpinner?: boolean;
  /** Aria live polite region (default: true) */
  ariaLive?: boolean;
}

/**
 * Generic loading state component
 * 
 * Provides:
 * - Consistent loading UI across pages
 * - Spinner and message
 * - Accessibility attributes
 * 
 * Usage:
 * ```tsx
 * {isLoading && <LoadingState message="Loading tasks..." />}
 * ```
 */
export function LoadingState({
  message = 'Loading...',
  showSpinner = true,
  ariaLive = true,
}: LoadingStateProps) {
  return (
    <section
      className="py-12 text-center"
      role="status"
      aria-live={ariaLive ? 'polite' : undefined}
      aria-busy="true"
    >
      {showSpinner && (
        <div className="inline-block mb-4" aria-hidden="true">
          <div className="w-8 h-8 border-4 border-[var(--color-border-default)] border-t-[var(--color-action-primary)] rounded-full animate-spin" />
        </div>
      )}
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </section>
  );
}

// ─────────────────────────────────────────

export interface EmptyStateProps {
  /** Large icon/emoji to display (default: "📭") */
  icon?: string | ReactNode;
  /** Main heading */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional content to display below */
  children?: ReactNode;
}

/**
 * Generic empty state component
 * 
 * Provides:
 * - Consistent empty state UI
 * - Icon, title, description
 * - Optional action button
 * 
 * Usage:
 * ```tsx
 * {items.length === 0 && (
 *   <EmptyState
 *     title="No tasks"
 *     description="Create your first task to get started"
 *     action={{ label: "Create Task", onClick: handleCreate }}
 *   />
 * )}
 * ```
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <article className="bg-[var(--color-bg-secondary)] rounded-lg p-12 text-center border border-[var(--color-border-default)]">
      {icon && (
        <div className="text-6xl mb-4" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
        {title}
      </h2>
      {description && (
        <p className="text-[var(--color-text-secondary)] mb-8">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] rounded-lg font-medium hover:bg-[var(--color-action-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] focus:ring-offset-2"
          style={{ '--tw-ring-offset-color': 'var(--color-bg-primary)' } as React.CSSProperties}
        >
          {action.label}
        </button>
      )}
      {children}
    </article>
  );
}

// ─────────────────────────────────────────

export interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Optional error details (shown in dev) */
  details?: string;
  /** Action to retry or go back */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Generic error state component
 * 
 * Provides:
 * - Consistent error UI
 * - Error message and details
 * - Optional retry/action button
 * 
 * Usage:
 * ```tsx
 * {error && <ErrorState message={error.message} />}
 * ```
 */
export function ErrorState({ message, details, action }: ErrorStateProps) {
  return (
    <article
      className="bg-red-50 border border-red-200 rounded-lg p-8 text-center"
      role="alert"
    >
      <div className="text-4xl mb-4" aria-hidden="true">
        ⚠️
      </div>
      <h2 className="text-xl font-bold text-red-900 mb-2">
        {message}
      </h2>
      {details && (
        <p className="text-sm text-red-700 mb-6 font-mono whitespace-pre-wrap">
          {details}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </article>
  );
}
