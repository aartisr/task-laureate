/**
 * posthog-js no-op stub.
 *
 * This module is aliased in vite.config.ts when posthog-js is not installed
 * (local dev without npm install, CI without PostHog, disabled builds).
 * It implements the same surface as the real PostHog singleton so any code
 * that calls posthog.capture(), posthog.init(), etc. silently no-ops.
 *
 * When posthog-js IS installed (Vercel, prod, any npm ci environment) Vite
 * resolves to the real package and this file is never used.
 */

const noop = () => {};

const stub = {
  init: noop,
  capture: noop,
  identify: noop,
  reset: noop,
  opt_in_capturing: noop,
  opt_out_capturing: noop,
  has_opted_out_capturing: () => true,
  get_distinct_id: () => 'noop',
} as const;

export default stub;
