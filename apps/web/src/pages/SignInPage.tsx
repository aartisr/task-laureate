import { CloudSyncAuthPanel } from '../components/CloudSyncAuthPanel';
import { authProvider } from '../config/persistence.config';

/** A dedicated, distraction-free entry point for a signed-out workspace. */
export function SignInPage() {
  return (
    <main className="sign-in-page" aria-labelledby="sign-in-title">
      <section className="sign-in-page__card">
        <div className="sign-in-page__intro">
          <p className="sign-in-page__eyebrow">Task-Laureate</p>
          <h1 id="sign-in-title">Keep your workspace private</h1>
          <p>Sign in once to save your Lists and Tasks securely, then return exactly where you left off.</p>
        </div>
        <CloudSyncAuthPanel provider={authProvider} returnTo="/" />
        <p className="sign-in-page__reassurance">Your provider password is never shared with Task-Laureate.</p>
      </section>
    </main>
  );
}
