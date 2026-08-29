/**
 * Analytics composition root.
 *
 * This is the ONE place that wires sinks together and registers the application
 * dispatcher. Add or remove vendors here only – product features and tests are
 * unaffected because they call trackGrowthEvent() or getAnalyticsDispatcher().
 *
 * To switch vendors: replace createPostHogSink(config) with your new sink.
 * To add a second vendor: append it to the sinks array.
 * To disable all collection: remove all sinks or call this with an empty array.
 */

import { createAnalyticsDispatcher, registerAnalyticsDispatcher, getAnalyticsDispatcher } from './analytics';
import { createPostHogSink } from './posthogSink';
import { createNoopSink } from './noopSink';
import { getAnalyticsConfig } from './analyticsConfig';
import { getConsentDecision } from '../../core/privacy/analyticsConsent';
import type { AnalyticsContext } from './analytics';

let initialized = false;

export function initializeAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const config = getAnalyticsConfig();

  const sinks = config.isValid
    ? [createPostHogSink(config)]
    : [createNoopSink()];

  const dispatcher = createAnalyticsDispatcher(sinks);
  registerAnalyticsDispatcher(dispatcher);

  // Apply any previously-stored consent decision immediately, so the sink
  // is in the correct opt-in/opt-out state before the first event is captured.
  const storedDecision = getConsentDecision(config.consentVersion);
  dispatcher.setConsent({ granted: storedDecision === 'granted', version: config.consentVersion });

  const context: AnalyticsContext = {
    environment: import.meta.env.PROD ? 'production' : 'development',
  };
  void dispatcher.start(context);
}

/** Reset for tests – allows re-initialization with different config */
export function _resetAnalyticsSetupForTest(): void {
  initialized = false;
}

export { getAnalyticsDispatcher };
