import { useEffect, useState } from 'react';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const dismissKey = 'task-laureate.install-nudge-dismissed-at';
const dismissWindowMs = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || touchMac;
}

function recentlyDismissed() {
  const timestamp = Number(window.localStorage.getItem(dismissKey));
  return Number.isFinite(timestamp) && Date.now() - timestamp < dismissWindowMs;
}

/**
 * Native install when a browser exposes it; concise, platform-accurate guidance
 * where the platform intentionally does not expose a programmable prompt (iOS).
 */
export function PwaInstallExperience() {
  const [prompt, setPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setDismissed(false);
    if (isAppleMobile()) setShowIosGuide(true);

    const receivePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as DeferredInstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setShowIosGuide(false);
    };
    window.addEventListener('beforeinstallprompt', receivePrompt);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', receivePrompt);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(dismissKey, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === 'dismissed') dismiss();
  };

  if (dismissed || (!prompt && !showIosGuide)) return null;
  const isIos = showIosGuide && !prompt;

  return (
    <aside className="pwa-install" aria-label="Install Task Laureate">
      <img className="pwa-install__icon" src="/icons/task-laureate-192.png" alt="" />
      <div className="pwa-install__copy">
        <span className="pwa-install__eyebrow">Your focused space, one tap away</span>
        <strong>Install Task Laureate</strong>
        {isIos ? <p>Tap <b>Share</b> <span aria-hidden="true">↑</span>, then choose <b>Add to Home Screen</b>.</p> : <p>Open it like an app, with a calmer, faster return to your next task.</p>}
      </div>
      {prompt ? <button className="pwa-install__action" type="button" onClick={() => void install()}>Install</button> : null}
      <button className="pwa-install__dismiss" type="button" onClick={dismiss} aria-label="Not now, dismiss install suggestion">×</button>
    </aside>
  );
}
