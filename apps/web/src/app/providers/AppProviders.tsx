import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Analytics } from '@vercel/analytics/react';
import { appServices } from '../runtime/appServices';
import { router } from '../router';
import { ThemeProvider } from '../../core/themes/ThemeProvider';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useEffect, useRef, useState } from 'react';
import { initializePersistence, resetWorkspaceForAuthChange } from '../runtime/appServices';
import { getPersistenceStatus, subscribeToPersistenceStatus, type PersistenceStatus } from '../../infrastructure/persistence/status';
import { authProvider } from '../../config/persistence.config';
import { shouldReinitializeForAuthChange } from '../../core/auth/sessionTransitions';
import { trackGrowthEvent } from '../../infrastructure/analytics/growthTelemetry';
import { initializeAnalytics } from '../../infrastructure/analytics/analyticsSetup';
import { getAnalyticsDispatcher } from '../../infrastructure/analytics/analytics';
import { getAnalyticsConfig } from '../../infrastructure/analytics/analyticsConfig';
import { getConsentDecision } from '../../core/privacy/analyticsConsent';
import { MutationConflictCenter } from '../../components/MutationConflictCenter';
import { RemoteSyncStatus } from '../../components/RemoteSyncStatus';
import { PwaInstallExperience } from '../../components/PwaInstallExperience';

// Initialize the analytics dispatcher once at module load time (browser only).
// This ensures the dispatcher is registered before any trackGrowthEvent() call.
if (typeof window !== 'undefined') {
  initializeAnalytics();
}

export function AppProviders() {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(getPersistenceStatus);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const [startupDelayed, setStartupDelayed] = useState(false);
  const observedAuthUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    void initializePersistence().then(() => setReady(true)).catch((error) => setStartupError(error instanceof Error ? error : new Error(String(error))));
  }, []);

  useEffect(() => subscribeToPersistenceStatus(setPersistenceStatus), []);

  useEffect(() => {
    if (persistenceStatus.phase === 'error') trackGrowthEvent('sync_failed', { surface: 'startup' });
  }, [persistenceStatus.phase]);

  useEffect(() => {
    if (ready) { setStartupDelayed(false); return; }
    const timer = window.setTimeout(() => setStartupDelayed(true), 3500);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    const reconnect = () => {
      // The repository and query cache must change before the async session
      // lookup starts. Otherwise a mounted route can render an old account's
      // query function until React receives the later persistence update.
      resetWorkspaceForAuthChange();
      setWorkspaceEpoch((epoch) => epoch + 1);
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
        // Baseline INITIAL_SESSION – identify if already signed in
        observedAuthUserId.current = nextUserId;
        if (nextUserId) getAnalyticsDispatcher().identify({ userId: nextUserId });
        return;
      }
      if (!shouldReinitializeForAuthChange(observedAuthUserId.current, nextUserId, window.location.pathname)) {
        observedAuthUserId.current = nextUserId;
        return;
      }
      // Auth transition: reset identity before clearing the workspace cache,
      // then identify the new user if one signed in.
      getAnalyticsDispatcher().reset();
      const consentVersion = getAnalyticsConfig().consentVersion;
      const consentGranted = getConsentDecision(consentVersion) === 'granted';
      getAnalyticsDispatcher().setConsent({ granted: consentGranted, version: consentVersion });
      observedAuthUserId.current = nextUserId;
      if (nextUserId) getAnalyticsDispatcher().identify({ userId: nextUserId });
      reconnect();
    });
  }, []);

  const retryStartup = () => {
    setStartupError(null);
    setReady(false);
    setStartupDelayed(false);
    resetWorkspaceForAuthChange();
    setWorkspaceEpoch((epoch) => epoch + 1);
    void initializePersistence({ force: true })
      .then(() => setReady(true))
      .catch((error) => setStartupError(error instanceof Error ? error : new Error(String(error))));
  };

  if (startupError) return <main className="app-startup-error" role="alert">
    <div><p>Workspace unavailable</p><h1>We could not prepare your secure workspace.</h1><span>{startupError.message}</span><button type="button" className="primary-button" onClick={retryStartup}>Try again</button></div>
  </main>;
  if (!ready) return <main className="app-startup-shell" aria-busy="true" aria-label="Preparing Task Laureate">
    <aside className="app-startup-shell__sidebar" aria-hidden="true"><div className="app-startup-shell__brand"><img src="/.well-known/logo-small.svg" alt="" /><span>Task Laureate</span></div><div className="app-startup-shell__nav"><b /><b /><b /><b /></div><div className="app-startup-shell__account"><i /><span><b /><b /></span></div></aside>
    <section className="app-startup-shell__workspace"><header><div><span className="app-startup-shell__eyebrow">Secure workspace</span><h1>Getting your work ready</h1><p role="status" aria-live="polite">Restoring your private session and workspace…</p></div><i aria-hidden="true" /></header><div className="app-startup-shell__stats" aria-hidden="true"><b /><b /><b /></div><div className="app-startup-shell__content" aria-hidden="true"><b /><b /><b /><b /></div>{startupDelayed ? <div className="app-startup-shell__recovery"><span>Still connecting. Your data remains protected while we retry.</span><button type="button" className="secondary-button" onClick={retryStartup}>Retry connection</button></div> : null}</section>
  </main>;
  return (
    <ErrorBoundary>
      <QueryClientProvider client={appServices.queryClient}>
        <ThemeProvider>
          {persistenceStatus.phase === 'error' && <div className="persistence-alert" role="alert">{persistenceStatus.detail}</div>}
          <RemoteSyncStatus />
          <MutationConflictCenter />
          <RouterProvider key={workspaceEpoch} router={router} />
          <PwaInstallExperience />
          <Analytics />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
