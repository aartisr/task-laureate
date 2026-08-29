import type { SocialProviderId } from '../core/contracts/auth';

export type SocialProviderTier = 'primary' | 'additional';
export type SocialProviderMark = 'google' | 'microsoft' | 'apple' | 'github' | 'facebook' | 'linkedin' | 'gitlab' | 'slack' | 'discord' | 'yahoo' | 'custom';

export interface SocialProviderDefinition {
  id: SocialProviderId;
  label: string;
  tier: SocialProviderTier;
  mark: SocialProviderMark;
}

/**
 * Public presentation registry only. Supabase owns provider enablement and
 * secrets; this registry never makes a disabled provider available by itself.
 */
const PROVIDERS: readonly SocialProviderDefinition[] = [
  { id: 'google', label: 'Google', tier: 'primary', mark: 'google' },
  { id: 'azure', label: 'Microsoft', tier: 'primary', mark: 'microsoft' },
  { id: 'apple', label: 'Apple', tier: 'primary', mark: 'apple' },
  { id: 'github', label: 'GitHub', tier: 'additional', mark: 'github' },
  { id: 'facebook', label: 'Facebook', tier: 'additional', mark: 'facebook' },
  { id: 'linkedin_oidc', label: 'LinkedIn', tier: 'additional', mark: 'linkedin' },
  { id: 'gitlab', label: 'GitLab', tier: 'additional', mark: 'gitlab' },
  { id: 'slack', label: 'Slack', tier: 'additional', mark: 'slack' },
  { id: 'discord', label: 'Discord', tier: 'additional', mark: 'discord' },
  { id: 'custom:yahoo', label: 'Yahoo', tier: 'additional', mark: 'yahoo' },
];

const providerById = new Map(PROVIDERS.map((provider) => [provider.id, provider]));
const aliases = new Map<string, SocialProviderId>([
  ['microsoft', 'azure'],
  ['linkedin', 'linkedin_oidc'],
  ['yahoo', 'custom:yahoo'],
]);
const customProviderId = /^custom:[a-z0-9][a-z0-9:-]{1,43}$/;

function normalizeId(value: string): SocialProviderId | null {
  const id = value.trim().toLowerCase();
  const knownId = aliases.get(id) ?? id;
  if (providerById.has(knownId as SocialProviderId) || customProviderId.test(knownId)) return knownId as SocialProviderId;
  return null;
}

function toDefinition(value: string): SocialProviderDefinition | null {
  const [rawId, rawLabel] = value.split('|', 2);
  const id = normalizeId(rawId ?? '');
  if (!id) return null;
  const known = providerById.get(id);
  if (known) return known;
  const label = rawLabel?.trim().slice(0, 60);
  // Generic OIDC/OAuth providers must be deliberately named in public config.
  // This keeps an opaque "custom" button out of the login experience.
  if (!label) return null;
  return { id, label, tier: 'additional', mark: 'custom' };
}

function parseIds(raw: string | undefined) {
  return new Set((raw ?? '').split(',').map((value) => normalizeId(value.split('|', 1)[0] ?? '')).filter((id): id is SocialProviderId => Boolean(id)));
}

/**
 * Enable buttons with a public value such as:
 * VITE_AUTH_PROVIDERS=google,microsoft,github,custom:yahoo,custom:acme|Acme SSO
 *
 * `VITE_AUTH_PRIMARY_PROVIDERS` is optional. It lets each deployment choose
 * up to three familiar first-choice providers without duplicating UI logic.
 */
export function getEnabledSocialProviders(
  raw: string | undefined = import.meta.env.VITE_AUTH_PROVIDERS,
  primaryRaw: string | undefined = import.meta.env.VITE_AUTH_PRIMARY_PROVIDERS,
): SocialProviderDefinition[] {
  const seen = new Set<string>();
  const configuredPrimary = parseIds(primaryRaw);
  return (raw ?? '').split(',')
    .map(toDefinition)
    .filter((provider): provider is SocialProviderDefinition => Boolean(provider))
    .filter((provider) => !seen.has(provider.id) && (seen.add(provider.id), true))
    .map((provider) => ({
      ...provider,
      tier: configuredPrimary.size > 0
        ? (configuredPrimary.has(provider.id) ? 'primary' : 'additional')
        : provider.tier,
    }));
}

export function isKnownSocialProvider(provider: string): provider is SocialProviderId {
  return normalizeId(provider) !== null;
}
