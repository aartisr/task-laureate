import { FormEvent, useEffect, useState } from 'react';
import type { AuthSession, PasswordAuthProvider } from '../core/contracts/auth';

/** Provider-neutral account UI. It can render any PasswordAuthProvider. */
export function CloudSyncAuthPanel({ provider }: { provider: PasswordAuthProvider }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!provider.configured) return;
    void provider.getSession().then(setSession).catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    return provider.subscribe((nextSession) => {
      setSession(nextSession);
      window.dispatchEvent(new Event('task-laureate:auth-changed'));
    });
  }, [provider]);

  if (!provider.configured) return <section className="supabase-auth-panel" aria-labelledby="cloud-sync-title">
    <h2 id="cloud-sync-title">Cloud sync is not configured</h2>
    <p>Add your Supabase URL and publishable key to <code>apps/web/.env.local</code>, then restart the app.</p>
  </section>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
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
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Task-Laureate auth] Authentication failed.', { detail });
      setMessage(detail);
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await provider.signOut();
      setMessage('Signed out. Cloud sync has stopped on this device.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Task-Laureate auth] Sign-out failed.', { detail });
      setMessage(detail);
    } finally { setBusy(false); }
  };

  return <section className="supabase-auth-panel" aria-labelledby="cloud-sync-title">
    <h2 id="cloud-sync-title">Private cloud sync</h2>
    {session ? <><p>Signed in as <strong>{session.user.email ?? session.user.id}</strong>. Your session refreshes automatically.</p>
      <button className="secondary-button" type="button" onClick={() => void signOut()} disabled={busy}>Sign out</button></> : <>
      <p>Sign in to save this workspace to your private account. No access token needs to be copied or stored in an environment file.</p>
      <form className="supabase-auth-form" onSubmit={(event) => void submit(event)}>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
        <div className="supabase-auth-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in and sync' : 'Create account'}</button>
          <button className="secondary-button" type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} disabled={busy}>{mode === 'sign-in' ? 'Create an account' : 'I already have an account'}</button></div>
      </form>
    </>}
    {message && <p className="supabase-auth-message" role="status">{message}</p>}
  </section>;
}
