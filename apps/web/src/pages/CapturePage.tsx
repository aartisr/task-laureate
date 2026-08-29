import { useEffect } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { stagePendingCapture } from '../core/services/captureHandoff';

/** A browser extension and share-sheet landing point. The shell owns the modal. */
export function CapturePage() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (state) => state.location.searchStr });
  useEffect(() => {
    const params = new URLSearchParams(search);
    const text = [params.get('title'), params.get('text')].filter((value): value is string => Boolean(value?.trim())).join('\n').trim();
    const sourceUrl = params.get('url')?.trim() || undefined;
    if (text || sourceUrl) stagePendingCapture({ text: text || sourceUrl || '', sourceUrl });
    void navigate({ to: '/now', replace: true });
  }, [navigate, search]);
  return <main className="page-surface" aria-busy="true">Opening Quick Capture…</main>;
}
