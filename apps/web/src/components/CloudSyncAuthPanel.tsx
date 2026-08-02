import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AuthProvider, AuthSession, SocialProviderId } from '../core/contracts/auth';
import { supportsEmailConfirmation, supportsPasswordAuth, supportsSocialAuth } from '../core/contracts/auth';
import { getEnabledSocialProviders, type SocialProviderDefinition } from '../config/authProviders';

function safeAuthErrorDetail(error: unknown) {
  return error instanceof Error ? error.message.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
}

function friendlyAuthError(error: unknown) {
  const detail = safeAuthErrorDetail(error);
  if (/network|fetch|offline/i.test(detail)) return 'We could not reach secure sign-in. Check your connection and try again.';
  if (/signups?.*(?:disabled|not allowed)|email.*signups?.*(?:disabled|not allowed)/i.test(detail)) return 'Email account creation is disabled in this Supabase project. Enable Authentication → Providers → Email, then try again.';
  if (/redirect.*(?:not allowed|not permitted|not whitelisted)|redirect_to/i.test(detail)) return 'This app URL is not allowed for authentication yet. Add this exact local callback URL to Supabase Redirect URLs: http://localhost:5173/auth/callback.';
  if (/rate limit|too many requests|email.*(?:rate|limit)/i.test(detail)) return 'Too many email requests were made recently. Wait a moment before trying again, or use a configured sign-in provider.';
  if (/smtp|email.*(?:send|delivery)|mailer/i.test(detail)) return 'Supabase could not send email for this project. Check the project email provider or SMTP configuration, then try again.';
  if (/invalid api key|invalid.*apikey|api key.*invalid/i.test(detail)) return 'The Supabase publishable key is not accepted by this project. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the app.';
  if (/project.*not found|invalid.*project/i.test(detail)) return 'The configured Supabase project could not be reached. Check VITE_SUPABASE_URL, then restart the app.';
  if (/invalid login credentials|invalid credentials/i.test(detail)) return 'That email and password do not match. Check both and try again.';
  if (/email not confirmed/i.test(detail)) return 'Confirm your email using the message we sent, then sign in again.';
  if (/already registered|already been registered|user already registered/i.test(detail)) return 'An account already uses this email. Choose “Sign in” instead.';
  if (/password.*(?:six|6)|at least 6/i.test(detail)) return 'Choose a password with at least 6 characters, then try again.';
  if (/provider|unsupported/i.test(detail)) return 'That sign-in option is not available right now. Choose another option or try again later.';
  return detail
    ? `Supabase could not complete this request: ${detail}`
    : 'We could not complete sign-in. Please try again or choose another method.';
}

function logAuthFailure(operation: string, error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  console.error('[Task-Laureate auth] Request failed.', {
    operation,
    message: safeAuthErrorDetail(error) || 'No error message was provided.',
    status: candidate?.status,
    code: candidate?.code,
  });
}

