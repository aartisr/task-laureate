/**
 * Vendor-neutral analytics dispatcher.
 *
 * Product features call trackGrowthEvent(); they never know which vendor receives it.
 * The dispatcher fans out to every registered AnalyticsSink with per-sink error isolation
 * so one broken vendor can never affect another or any product behaviour.
 *
 * Composition (in analyticsSetup.ts):
 *
 *   const dispatcher = createAnalyticsDispatcher([
 *     createPostHogSink(config),   // PostHog Cloud, EU, or self-hosted
 *     createNoopSink(),            // add more vendors here
 *   ]);
 *   registerAnalyticsDispatcher(dispatcher);
 */

import type { GrowthEventName } from './growthTelemetry';

type SafeProperty = string | number | boolean | null;

export interface ApprovedGrowthEvent {
  readonly name: GrowthEventName;
  readonly properties?: Record<string, SafeProperty>;
  readonly occurredAt: string;
}

/** Passed to start() so sinks can tag events with build context */
export interface AnalyticsContext {
  readonly environment?: 'production' | 'preview' | 'development';
  readonly appVersion?: string;
}

/** Stable Supabase user.id only – never email, display name, or phone */
export interface AnalyticsIdentity {
  readonly userId: string;
}

export interface AnalyticsConsent {
  readonly granted: boolean;
  readonly version: number;
}

/** Contract every analytics vendor must implement */
export interface AnalyticsSink {
  /** Called once on app startup. May be async (PostHog lazy-init). */
  start(context: AnalyticsContext): void | Promise<void>;
  /** Forward a privacy-filtered growth event */
  capture(event: ApprovedGrowthEvent): void;
  /** Associate subsequent events with the authenticated user */
  identify(identity: AnalyticsIdentity): void;
  /** Disassociate identity – must be called immediately after logout */
  reset(): void;
  /** React to the user's consent decision */
  setConsent(consent: AnalyticsConsent): void;
  /** Called on app teardown / before page unload if needed */
  stop(): void;
}

export interface AnalyticsDispatcher {
  start(context: AnalyticsContext): Promise<void>;
  capture(event: ApprovedGrowthEvent): void;
  identify(identity: AnalyticsIdentity): void;
  reset(): void;
  setConsent(consent: AnalyticsConsent): void;
  stop(): void;
}

/** Per-sink error boundary: logs in dev, swallows in production */
function guarded(label: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.warn(`[analytics] ${label}`, err);
        }
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[analytics] ${label}`, err);
    }
  }
}

export function createAnalyticsDispatcher(sinks: readonly AnalyticsSink[]): AnalyticsDispatcher {
  return {
    async start(context) {
      await Promise.allSettled(
        sinks.map((sink, i) =>
          new Promise<void>((resolve) => {
            guarded(`sink[${i}].start`, () => {
              const r = sink.start(context);
              if (r instanceof Promise) return r.then(resolve, resolve);
              resolve();
            });
          }),
        ),
      );
    },

    capture(event) {
      sinks.forEach((sink, i) => guarded(`sink[${i}].capture(${event.name})`, () => sink.capture(event)));
    },

    identify(identity) {
      sinks.forEach((sink, i) => guarded(`sink[${i}].identify`, () => sink.identify(identity)));
    },

    reset() {
      sinks.forEach((sink, i) => guarded(`sink[${i}].reset`, () => sink.reset()));
    },

    setConsent(consent) {
      sinks.forEach((sink, i) => guarded(`sink[${i}].setConsent`, () => sink.setConsent(consent)));
    },

    stop() {
      sinks.forEach((sink, i) => guarded(`sink[${i}].stop`, () => sink.stop()));
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton application dispatcher
// ---------------------------------------------------------------------------

let _dispatcher: AnalyticsDispatcher | null = null;

/**
 * Returns the registered dispatcher, or a safe no-op fallback.
 * The fallback protects against modules that import trackGrowthEvent before
 * AppProviders has had a chance to call registerAnalyticsDispatcher().
 */
export function getAnalyticsDispatcher(): AnalyticsDispatcher {
  if (_dispatcher) return _dispatcher;
  // Lazy fallback – allocate once
  _dispatcher = createAnalyticsDispatcher([]);
  return _dispatcher;
}

/** Called once from analyticsSetup during app bootstrap */
export function registerAnalyticsDispatcher(dispatcher: AnalyticsDispatcher): void {
  _dispatcher = dispatcher;
}

/** Reset the singleton – used in tests only */
export function _resetDispatcherForTest(): void {
  _dispatcher = null;
}
