import { type ReactNode } from 'react';

export interface CardProps { children: ReactNode; onClick?: () => void; variant?: 'default' | 'elevated' | 'subtle'; hoverable?: boolean; ariaLabel?: string; className?: string; }

/** Theme-aware, keyboard-operable surface used by dashboards and editors. */
export function Card({ children, onClick, variant = 'default', hoverable = Boolean(onClick), ariaLabel, className = '' }: CardProps) {
  return <article onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} aria-label={ariaLabel}
    onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
    className={`ui-card ui-card--${variant} ${hoverable ? 'ui-card--interactive' : ''} ${className}`.trim()}>{children}</article>;
}

export interface GridProps { children: ReactNode; columns?: 'auto' | 1 | 2 | 3 | 4 | 5 | 6; responsive?: boolean; gap?: 'compact' | 'normal' | 'spacious'; }
export function Grid({ children, columns = 'auto', responsive = true, gap = 'normal' }: GridProps) { return <div className={`ui-grid ui-grid--${columns} ui-grid--gap-${gap} ${responsive ? 'ui-grid--responsive' : ''}`}>{children}</div>; }

export interface SectionProps { title: string; description?: string; children: ReactNode; ariaLabel?: string; }
export function Section({ title, description, children, ariaLabel }: SectionProps) { return <section aria-label={ariaLabel || title} className="ui-section"><div className="ui-section__heading"><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><div>{children}</div></section>; }
