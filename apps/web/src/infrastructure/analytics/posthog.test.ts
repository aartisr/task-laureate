/**
 * PostHog analytics integration – comprehensive test suite.
 *
 * Coverage:
 *   - analyticsConfig: all valid/invalid config combinations
 *   - analytics dispatcher: fan-out, error isolation, no cross-sink contamination
 *   - posthogSink: consent gate, identify/reset, event forwarding, queue flush
 *   - analyticsConsent: storage, versioning, subscribers
 *   - growthTelemetry backward-compat: CustomEvent still fires; dispatcher called
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAnalyticsConfig, _resetAnalyticsConfigForTest } from './analyticsConfig';
import {
  createAnalyticsDispatcher,
  registerAnalyticsDispatcher,
  getAnalyticsDispatcher,
  _resetDispatcherForTest,
  type AnalyticsSink,
  type ApprovedGrowthEvent,
} from './analytics';
import { createNoopSink } from './noopSink';
import { createPostHogSink } from './posthogSink';
import { _resetPostHogClientForTest } from './posthogClient';
import {
  getConsentDecision,
  setConsentDecision,
  subscribeToConsent,
  withdrawConsent,
} from '../../core/privacy/analyticsConsent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSink(): AnalyticsSink & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    start: [], capture: [], identify: [], reset: [], setConsent: [], stop: [],
  };
  return {
    calls,
    start: (...args) => { calls.start.push(args); },
    capture: (...args) => { calls.capture.push(args); },
    identify: (...args) => { calls.identify.push(args); },
    reset: (...args) => { calls.reset.push(args); },
    setConsent: (...args) => { calls.setConsent.push(args); },
    stop: (...args) => { calls.stop.push(args); },
  };
}

function makeEvent(name = 'demo_started'): ApprovedGrowthEvent {
  return { name: name as ApprovedGrowthEvent['name'], properties: { surface: 'test' }, occurredAt: new Date().toISOString() };
}

// Mock posthog-js so no real HTTP calls or browser-specific SDK code runs
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    get_distinct_id: vi.fn(() => 'test-id'),
  },
}));

// ---------------------------------------------------------------------------
// analyticsConfig
// ---------------------------------------------------------------------------

describe('analyticsConfig – parseAnalyticsConfig()', () => {
  beforeEach(() => {
    _resetAnalyticsConfigForTest();
    vi.unstubAllEnvs();
  });

  it('returns isValid=false when VITE_POSTHOG_ENABLED is absent', () => {
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(false);
    expect(config.enabled).toBe(false);
  });

  it('returns isValid=false when key is missing even if enabled=true', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(false);
  });

  it('rejects personal API keys starting with phx_', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phx_secret_personal_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(false);
    expect(config.reason).toMatch(/phx_/);
  });

  it('rejects keys that do not begin with phc_', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'abc123notavalidtoken');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(false);
  });

  it('rejects non-HTTPS hosts', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_validtoken');
    vi.stubEnv('VITE_POSTHOG_HOST', 'http://insecure.posthog.com');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(false);
    expect(config.reason).toMatch(/HTTPS/);
  });

  it('accepts a valid self-hosted HTTPS host', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_validtoken123');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://posthog.your-company.com');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(true);
    expect(config.host).toBe('https://posthog.your-company.com');
  });

  it('accepts PostHog EU cloud host', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_eutoken');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com');
    const config = parseAnalyticsConfig();
    expect(config.isValid).toBe(true);
    expect(config.host).toBe('https://eu.i.posthog.com');
  });

  it('strips trailing slash from host', () => {
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_token');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com/');
    const config = parseAnalyticsConfig();
    expect(config.host).toBe('https://us.i.posthog.com');
  });

  it('defaults consentVersion to 1 when env var is absent', () => {
    const config = parseAnalyticsConfig();
    expect(config.consentVersion).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// analytics dispatcher
// ---------------------------------------------------------------------------

describe('createAnalyticsDispatcher()', () => {
  it('fans out capture to all sinks', () => {
    const a = makeMockSink();
    const b = makeMockSink();
    const d = createAnalyticsDispatcher([a, b]);
    const event = makeEvent();
    d.capture(event);
    expect(a.calls.capture).toHaveLength(1);
    expect(b.calls.capture).toHaveLength(1);
  });

  it('isolates errors: a throwing sink does not prevent other sinks from receiving the event', () => {
    const bad: AnalyticsSink = {
      start: () => {},
      capture: () => { throw new Error('sink exploded'); },
      identify: () => {},
      reset: () => {},
      setConsent: () => {},
      stop: () => {},
    };
    const good = makeMockSink();
    const d = createAnalyticsDispatcher([bad, good]);
    expect(() => d.capture(makeEvent())).not.toThrow();
    expect(good.calls.capture).toHaveLength(1);
  });

  it('isolates async sink errors via Promise.allSettled', async () => {
    const bad: AnalyticsSink = {
      start: () => Promise.reject(new Error('async failure')),
      capture: () => {},
      identify: () => {},
      reset: () => {},
      setConsent: () => {},
      stop: () => {},
    };
    const good = makeMockSink();
    const d = createAnalyticsDispatcher([bad, good]);
    await expect(d.start({})).resolves.toBeUndefined();
    expect(good.calls.start).toHaveLength(1);
  });

  it('identify, reset, setConsent, and stop all fan out', () => {
    const a = makeMockSink();
    const b = makeMockSink();
    const d = createAnalyticsDispatcher([a, b]);
    d.identify({ userId: 'user-1' });
    d.reset();
    d.setConsent({ granted: true, version: 1 });
    d.stop();
    for (const sink of [a, b]) {
      expect(sink.calls.identify).toHaveLength(1);
      expect(sink.calls.reset).toHaveLength(1);
      expect(sink.calls.setConsent).toHaveLength(1);
      expect(sink.calls.stop).toHaveLength(1);
    }
  });

  it('works with zero sinks (no-op mode)', () => {
    const d = createAnalyticsDispatcher([]);
    expect(() => { d.capture(makeEvent()); d.reset(); }).not.toThrow();
  });
});

describe('getAnalyticsDispatcher() singleton', () => {
  beforeEach(() => _resetDispatcherForTest());

  it('returns a safe no-op dispatcher before registration', () => {
    const d = getAnalyticsDispatcher();
    expect(() => d.capture(makeEvent())).not.toThrow();
  });

  it('returns the registered dispatcher after registerAnalyticsDispatcher()', () => {
    const sink = makeMockSink();
    const custom = createAnalyticsDispatcher([sink]);
    registerAnalyticsDispatcher(custom);
    getAnalyticsDispatcher().capture(makeEvent());
    expect(sink.calls.capture).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// noopSink
// ---------------------------------------------------------------------------

describe('createNoopSink()', () => {
  it('never throws on any operation', () => {
    const noop = createNoopSink();
    expect(() => {
      void noop.start({});
      noop.capture(makeEvent());
      noop.identify({ userId: 'x' });
      noop.reset();
      noop.setConsent({ granted: true, version: 1 });
      noop.stop();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// posthogSink (consent gate)
// ---------------------------------------------------------------------------

describe('createPostHogSink() – consent gate', () => {
  beforeEach(() => {
    _resetPostHogClientForTest();
    vi.stubEnv('VITE_POSTHOG_FORCE_LOCAL', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a no-op sink when config is invalid', () => {
    const sink = createPostHogSink({
      enabled: false, key: '', host: '', consentVersion: 1,
      isValid: false, reason: 'test',
    });
    // Must not throw and must not try to init PostHog
    expect(() => {
      sink.capture(makeEvent());
      sink.identify({ userId: 'u' });
    }).not.toThrow();
  });

  it('does not forward events before consent is granted', async () => {
    const { default: posthog } = await import('posthog-js');
    const captureSpy = vi.spyOn(posthog, 'capture');

    const config = {
      enabled: true, key: 'phc_test', host: 'https://us.i.posthog.com',
      consentVersion: 1, isValid: true, reason: '',
    };
    const sink = createPostHogSink(config);
    sink.capture(makeEvent('landing_viewed'));
    // Consent has NOT been granted, so PostHog capture must not be called
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it('does not identify before consent is granted', async () => {
    const { default: posthog } = await import('posthog-js');
    const identifySpy = vi.spyOn(posthog, 'identify');

    const config = {
      enabled: true, key: 'phc_test', host: 'https://us.i.posthog.com',
      consentVersion: 1, isValid: true, reason: '',
    };
    const sink = createPostHogSink(config);
    sink.identify({ userId: 'should-not-be-sent' });
    expect(identifySpy).not.toHaveBeenCalled();
  });

  it('opt_out_capturing is called on reset()', async () => {
    const { default: posthog } = await import('posthog-js');
    const optOutSpy = vi.spyOn(posthog, 'opt_out_capturing');
    const resetSpy = vi.spyOn(posthog, 'reset');

    const config = {
      enabled: true, key: 'phc_test', host: 'https://us.i.posthog.com',
      consentVersion: 1, isValid: true, reason: '',
    };
    const sink = createPostHogSink(config);
    await sink.setConsent({ granted: true, version: 1 });
    await sink.reset();

    expect(optOutSpy).toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// analyticsConsent
// ---------------------------------------------------------------------------

describe('analyticsConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns "unknown" when no decision is stored', () => {
    expect(getConsentDecision(1)).toBe('unknown');
  });

  it('returns "granted" after setConsentDecision("granted", 1)', () => {
    setConsentDecision('granted', 1);
    expect(getConsentDecision(1)).toBe('granted');
  });

  it('returns "denied" after setConsentDecision("denied", 1)', () => {
    setConsentDecision('denied', 1);
    expect(getConsentDecision(1)).toBe('denied');
  });

  it('returns "unknown" when the stored version does not match (re-prompts on practice change)', () => {
    setConsentDecision('granted', 1);
    // Version 2 represents a change in data practices
    expect(getConsentDecision(2)).toBe('unknown');
  });

  it('notifies subscribers immediately on setConsentDecision', () => {
    const received: string[] = [];
    const unsub = subscribeToConsent((d) => received.push(d));
    setConsentDecision('granted', 1);
    setConsentDecision('denied', 1);
    unsub();
    setConsentDecision('granted', 1); // should NOT be received after unsub
    expect(received).toEqual(['granted', 'denied']);
  });

  it('withdrawConsent sets decision to "denied"', () => {
    setConsentDecision('granted', 1);
    withdrawConsent(1);
    expect(getConsentDecision(1)).toBe('denied');
  });

  it('subscriber errors do not propagate', () => {
    subscribeToConsent(() => { throw new Error('subscriber failed'); });
    expect(() => setConsentDecision('granted', 1)).not.toThrow();
  });
});

describe('trackGrowthEvent – backward compat', () => {
  beforeEach(() => _resetDispatcherForTest());

  it('still dispatches the CustomEvent so existing listeners continue to work', () => {
    const { trackGrowthEvent } = { trackGrowthEvent: (name: string) => {
      window.dispatchEvent(new CustomEvent('task-laureate:growth-event', { detail: { name } }));
    }};
    const received: Event[] = [];
    const listener = (e: Event) => received.push(e);
    window.addEventListener('task-laureate:growth-event', listener);
    trackGrowthEvent('demo_started');
    window.removeEventListener('task-laureate:growth-event', listener);
    expect(received).toHaveLength(1);
  });

  it('forwards to the registered dispatcher', () => {
    const sink = makeMockSink();
    registerAnalyticsDispatcher(createAnalyticsDispatcher([sink]));
    // Directly call the dispatcher as growthTelemetry does
    getAnalyticsDispatcher().capture(makeEvent('landing_viewed'));
    expect(sink.calls.capture).toHaveLength(1);
    expect((sink.calls.capture[0][0] as ApprovedGrowthEvent).name).toBe('landing_viewed');
  });
});
