import { useEffect, useRef, useState } from 'react';
import { authProvider } from '../config/persistence.config';
import { consumeOAuthReturnTo } from '../infrastructure/persistence/supabaseAuth';
import { supportsSocialAuth } from '../core/contracts/auth';
import { initializePersistence } from '../app/runtime/appServices';

/** Completes a PKCE callback before returning the person to a safe in-app path. */
export function AuthCallbackPage() {
  const started = useRef(false);
  const [message, setMessage] = useState('Finishing secure sign-in…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!supportsSocialAuth(authProvider)) {
      setMessage('Social sign-in is not available in this deployment. Return to Settings and try another method.');
      setFailed(true);
      return;
    }
    let active = true;
    void authProvider.completeOAuthCallback()
      .then(async () => {
        if (!active) return;
        setMessage('Connecting your private workspace…');
        // The callback route owns the one-time code, so it rebuilds the
        // workspace itself before navigating away. This avoids duplicate code
        // exchange and prevents the destination from showing a stale session.
        await initializePersistence({ force: true });
        if (!active) return;
        window.location.replace(consumeOAuthReturnTo());
      })
      .catch((error) => {
        if (!active) return;
        setFailed(true);
        setMessage(error instanceof Error ? error.message : 'We could not finish sign-in. Please return to Settings and try again.');
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="auth-callback-page" aria-labelledby="auth-callback-title">
      <section className="auth-callback-page__card" aria-live="polite">
        <p className="auth-callback-page__eyebrow">Private cloud sync</p>
        <h1 id="auth-callback-title">{failed ? 'Sign-in needs another try' : 'Finishing sign-in'}</h1>
        <p>{message}</p>
        {failed ? <a className="secondary-button" href="/settings">Return to Settings</a> : null}
      </section>
    </main>
  );
}
