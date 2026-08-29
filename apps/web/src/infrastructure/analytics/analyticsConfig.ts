/**
 * Analytics configuration – parsed and validated once from Vite env vars.
 *
 * VITE_POSTHOG_ENABLED          "true" to activate PostHog collection (default: off)
 * VITE_POSTHOG_KEY              PostHog project token – must begin with "phc_"
 * VITE_POSTHOG_HOST             Ingest host. Defaults to https://us.i.posthog.com
 *                               Point to your self-hosted PostHog or EU cloud:
 *                                 https://eu.i.posthog.com  – PostHog Cloud EU
 *                                 https://posthog.your-company.com – self-hosted
 * VITE_POSTHOG_CONSENT_VERSION  Integer (≥1). Bump when data practices change to
 *                               re-prompt users who previously made a decision.
 *
 * Never put phx_ personal API keys in VITE_* variables – they are public browser config.
 */

export interface AnalyticsConfig {
  readonly enabled: boolean;
  readonly key: string;
  readonly host: string;
  readonly consentVersion: number;
  /** true only when all conditions for live collection are met */
  readonly isValid: boolean;
  /** Human-readable explanation – safe to log in development */
  readonly reason: string;
}

const RE_PROJECT_TOKEN = /^phc_/;
const RE_PERSONAL_KEY = /^phx_/;
const RE_HTTPS = /^https:\/\/.+/;

export function parseAnalyticsConfig(): AnalyticsConfig {
  const enabled = import.meta.env.VITE_POSTHOG_ENABLED === 'true';
  const key = String(import.meta.env.VITE_POSTHOG_KEY ?? '').trim();
  const host = String(
    import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  ).trim().replace(/\/$/, ''); // strip trailing slash
  const rawVersion = Number(import.meta.env.VITE_POSTHOG_CONSENT_VERSION ?? '1');
  const consentVersion =
    Number.isInteger(rawVersion) && rawVersion > 0 ? rawVersion : 1;

  if (!enabled) {
    return { enabled, key, host, consentVersion, isValid: false, reason: 'VITE_POSTHOG_ENABLED is not "true"' };
  }
  if (!key) {
    return { enabled, key, host, consentVersion, isValid: false, reason: 'VITE_POSTHOG_KEY is missing' };
  }
  if (RE_PERSONAL_KEY.test(key)) {
    return { enabled, key, host, consentVersion, isValid: false, reason: 'VITE_POSTHOG_KEY must be a project token (phc_…), never a personal API key (phx_…)' };
  }
  if (!RE_PROJECT_TOKEN.test(key)) {
    return { enabled, key, host, consentVersion, isValid: false, reason: 'VITE_POSTHOG_KEY must begin with "phc_"' };
  }
  if (!RE_HTTPS.test(host)) {
    return { enabled, key, host, consentVersion, isValid: false, reason: 'VITE_POSTHOG_HOST must be an HTTPS URL' };
  }

  return { enabled, key, host, consentVersion, isValid: true, reason: 'Configuration valid' };
}

/** Stable singleton – parsed once to avoid repeated env lookups */
let _config: AnalyticsConfig | null = null;
export function getAnalyticsConfig(): AnalyticsConfig {
  if (!_config) _config = parseAnalyticsConfig();
  return _config;
}

/** Reset the singleton – used in tests only */
export function _resetAnalyticsConfigForTest(): void {
  _config = null;
}
