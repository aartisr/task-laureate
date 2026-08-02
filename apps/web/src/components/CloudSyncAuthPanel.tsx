import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AuthProvider, AuthSession, SocialProviderId } from '../core/contracts/auth';
import { supportsPasswordAuth, supportsSocialAuth } from '../core/contracts/auth';
import { getEnabledSocialProviders, type SocialProviderDefinition } from '../config/authProviders';

function friendlyAuthError(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (/network|fetch|offline/i.test(detail)) return 'We could not reach secure sign-in. Check your connection and try again.';
  if (/provider|unsupported/i.test(detail)) return 'That sign-in option is not available right now. Choose another option or try again later.';
  return 'We could not complete sign-in. Please try again or choose another method.';
}

function SocialProviderButton({ provider, busy, onSelect }: {
  provider: SocialProviderDefinition;
  busy: SocialProviderId | 'password' | null;
  onSelect: (provider: SocialProviderId) => void;
}) {
  const isBusy = busy === provider.id;
  return <button
    type="button"
    className="social-auth-options__button"
    onClick={() => onSelect(provider.id)}
    disabled={busy !== null}
  >
    <span className={`social-auth-options__mark social-auth-options__mark--${provider.mark}`} aria-hidden="true">{provider.label.slice(0, 1)}</span>
    <span>{isBusy ? `Connecting to ${provider.label}…` : `Continue with ${provider.label}`}</span>
  </button>;
}

/**
 * Provider-neutral account UI. It knows only capabilities and public provider
 * display data; Supabase/client-secret/protocol details remain in the adapter.
 */
export function CloudSyncAuthPanel({ provider, returnTo }: { provider: AuthProvider; returnTo?: string }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [busy, setBusy] = useState<SocialProviderId | 'password' | null>(null);
  const [message, setMessage] = useState('');
  const enabledProviders = useMemo(() => getEnabledSocialProviders(), []);
  const declaredPrimaryProviders = enabledProviders.filter((candidate) => candidate.tier === 'primary').slice(0, 3);
  // A deployment with only GitHub (or another additional provider) should not
  // make a person open an empty-feeling disclosure just to sign in.
  const primaryProviders = declaredPrimaryProviders.length > 0 ? declaredPrimaryProviders : enabledProviders.slice(0, 3);
  const additionalProviders = enabledProviders.filter((candidate) => !primaryProviders.some((primary) => primary.id === candidate.id));

  useEffect(() => {
    if (!provider.configured) return;
    void provider.getSession().then(setSession).catch(() => setMessage('We could not check your sign-in status. Please refresh and try again.'));
    return provider.subscribe((nextSession) => {
      setSession(nextSession);
    });
  }, [provider]);

  if (!provider.configured) return <section className="supabase-auth-panel" aria-labelledby="cloud-sync-title">
    <h2 id="cloud-sync-title">Cloud sync is not configured</h2>
    <p>Add your Supabase URL and publishable key to <code>apps/web/.env.local</code>, then restart the app.</p>
  </section>;

  const signInWithProvider = async (socialProvider: SocialProviderId) => {
    if (!supportsSocialAuth(provider)) return;
    setBusy(socialProvider);
    setMessage('');
    try {
      await provider.signInWithOAuth({ provider: socialProvider, returnTo });
    } catch (error) {
      console.error('[Task-Laureate auth] OAuth sign-in could not start.', { provider: socialProvider });
      setMessage(friendlyAuthError(error));
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supportsPasswordAuth(provider)) return;
    setBusy('password');
    setMessage('');
    try {
      const nextSession = mode === 'sign-in'
        ? await provider.signIn({ email, password })
        : await provider.signUp({ email, password });
      setPassword('');
      setMessage(mode === 'sign-up' && !nextSession
        ? 'Check your email to confirm your account, then return here to sign in.'
        : 'Signed in. Connecting your private workspace…');
    } catch (error) {
      console.error('[Task-Laureate auth] Password authentication failed.');
      setMessage(friendlyAuthError(error));
    } finally { setBusy(null); }
  };

  const signOut = async () => {
    setBusy('password');
    try {
      await provider.signOut();
      setMessage('Signed out. Cloud sync has stopped on this device.');
    } catch (error) {
      console.error('[Task-Laureate auth] Sign-out failed.');
      setMessage('We could not sign you out on this device. Please try again.');
    } finally { setBusy(null); }
  };

  return <section className="supabase-auth-panel" aria-labelledby="cloud-sync-title">
    <h2 id="cloud-sync-title">Private cloud sync</h2>
    {session ? <><p>Signed in as <strong>{session.user.email ?? session.user.id}</strong>{session.user.provider ? ` with ${session.user.provider}` : ''}. Your session refreshes automatically.</p>
      <button className="secondary-button" type="button" onClick={() => void signOut()} disabled={busy !== null}>Sign out</button></> : <>
      <p>Continue with an account you already use. Task-Laureate never receives your provider password.</p>
      {supportsSocialAuth(provider) && enabledProviders.length > 0 ? <div className="social-auth-options" aria-label="Sign in with an existing account">
        {primaryProviders.length > 0 ? <div className="social-auth-options__primary">
          {primaryProviders.map((socialProvider) => <SocialProviderButton key={socialProvider.id} provider={socialProvider} busy={busy} onSelect={(id) => void signInWithProvider(id)} />)}
        </div> : null}
        {additionalProviders.length > 0 ? <details className="social-auth-options__more">
          <summary><span>More sign-in options</span><small>{additionalProviders.length} available</small></summary>
          <div className="social-auth-options__more-list">
            {additionalProviders.map((socialProvider) => <SocialProviderButton key={socialProvider.id} provider={socialProvider} busy={busy} onSelect={(id) => void signInWithProvider(id)} />)}
          </div>
        </details> : null}
      </div> : null}
      {supportsPasswordAuth(provider) ? <details className="supabase-auth-email-fallback">
        <summary>Continue with email instead</summary>
        <form className="supabase-auth-form" onSubmit={(event) => void submit(event)}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
          <div className="supabase-auth-actions"><button className="primary-button" type="submit" disabled={busy !== null}>{busy === 'password' ? 'Please wait…' : mode === 'sign-in' ? 'Sign in and sync' : 'Create account'}</button>
            <button className="secondary-button" type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} disabled={busy !== null}>{mode === 'sign-in' ? 'Create an account' : 'I already have an account'}</button></div>
        </form>
      </details> : null}
    </>}
    {message && <p className="supabase-auth-message" role="status">{message}</p>}
  </section>;
}
