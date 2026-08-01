import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { router } from '../router';
import { ThemeProvider } from '../../core/themes/ThemeProvider';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useEffect, useState } from 'react';
import { initializePersistence } from '../runtime/appServices';
import { getPersistenceStatus, subscribeToPersistenceStatus, type PersistenceStatus } from '../../infrastructure/persistence/status';

export function AppProviders() {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(getPersistenceStatus);

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
    window.addEventListener('task-laureate:auth-changed', reconnect);
    return () => window.removeEventListener('task-laureate:auth-changed', reconnect);
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
