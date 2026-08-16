import { useEffect, useState } from 'react';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || touchMac;
}

/**
 * A quiet, user-controlled install affordance. Browsers that expose native
 * installation get their own prompt; iOS gets its platform-specific guidance
 * only after the person asks for it.
 */
export function PwaInstallExperience() {
  const [prompt, setPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    // iOS intentionally does not expose beforeinstallprompt. Its discoverable
    // icon opens precise, native Add-to-Home-Screen guidance instead.
    if (isAppleMobile()) setAvailable(true);

    const receivePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as DeferredInstallPrompt);
      setAvailable(true);
    };
    const installed = () => {
      setPrompt(null);
      setAvailable(false);
      setIsOpen(false);
    };
    window.addEventListener('beforeinstallprompt', receivePrompt);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', receivePrompt);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === 'dismissed') {
      // A browser will not re-offer the deferred prompt during this session.
      // Remove the affordance rather than leaving a dead install button.
      setAvailable(false);
      setIsOpen(false);
    }
  };

  if (!available) return null;
  const isIos = isAppleMobile();

  return (
    <div className={`pwa-install ${isOpen ? 'is-open' : ''}`}>
      {isOpen ? (
        <aside id="pwa-install-details" className="pwa-install__panel" aria-label="Install Task Laureate">
          <img className="pwa-install__icon" src="/icons/task-laureate-192.png" alt="" />
          <div className="pwa-install__copy">
            <span className="pwa-install__eyebrow">Available on your home screen</span>
            <strong>Install Task Laureate</strong>
            {isIos ? <p>In Safari, tap <b>Share</b> <span aria-hidden="true">↑</span>, then choose <b>Add to Home Screen</b>.</p> : <p>Open it like an app, with a calmer, faster return to your next task.</p>}
          </div>
          {prompt ? <button className="pwa-install__action" type="button" onClick={() => void install()}>Install</button> : null}
          <button className="pwa-install__dismiss" type="button" onClick={() => setIsOpen(false)} aria-label="Close install details">×</button>
        </aside>
      ) : null}
      <button
        className="pwa-install__trigger"
        type="button"
        aria-label="Install Task Laureate"
        aria-expanded={isOpen}
        aria-controls="pwa-install-details"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="pwa-install__trigger-icon" aria-hidden="true">⇩</span>
        <span className="pwa-install__trigger-label">Install</span>
      </button>
    </div>
  );
}
