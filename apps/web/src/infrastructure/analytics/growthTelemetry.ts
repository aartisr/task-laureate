/** Privacy-preserving, vendor-neutral growth telemetry.
 *
 * Events contain only a controlled name and allow-listed scalar properties.
 * Task content, email addresses, raw IDs, and authentication tokens are never
 * accepted.
 *
 * Events are dispatched to three channels:
 *   1. A window CustomEvent  (local observability, tests, other listeners)
 *   2. An optional same-origin beacon endpoint (VITE_GROWTH_ANALYTICS_ENDPOINT)
 *   3. The registered AnalyticsDispatcher (PostHog or any other sink)
 *
 * Product features call trackGrowthEvent() and never import posthog-js directly.
 */

import { getAnalyticsDispatcher } from './analytics';

export type GrowthEventName =
  | 'landing_viewed' | 'demo_started' | 'signup_started' | 'signup_completed'
  | 'first_list_created' | 'first_task_created' | 'first_due_date_set'
  | 'first_task_completed' | 'first_list_shared' | 'invite_accepted'
  | 'reminder_enabled' | 'sync_failed' | 'quick_capture_saved'
  | 'daily_commitment_added' | 'decomposition_accepted' | 'mutation_conflict_detected';

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

  // Channel 1: local CustomEvent (for tests and same-page listeners)
  window.dispatchEvent(new CustomEvent<GrowthEvent>('task-laureate:growth-event', { detail: event }));

  // Channel 2: vendor-specific sinks (PostHog, future vendors)
  getAnalyticsDispatcher().capture(event);

  // Channel 3: optional beacon endpoint
  if (!endpoint || !navigator.sendBeacon) return;
  try {
    navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], { type: 'application/json' }));
  } catch {
    // Analytics must never block, expose, or degrade a person's task workflow.
  }
}
