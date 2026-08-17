import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AppIcon } from '../AppIcon';

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

/** Shared page frame: every utility page receives the same calm hierarchy. */
export function PageContainer({ title, subtitle, backButton, children, footer, maxWidth = 'lg', spacing = 'normal', ariaLabel }: PageContainerProps) {
  return <section aria-label={ariaLabel || title} className={`page-container page-container--${maxWidth} page-container--${spacing}`}>
    <div className="page-container__inner">
      <header className="page-container__header">
        {backButton ? <nav className="page-container__back"><Link to={backButton.to as never} aria-label={`Back to ${backButton.label || 'previous page'}`}><AppIcon name="arrow-left" /> {backButton.label || 'Back'}</Link></nav> : null}
        <div><p className="page-container__eyebrow">Task Laureate</p><h1>{title}</h1>{subtitle ? <p className="page-container__subtitle">{subtitle}</p> : null}</div>
      </header>
      <div className="page-container__content">{children}</div>
      {footer ? <footer className="page-container__footer">{footer}</footer> : null}
    </div>
  </section>;
}
