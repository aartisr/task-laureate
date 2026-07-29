/**
 * LoadingSkeleton Component
 * Provides visual loading feedback with shimmer animations
 */

interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'list' | 'grid';
  count?: number;
  className?: string;
}

export const LoadingSkeleton = ({
  variant = 'card',
  count = 3,
  className = '',
}: LoadingSkeletonProps) => {
  if (variant === 'text') {
    return (
      <div className={`skeleton skeleton-text ${className}`} />
    );
  }

  if (variant === 'card') {
    return (
      <div className={`skeleton skeleton-card ${className}`}>
        <div className="skeleton-card-line skeleton"></div>
        <div className="skeleton-card-line skeleton" style={{ width: '70%' }}></div>
        <div className="skeleton-card-line skeleton" style={{ width: '50%' }}></div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="skeleton skeleton-card">
              <div className="skeleton-card-line skeleton"></div>
              <div className="skeleton-card-line skeleton" style={{ width: '60%' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card">
            <div className="skeleton-card-line skeleton"></div>
            <div className="skeleton-card-line skeleton" style={{ width: '80%' }}></div>
            <div className="skeleton-card-line skeleton" style={{ width: '60%' }}></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};
