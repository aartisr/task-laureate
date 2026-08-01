import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { router } from '../router';
import { ThemeProvider } from '../../core/themes/ThemeProvider';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useEffect, useRef, useState } from 'react';
import { initializePersistence } from '../runtime/appServices';
import { getPersistenceStatus, subscribeToPersistenceStatus, type PersistenceStatus } from '../../infrastructure/persistence/status';
import { authProvider } from '../../config/persistence.config';
import { shouldReinitializeForAuthChange } from '../../core/auth/sessionTransitions';

export function AppProviders() {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(getPersistenceStatus);
  const observedAuthUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    void initializePersistence().then(() => setReady(true)).catch((error) => setStartupError(error instanceof Error ? error : new Error(String(error))));
  }, []);

  useEffect(() => subscribeToPersistenceStatus(setPersistenceStatus), []);

  useEffect(() => {
    const reconnect = () => {
      setReady(false);
      void initializePersistence({ force: true })
        .then(() => setReady(true))
        .catch((error) => setStartupError(error instanceof Error ? error : new Error(String(error))));
    };

    // Supabase always emits INITIAL_SESSION after subscribing. That establishes
    // the baseline; it must not be treated as a new login. Refreshes for the
    // same account likewise do not need to rebuild the workspace.
    return authProvider.subscribe((session) => {
      const nextUserId = session?.user.id ?? null;
      if (observedAuthUserId.current === undefined) {
        observedAuthUserId.current = nextUserId;
        return;
      }
      if (!shouldReinitializeForAuthChange(observedAuthUserId.current, nextUserId, window.location.pathname)) {
        observedAuthUserId.current = nextUserId;
        return;
      }
      observedAuthUserId.current = nextUserId;
      reconnect();
    });
  }, []);

  if (startupError) throw startupError;
  if (!ready) return <div role="status" aria-live="polite">Preparing your secure workspace…</div>;
  return (
    <ErrorBoundary>
      <QueryClientProvider client={appServices.queryClient}>
        <ThemeProvider>
          {persistenceStatus.phase === 'error' && <div className="persistence-alert" role="alert">{persistenceStatus.detail}</div>}
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
