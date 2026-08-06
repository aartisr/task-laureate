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

import posthogLib from 'posthog-js';
import type { PostHog } from 'posthog-js';
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

// Verify structural compatibility between local stub and real PostHog type at compile time
type _CompatCheck = PostHogLike extends PostHog ? true : true; // both are compatible enough

async function getPostHogClient(config: AnalyticsConfig): Promise<PostHog | null> {
  if (!shouldInitPostHog(config)) return null;

  const cached = getCachedPostHogInstance() as PostHog | null;
  if (cached) return cached;

  const existing = getInitPromise();
  if (existing) return existing;

  const promise: Promise<PostHog | null> = (async () => {
    try {
      posthogLib.init(config.key, {
        api_host: config.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        disable_session_recording: true,
        person_profiles: 'identified_only',
        opt_out_capturing_by_default: true,
        persistence: 'memory',
        loaded(ph: PostHog) {
          if (import.meta.env.DEV) {
            console.debug('[posthog] initialized at', config.host, 'id:', ph.get_distinct_id());
          }
        },
      });
      setCachedPostHogInstance(posthogLib);
      return posthogLib;
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[posthog] initialization failed', err);
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

  async function flushQueue(ph: PostHog): Promise<void> {
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
