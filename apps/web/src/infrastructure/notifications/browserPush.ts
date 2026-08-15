import { authProvider } from '../../config/persistence.config';

export type BrowserPushState = 'unsupported' | 'unconfigured' | 'default' | 'denied' | 'enabled';
type SubscriptionRecord = { endpoint: string; keys: { p256dh: string; auth: string } };

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function supported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64UrlToBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const encoded = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(encoded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function request(path: string, init: RequestInit = {}) {
  const session = await authProvider.getSession();
  if (!session) throw new Error('Sign in to manage browser alerts.');
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Cloud sync is not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!response.ok) throw new Error(`Browser-alert preference request failed (${response.status}).`);
  return { response, ownerId: session.user.id };
}

async function registration() {
  return navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);
}

export async function getBrowserPushState(): Promise<BrowserPushState> {
  if (!supported()) return 'unsupported';
  if (!publicKey) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  return (await registration()).pushManager.getSubscription().then((subscription) => subscription ? 'enabled' : 'default');
}

export async function enableBrowserPush() {
  if (!supported()) throw new Error('This browser does not support secure browser alerts.');
  if (!publicKey) throw new Error('Browser alerts are not configured for this deployment.');
  const session = await authProvider.getSession();
  if (!session) throw new Error('Sign in to enable browser alerts.');
  if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') throw new Error('Browser alert permission was not granted.');
  const worker = await registration();
  const subscription = await worker.pushManager.getSubscription() ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) as BufferSource });
  const json = subscription.toJSON() as SubscriptionRecord;
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('The browser returned an incomplete alert subscription.');
  await request('push_subscriptions?on_conflict=endpoint', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ owner_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, updated_at: new Date().toISOString() }]),
  });
}

export async function disableBrowserPush() {
  if (!supported()) return;
  const worker = await registration();
  const subscription = await worker.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await request(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}
