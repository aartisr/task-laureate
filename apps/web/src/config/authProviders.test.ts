import { describe, expect, it } from 'vitest';
import { getEnabledSocialProviders, isKnownSocialProvider } from './authProviders';

describe('social provider registry', () => {
  it('returns only known, unique providers in configured order', () => {
    expect(getEnabledSocialProviders('google, custom:yahoo,google,unknown,azure')).toEqual([
      { id: 'google', label: 'Google', tier: 'primary', mark: 'google' },
      { id: 'custom:yahoo', label: 'Yahoo', tier: 'additional', mark: 'yahoo' },
      { id: 'azure', label: 'Microsoft', tier: 'primary', mark: 'microsoft' },
    ]);
  });

  it('accepts friendly aliases and deliberately named generic OIDC providers', () => {
    expect(getEnabledSocialProviders('microsoft,linkedin,yahoo,custom:acme|Acme SSO', 'microsoft,custom:acme')).toEqual([
      { id: 'azure', label: 'Microsoft', tier: 'primary', mark: 'microsoft' },
      { id: 'linkedin_oidc', label: 'LinkedIn', tier: 'additional', mark: 'linkedin' },
      { id: 'custom:yahoo', label: 'Yahoo', tier: 'additional', mark: 'yahoo' },
      { id: 'custom:acme', label: 'Acme SSO', tier: 'primary', mark: 'custom' },
    ]);
  });

  it('fails closed when no public provider configuration is present', () => {
    expect(getEnabledSocialProviders('')).toEqual([]);
    expect(getEnabledSocialProviders('unknown,not-a-provider')).toEqual([]);
  });

  it('recognizes supported built-in and custom provider identifiers', () => {
    expect(isKnownSocialProvider('google')).toBe(true);
    expect(isKnownSocialProvider('custom:yahoo')).toBe(true);
    expect(isKnownSocialProvider('custom:unconfigured')).toBe(true);
    expect(isKnownSocialProvider('custom:invalid!')).toBe(false);
  });
});
