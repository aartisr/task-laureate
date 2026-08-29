import { useEffect, useState } from 'react';

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let active = true;
    let currentRegistration: ServiceWorkerRegistration | null = null;
    const showIfWaiting = () => { if (active && currentRegistration?.waiting) setUpdateReady(true); };
    const watchInstalling = () => {
      const installing = currentRegistration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showIfWaiting();
      });
    };
    void navigator.serviceWorker.ready.then((nextRegistration) => {
      if (!active) return;
      currentRegistration = nextRegistration;
      setRegistration(nextRegistration);
      showIfWaiting();
      nextRegistration.addEventListener('updatefound', watchInstalling);
      void nextRegistration.update().catch(() => undefined);
    });
    return () => {
      active = false;
      currentRegistration?.removeEventListener('updatefound', watchInstalling);
    };
  }, []);

  const reload = () => {
    if (!registration?.waiting) return;
    const reloadOnce = () => { navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce); window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!updateReady) return null;
  return <aside className="pwa-update-prompt" role="status" aria-live="polite"><div><strong>New version available</strong><p>Reload when you are ready to use the latest Task-Laureate update.</p></div><button type="button" className="primary-button" onClick={reload}>Reload</button></aside>;
}