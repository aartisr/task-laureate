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
      className="ui-state ui-state--loading"
      role="status"
      aria-live={ariaLive ? 'polite' : undefined}
      aria-busy="true"
    >
      {showSpinner && (
        <div className="ui-state__spinner" aria-hidden="true">
          <div />
        </div>
      )}
      <p>{message}</p>
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
    <article className="ui-state ui-state--empty">
      {icon && (
        <div className="ui-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2>
        {title}
      </h2>
      {description && (
        <p>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="primary-button"
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
      className="ui-state ui-state--error"
      role="alert"
    >
      <div className="ui-state__icon" aria-hidden="true">
        ⚠️
      </div>
      <h2>
        {message}
      </h2>
      {details && (
        <p className="ui-state__details">
          {details}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="secondary-button"
        >
          {action.label}
        </button>
      )}
    </article>
  );
}
