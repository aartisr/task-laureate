import { Link } from '@tanstack/react-router';
import { CloudSyncAuthPanel } from '../components/CloudSyncAuthPanel';
import { authProvider } from '../config/persistence.config';

/** A calm, reversible entry point to private cloud sync. */
export function SignInPage() {
  return (
    <main className="sign-in-page" aria-labelledby="sign-in-title">
      <div className="sign-in-page__aurora" aria-hidden="true" />
      <header className="sign-in-page__header">
        <Link to="/" className="sign-in-page__brand" aria-label="Task-Laureate home">
          <span aria-hidden="true">✓</span>
          <strong>Task-Laureate</strong>
        </Link>
        <Link to="/" className="sign-in-page__home-link">Return home <span aria-hidden="true">→</span></Link>
      </header>

      <section className="sign-in-page__content">
        <div className="sign-in-page__story">
          <p className="sign-in-page__eyebrow">Private cloud sync</p>
          <h1 id="sign-in-title">Pick up your momentum, wherever you are.</h1>
          <p className="sign-in-page__lead">Sign in to keep your Lists and Tasks private, synced, and ready on every device you use.</p>
          <ul className="sign-in-page__benefits" aria-label="What signing in enables">
            <li><span aria-hidden="true">↗</span><span><strong>Continue seamlessly</strong><small>Your workspace follows you across devices.</small></span></li>
            <li><span aria-hidden="true">◌</span><span><strong>Keep it personal</strong><small>Your Lists and Tasks stay separated by account.</small></span></li>
            <li><span aria-hidden="true">⌁</span><span><strong>Leave anytime</strong><small>You can return home now and sign in whenever it helps.</small></span></li>
          </ul>
        </div>

        <section className="sign-in-page__auth" aria-labelledby="sign-in-panel-title">
          <div className="sign-in-page__auth-heading">
            <p className="sign-in-page__step">Secure sign-in</p>
            <h2 id="sign-in-panel-title">Choose how to continue</h2>
            <p>Use an account you already trust. We never see or store its password.</p>
          </div>
          <CloudSyncAuthPanel provider={authProvider} returnTo="/" presentation="embedded" />
          <div className="sign-in-page__cancel">
            <Link to="/" className="sign-in-page__cancel-link">Cancel and return home</Link>
            <p>You can sign in anytime from the workspace menu.</p>
          </div>
        </section>
      </section>

      <footer className="sign-in-page__footer">
        <span aria-hidden="true">⌁</span> Secure provider sign-in · Your workspace stays yours
      </footer>
    </main>
  );
}
