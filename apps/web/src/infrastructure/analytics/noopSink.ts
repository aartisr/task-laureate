import type { AnalyticsSink } from './analytics';

/**
 * Stable no-op sink.
 *
 * Used as the default in:
 *   - Tests (no PostHog calls, no side effects)
 *   - Local development when VITE_POSTHOG_ENABLED is not "true"
 *   - Preview deployments using a separate project key
 *   - Any session where the user has not granted consent
 *   - Environments where configuration is missing or invalid
 */
const NOOP_SINK: AnalyticsSink = {
  start: () => {},
  capture: () => {},
  identify: () => {},
  reset: () => {},
  setConsent: () => {},
  stop: () => {},
};

export function createNoopSink(): AnalyticsSink {
  return NOOP_SINK;
}
