/** Privacy-preserving, vendor-neutral growth telemetry.
 *
 * Events contain only a controlled name and allow-listed scalar properties.
 * Task content, email addresses, raw IDs, and authentication tokens are never
 * accepted. An optional same-origin or trusted endpoint makes this portable to
 * any analytics provider without coupling product code to that provider.
 */
export type GrowthEventName =
  | 'landing_viewed' | 'demo_started' | 'signup_started' | 'signup_completed'
  | 'first_list_created' | 'first_task_created' | 'first_due_date_set'
  | 'first_task_completed' | 'first_list_shared' | 'invite_accepted'
  | 'reminder_enabled' | 'sync_failed';

type SafeProperty = string | number | boolean | null;
type GrowthEvent = { name: GrowthEventName; properties?: Record<string, SafeProperty>; occurredAt: string };
const endpoint = import.meta.env.VITE_GROWTH_ANALYTICS_ENDPOINT;
const propertyName = /^[a-z][a-z0-9_]{0,63}$/;

function sanitize(properties: Record<string, unknown> | undefined): Record<string, SafeProperty> | undefined {
  if (!properties) return undefined;
  const safe = Object.entries(properties).reduce<Record<string, SafeProperty>>((result, [key, value]) => {
    if (!propertyName.test(key) || typeof value === 'object' && value !== null) return result;
    if (typeof value === 'string') result[key] = value.slice(0, 120);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean' || value === null) result[key] = value;
    return result;
  }, {});
  return Object.keys(safe).length ? safe : undefined;
}

export function trackGrowthEvent(name: GrowthEventName, properties?: Record<string, unknown>) {
  const event: GrowthEvent = { name, properties: sanitize(properties), occurredAt: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent<GrowthEvent>('task-laureate:growth-event', { detail: event }));
  if (!endpoint || !navigator.sendBeacon) return;
  try {
    navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], { type: 'application/json' }));
  } catch {
    // Analytics must never block, expose, or degrade a person's task workflow.
  }
}
