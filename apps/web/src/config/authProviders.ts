import type { SocialProviderId } from '../core/contracts/auth';

export interface SocialProviderDefinition {
  id: SocialProviderId;
  label: string;
  category: 'recommended' | 'more';
}

/**
 * This client-side registry is intentionally limited to public display data.
 * Provider secrets and enablement live in Supabase Auth, never in Vite env.
 */
const PROVIDERS: readonly SocialProviderDefinition[] = [
  { id: 'google', label: 'Google', category: 'recommended' },
  { id: 'azure', label: 'Microsoft', category: 'recommended' },
  { id: 'apple', label: 'Apple', category: 'recommended' },
  { id: 'github', label: 'GitHub', category: 'recommended' },
  { id: 'facebook', label: 'Facebook', category: 'more' },
  { id: 'linkedin_oidc', label: 'LinkedIn', category: 'more' },
  { id: 'gitlab', label: 'GitLab', category: 'more' },
  { id: 'slack', label: 'Slack', category: 'more' },
  { id: 'discord', label: 'Discord', category: 'more' },
  { id: 'custom:yahoo', label: 'Yahoo', category: 'more' },
];

const providerById = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

/**
 * Enable buttons with a public, comma-separated Vite value such as
 * VITE_AUTH_PROVIDERS=google,azure,github,custom:yahoo.
 * An absent/invalid value deliberately yields no social buttons, preventing a
 * login option that has not been enabled in Supabase from reaching users.
 */
export function getEnabledSocialProviders(raw: string | undefined = import.meta.env.VITE_AUTH_PROVIDERS): SocialProviderDefinition[] {
  if (!raw) return [];
  const seen = new Set<string>();
  return raw.split(',')
    .map((provider) => provider.trim())
    .filter((id) => id.length > 0 && !seen.has(id) && (seen.add(id), true))
    .map((id) => providerById.get(id as SocialProviderId))
    .filter((provider): provider is SocialProviderDefinition => Boolean(provider));
}

export function isKnownSocialProvider(provider: string): provider is SocialProviderId {
  return providerById.has(provider as SocialProviderId);
}
