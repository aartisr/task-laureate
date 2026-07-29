import { Link } from '@tanstack/react-router';

interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  subtitle?: string;
  to?: string;
}

export function StatCard({ label, value, icon, subtitle, to }: StatCardProps) {
  const inner = (
    <>
      {icon && <span className="stat-card__icon" aria-hidden="true">{icon}</span>}
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
      {to && <span className="stat-card__arrow" aria-hidden="true">→</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card stat-card--link" aria-label={`${label}: ${value}`}>
        {inner}
      </Link>
    );
  }

  return (
    <article className="stat-card">
      {inner}
    </article>
  );
}
