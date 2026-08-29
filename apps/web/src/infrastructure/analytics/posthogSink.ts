/**
 * PostHog analytics sink.
 *
 * Implements AnalyticsSink by forwarding approved growth events to PostHog.
 * Collection is fully gated on explicit user consent – no event is ever sent
 * without a prior setConsent({ granted: true }) call.
 *
 * Works identically with:
 *   PostHog Cloud US   – VITE_POSTHOG_HOST=https://us.i.posthog.com  (default)
 *   PostHog Cloud EU   – VITE_POSTHOG_HOST=https://eu.i.posthog.com
 *   Self-hosted        – VITE_POSTHOG_HOST=https://posthog.your-company.com
 *
 * Removing createPostHogSink() from the composition root in analyticsSetup.ts
 * is the only change needed to switch vendors or fully disable PostHog.
 */

import type {
  AnalyticsSink,
  ApprovedGrowthEvent,
  AnalyticsContext,
  AnalyticsIdentity,
  AnalyticsConsent,
} from './analytics';
import type { AnalyticsConfig } from './analyticsConfig';
import {
  shouldInitPostHog,
  getCachedPostHogInstance,
  setCachedPostHogInstance,
  getInitPromise,
  setInitPromise,
  clearInitPromise,
  type PostHogLike,
} from './posthogClient';

// ---------------------------------------------------------------------------
// Lazy loader
// ---------------------------------------------------------------------------
// posthog-js is imported with /* @vite-ignore */ so Rollup skips static analysis.
// When VITE_POSTHOG_ENABLED=false the import never executes and posthog-js bytes
// are never delivered to the browser. When enabled, the SDK is loaded once after
// the user grants consent.
// ---------------------------------------------------------------------------

async function loadPostHogLib(): Promise<PostHogLike | null> {
  try {
    // @vite-ignore prevents Rollup from bundling posthog-js in disabled builds.
    const mod = await import(/* @vite-ignore */ 'posthog-js') as { default: PostHogLike };
    return mod.default;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[posthog] SDK load failed – is posthog-js installed?', err);
    return null;
  }
}

async function getPostHogClient(config: AnalyticsConfig): Promise<PostHogLike | null> {
  if (!shouldInitPostHog(config)) return null;

  const cached = getCachedPostHogInstance();
  if (cached) return cached;

  const existing = getInitPromise();
  if (existing) return existing;

  const promise: Promise<PostHogLike | null> = (async () => {
    const lib = await loadPostHogLib();
    if (!lib) return null;
    try {
      lib.init(config.key, {
        api_host: config.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        disable_session_recording: true,
        person_profiles: 'identified_only',
        opt_out_capturing_by_default: true,
        // Memory persistence until consent: no cookies or localStorage written.
        persistence: 'memory',
        loaded(ph: PostHogLike) {
          if (import.meta.env.DEV) {
            console.debug('[posthog] ready at', config.host, 'id:', ph.get_distinct_id());
          }
        },
      });
      setCachedPostHogInstance(lib);
      return lib;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[posthog] init failed', err);
      clearInitPromise();
      return null;
    }
  })();

  setInitPromise(promise);
  return promise;
}

export function createPostHogSink(config: AnalyticsConfig): AnalyticsSink {
  if (!config.isValid || typeof window === 'undefined') {
    if (import.meta.env.DEV) {
      console.debug('[posthog-sink] disabled –', config.reason);
    }
    return { start: () => {}, capture: () => {}, identify: () => {}, reset: () => {}, setConsent: () => {}, stop: () => {} };
  }

  let consentGranted = false;
  let clientReady = false;
  const pendingCaptures: ApprovedGrowthEvent[] = [];

  async function flushQueue(ph: PostHogLike): Promise<void> {
    const queued = pendingCaptures.splice(0);
    for (const event of queued) {
      ph.capture(event.name, event.properties ?? {});
    }
  }

  return {
    start(_context: AnalyticsContext) {},

    capture(event: ApprovedGrowthEvent) {
      if (!consentGranted) return;
      if (!clientReady) { pendingCaptures.push(event); return; }
      void getPostHogClient(config).then((ph) => {
        if (ph) ph.capture(event.name, event.properties ?? {});
      });
    },

    identify(identity: AnalyticsIdentity) {
      if (!consentGranted) return;
      void getPostHogClient(config).then((ph) => { if (ph) ph.identify(identity.userId); });
    },

    reset() {
      consentGranted = false;
      clientReady = false;
      pendingCaptures.length = 0;
      void getPostHogClient(config).then((ph) => {
        if (ph) { ph.opt_out_capturing(); ph.reset(); }
      });
    },

    async setConsent(consent: AnalyticsConsent) {
      consentGranted = consent.granted;
      if (!consent.granted) {
        clientReady = false;
        pendingCaptures.length = 0;
        void getPostHogClient(config).then((ph) => {
          if (ph) { ph.opt_out_capturing(); ph.reset(); }
        });
        return;
      }
      const ph = await getPostHogClient(config);
      if (!ph) return;
      ph.opt_in_capturing();
      clientReady = true;
      await flushQueue(ph);
    },

    stop() {
      consentGranted = false;
      clientReady = false;
      void getPostHogClient(config).then((ph) => { if (ph) ph.opt_out_capturing(); });
    },
  };
}
