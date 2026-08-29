import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

describe('feature flags', () => {
  it('uses explicit browser environment names for camel-case flags', async () => {
    vi.stubEnv('VITE_FEATURE_AI_DECOMPOSITION', 'true');
    vi.resetModules();
    const { isFeatureEnabled } = await import('./featureFlags');
    expect(isFeatureEnabled('aiDecomposition')).toBe(true);
  });

  it('keeps AI disabled unless explicitly enabled', async () => {
    vi.stubEnv('VITE_FEATURE_AI_DECOMPOSITION', 'false');
    vi.resetModules();
    const { isFeatureEnabled } = await import('./featureFlags');
    expect(isFeatureEnabled('aiDecomposition')).toBe(false);
  });

  it('keeps calendar scheduling disabled until an environment explicitly enables it', async () => {
    vi.stubEnv('VITE_FEATURE_CALENDAR_INTEGRATION', 'true');
    vi.resetModules();
    const { isFeatureEnabled } = await import('./featureFlags');
    expect(isFeatureEnabled('calendarIntegration')).toBe(true);
  });
});
