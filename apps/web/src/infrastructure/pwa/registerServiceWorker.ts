const workerUrl = '/service-worker.js';

/** Registers once on every secure app launch. Push and offline caching share this worker. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(workerUrl, { scope: '/' }).then((registration) => {
      const activateFirstInstall = () => {
        if (!navigator.serviceWorker.controller && registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      };
      activateFirstInstall();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', activateFirstInstall));
    }).catch((error) => {
      // A PWA enhancement must never prevent the workspace from opening.
      console.warn('Task Laureate service worker registration failed.', error);
    });
  }, { once: true });
}
