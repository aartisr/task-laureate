/** Provider-neutral authentication boundary used by UI and persistence. */
export interface AuthSession {
  user: { id: string; email?: string | null; provider?: string | null };
  accessToken: string;
}

export interface AuthProvider {
  readonly configured: boolean;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
}

export interface PasswordAuthProvider extends AuthProvider {
  signIn(credentials: { email: string; password: string }): Promise<AuthSession | null>;
  signUp(credentials: { email: string; password: string }): Promise<AuthSession | null>;
}

/** Optional capability for email providers that require a post-signup confirmation. */
export interface EmailConfirmationAuthProvider extends AuthProvider {
  resendSignupConfirmation(input: { email: string }): Promise<void>;
}

export type SocialProviderId =
  | 'google' | 'azure' | 'apple' | 'github' | 'facebook'
  | 'linkedin_oidc' | 'gitlab' | 'slack' | 'discord' | `custom:${string}`;

export interface AuthIdentity {
  id: string;
  provider: string;
  email?: string | null;
  createdAt?: string;
  lastSignInAt?: string;
}

/** Optional capability: adapters may provide OAuth/OIDC sign-in without passwords. */
export interface SocialAuthProvider extends AuthProvider {
  signInWithOAuth(input: { provider: SocialProviderId; returnTo?: string }): Promise<void>;
  completeOAuthCallback(): Promise<AuthSession>;
  getIdentities(): Promise<AuthIdentity[]>;
  linkIdentity(provider: SocialProviderId): Promise<void>;
  unlinkIdentity(identityId: string): Promise<void>;
}

export function supportsPasswordAuth(provider: AuthProvider): provider is PasswordAuthProvider {
  return 'signIn' in provider && 'signUp' in provider;
}

export function supportsEmailConfirmation(provider: AuthProvider): provider is EmailConfirmationAuthProvider {
  return 'resendSignupConfirmation' in provider;
}

export function supportsSocialAuth(provider: AuthProvider): provider is SocialAuthProvider {
  return 'signInWithOAuth' in provider && 'completeOAuthCallback' in provider;
}
