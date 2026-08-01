import { describe, expect, it } from 'vitest';
import { getEnabledSocialProviders, isKnownSocialProvider } from './authProviders';

describe('social provider registry', () => {
  it('returns only known, unique providers in configured order', () => {
    expect(getEnabledSocialProviders('google, custom:yahoo,google,unknown,azure')).toEqual([
      { id: 'google', label: 'Google', category: 'recommended' },
      { id: 'custom:yahoo', label: 'Yahoo', category: 'more' },
      { id: 'azure', label: 'Microsoft', category: 'recommended' },
    ]);
  });

  it('fails closed when no public provider configuration is present', () => {
    expect(getEnabledSocialProviders('')).toEqual([]);
    expect(getEnabledSocialProviders('unknown,not-a-provider')).toEqual([]);
  });

  it('recognizes supported built-in and custom provider identifiers', () => {
    expect(isKnownSocialProvider('google')).toBe(true);
    expect(isKnownSocialProvider('custom:yahoo')).toBe(true);
    expect(isKnownSocialProvider('custom:unconfigured')).toBe(false);
  });
});
