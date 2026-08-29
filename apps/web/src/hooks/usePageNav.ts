import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

export interface UsePageNavProps {
  /** Navigate back on Escape key (default: true) */
  onEscapeGoBack?: boolean;
  /** Where to navigate on Escape (default: '/') */
  escapeBackTo?: string;
  /** Custom Escape handler */
  onEscape?: () => void;
}

/**
 * Generic hook for page-level navigation and keyboard shortcuts
 * 
 * Handles:
 * - Escape key to go back
 * - Navigation setup
 * - Event listener cleanup
 * 
 * Usage:
 * ```tsx
 * function MyPage() {
 *   usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });
 *   // ...
 * }
 * ```
 */
export function usePageNav({
  onEscapeGoBack = true,
  escapeBackTo = '/',
  onEscape,
}: UsePageNavProps = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onEscape) {
          onEscape();
        } else if (onEscapeGoBack) {
          navigate({ to: escapeBackTo });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onEscape, onEscapeGoBack, escapeBackTo]);

  return { navigate };
}
