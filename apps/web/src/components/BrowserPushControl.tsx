import { useEffect, useState } from 'react';
import { disableBrowserPush, enableBrowserPush, getBrowserPushState, type BrowserPushState } from '../infrastructure/notifications/browserPush';

const copy: Record<BrowserPushState, { title: string; detail: string }> = {
  enabled: { title: 'Browser alerts are on', detail: 'This device can receive a push when a new in-app reminder is created.' },
  default: { title: 'Browser alerts are off', detail: 'Enable them to receive the same reminders even when this tab is closed.' },
  denied: { title: 'Browser alerts are blocked', detail: 'Allow notifications in your browser settings, then return here to enable them.' },
  unsupported: { title: 'Browser alerts are unavailable', detail: 'Use a current secure browser. On iPhone or iPad, add Task-Laureate to the Home Screen first.' },
  unconfigured: { title: 'Browser alerts are not configured', detail: 'This deployment has not yet been given its public VAPID key.' },
};

export function BrowserPushControl() {
  const [state, setState] = useState<BrowserPushState>('unsupported');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { void getBrowserPushState().then(setState).catch(() => setState('unsupported')); }, []);
  const enable = async () => { setBusy(true); setMessage(''); try { await enableBrowserPush(); setState('enabled'); } catch (error) { setMessage(error instanceof Error ? error.message : 'We could not enable browser alerts.'); setState(await getBrowserPushState()); } finally { setBusy(false); } };
  const disable = async () => { setBusy(true); setMessage(''); try { await disableBrowserPush(); setState(await getBrowserPushState()); } catch { setMessage('We could not turn off browser alerts on this device.'); } finally { setBusy(false); } };
  const details = copy[state];
  return <section className="browser-push-control" aria-labelledby="browser-push-title"><div><p className="notification-inbox__eyebrow">Optional browser delivery</p><h3 id="browser-push-title">{details.title}</h3><p>{details.detail}</p></div>{state === 'default' ? <button type="button" onClick={() => void enable()} disabled={busy}>{busy ? 'Enabling…' : 'Enable browser alerts'}</button> : null}{state === 'enabled' ? <button type="button" className="browser-push-control__secondary" onClick={() => void disable()} disabled={busy}>{busy ? 'Turning off…' : 'Turn off on this device'}</button> : null}{message ? <p className="browser-push-control__message" role="status">{message}</p> : null}</section>;
}