function SocialProviderButton({ provider, busy, onSelect }: {
  provider: SocialProviderDefinition;
  busy: SocialProviderId | 'password' | 'confirmation' | null;
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
export function CloudSyncAuthPanel({ provider, returnTo, presentation = 'default', onAuthenticated }: {
  provider: AuthProvider;
  returnTo?: string;
  presentation?: 'default' | 'embedded';
  /** Optional owner-controlled transition after password sign-in completes. */
  onAuthenticated?: (session: AuthSession) => void | Promise<void>;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<SocialProviderId | 'password' | 'confirmation' | null>(null);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'status' | 'error'>('status');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const enabledProviders = useMemo(() => getEnabledSocialProviders(), []);
  const declaredPrimaryProviders = enabledProviders.filter((candidate) => candidate.tier === 'primary').slice(0, 3);
  // A deployment with only GitHub (or another additional provider) should not
  // make a person open an empty-feeling disclosure just to sign in.
  const primaryProviders = declaredPrimaryProviders.length > 0 ? declaredPrimaryProviders : enabledProviders.slice(0, 3);
  const additionalProviders = enabledProviders.filter((candidate) => !primaryProviders.some((primary) => primary.id === candidate.id));

  useEffect(() => {
    if (!provider.configured) return;
    void provider.getSession().then(setSession).catch(() => {
      setMessageKind('error');
      setMessage('We could not check your sign-in status. Please refresh and try again.');
    });
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
    setMessageKind('status');
    try {
      await provider.signInWithOAuth({ provider: socialProvider, returnTo });
    } catch (error) {
      logAuthFailure(`oauth:${socialProvider}`, error);
      setMessageKind('error');
      setMessage(friendlyAuthError(error));
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supportsPasswordAuth(provider)) return;
    setBusy('password');
    setMessage('');
    setMessageKind('status');
    try {
      const nextSession = mode === 'sign-in'
        ? await provider.signIn({ email, password })
        : await provider.signUp({ email, password });
      setPassword('');
      if (mode === 'sign-up' && !nextSession) {
        setConfirmationEmail(email.trim());
        setMessage('Your account needs email confirmation before it can sign in.');
        return;
      }
      if (!nextSession) {
        setMessage('We could not create a session. Please try again.');
        return;
      }
      setMessage('Signed in. Opening your private workspace…');
      await onAuthenticated?.(nextSession);
    } catch (error) {
      logAuthFailure(mode === 'sign-up' ? 'email-sign-up' : 'email-sign-in', error);
      setMessageKind('error');
      setMessage(friendlyAuthError(error));
    } finally { setBusy(null); }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail || !supportsEmailConfirmation(provider)) return;
    setBusy('confirmation');
    setMessageKind('status');
    setMessage('Sending another confirmation email…');
    try {
      await provider.resendSignupConfirmation({ email: confirmationEmail });
      setMessage('If this account is waiting for confirmation, a fresh email is on its way. Check spam or promotions too.');
    } catch (error) {
      logAuthFailure('resend-signup-confirmation', error);
      setMessageKind('error');
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
      setMessageKind('error');
      setMessage('We could not sign you out on this device. Please try again.');
    } finally { setBusy(null); }
  };

  return <section className="supabase-auth-panel" aria-labelledby={presentation === 'default' ? 'cloud-sync-title' : undefined} aria-label={presentation === 'embedded' ? 'Sign-in options' : undefined}>
    {presentation === 'default' ? <h2 id="cloud-sync-title">Private cloud sync</h2> : null}
    {session ? <><p>Signed in as <strong>{session.user.email ?? session.user.id}</strong>{session.user.provider ? ` with ${session.user.provider}` : ''}. Your session refreshes automatically.</p>
      <button className="secondary-button" type="button" onClick={() => void signOut()} disabled={busy !== null}>Sign out</button></> : <>
      {confirmationEmail ? <EmailConfirmationState
        email={confirmationEmail}
        canResend={supportsEmailConfirmation(provider)}
        isResending={busy === 'confirmation'}
        onResend={() => void resendConfirmation()}
        onUseAnotherEmail={() => { setConfirmationEmail(null); setMode('sign-up'); setMessage(''); }}
        onSignIn={() => { setConfirmationEmail(null); setMode('sign-in'); setMessage(''); }}
      /> : <>
      {presentation === 'default' ? <p>Continue with an account you already use. Task-Laureate never receives your provider password.</p> : null}
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
      {supportsPasswordAuth(provider) ? presentation === 'embedded' ? <EmailAuthForm
        mode={mode} email={email} password={password} showPassword={showPassword} busy={busy !== null}
        onModeChange={setMode} onEmailChange={setEmail} onPasswordChange={setPassword} onShowPasswordChange={setShowPassword}
        onSubmit={submit}
      /> : <details className="supabase-auth-email-fallback">
        <summary>Use email and password</summary>
        <EmailAuthForm
          mode={mode} email={email} password={password} showPassword={showPassword} busy={busy !== null}
          onModeChange={setMode} onEmailChange={setEmail} onPasswordChange={setPassword} onShowPasswordChange={setShowPassword}
          onSubmit={submit}
        />
      </details> : null}
      </>}
    </>}
    {message && <p className={`supabase-auth-message supabase-auth-message--${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</p>}
  </section>;
}

function EmailConfirmationState({ email, canResend, isResending, onResend, onUseAnotherEmail, onSignIn }: {
  email: string;
  canResend: boolean;
  isResending: boolean;
  onResend: () => void;
  onUseAnotherEmail: () => void;
  onSignIn: () => void;
}) {
  return <section className="email-confirmation" aria-labelledby="confirmation-title">
    <p className="email-confirmation__eyebrow">One last step</p>
    <h3 id="confirmation-title">Confirm your email</h3>
    <p>Open the confirmation link sent to <strong>{email}</strong>. It will securely return you to your private workspace.</p>
    <ol><li>Check your inbox, spam, and promotions folders.</li><li>Open the newest Task-Laureate confirmation email.</li><li>Return here only if you need to sign in again.</li></ol>
    <div className="email-confirmation__actions">
      {canResend ? <button className="secondary-button" type="button" onClick={onResend} disabled={isResending}>{isResending ? 'Sending…' : 'Resend confirmation email'}</button> : null}
      <button className="text-button" type="button" onClick={onSignIn}>I already confirmed</button>
      <button className="text-button" type="button" onClick={onUseAnotherEmail}>Use a different email</button>
    </div>
  </section>;
}

function EmailAuthForm({ mode, email, password, showPassword, busy, onModeChange, onEmailChange, onPasswordChange, onShowPasswordChange, onSubmit }: {
  mode: 'sign-in' | 'sign-up';
  email: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  onModeChange: (mode: 'sign-in' | 'sign-up') => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onShowPasswordChange: (show: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const isSignUp = mode === 'sign-up';
  return <form className="supabase-auth-form" onSubmit={(event) => void onSubmit(event)}>
    <div className="email-auth__mode" role="group" aria-label="Email account action">
      <button className={mode === 'sign-in' ? 'is-selected' : ''} type="button" aria-pressed={mode === 'sign-in'} onClick={() => onModeChange('sign-in')} disabled={busy}>Sign in</button>
      <button className={isSignUp ? 'is-selected' : ''} type="button" aria-pressed={isSignUp} onClick={() => onModeChange('sign-up')} disabled={busy}>Create account</button>
    </div>
    <p className="email-auth__intro">{isSignUp ? 'Create a private workspace with your email. We will ask you to confirm it before your first sign-in.' : 'Use the email and password already connected to your private workspace.'}</p>
    <label htmlFor="auth-email">Email address
      <input id="auth-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => onEmailChange(event.target.value)} disabled={busy} aria-describedby="auth-email-hint" required />
    </label>
    <span id="auth-email-hint" className="email-auth__hint">Use an address you can access.</span>
    <label htmlFor="auth-password">Password
      <span className="email-auth__password-wrap"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={(event) => onPasswordChange(event.target.value)} disabled={busy} aria-describedby="auth-password-hint" required />
      <button type="button" onClick={() => onShowPasswordChange(!showPassword)} disabled={busy} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></span>
    </label>
    <span id="auth-password-hint" className="email-auth__hint">{isSignUp ? 'At least 6 characters.' : 'Your password is never displayed unless you choose Show.'}</span>
    <button className="primary-button email-auth__submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isSignUp ? 'Create private account' : 'Sign in and sync'}</button>
  </form>;
}
