import { Link } from '@tanstack/react-router';
import { PageContainer } from '../components/layouts';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

const updated = 'August 13, 2026';

/** Public, plain-language privacy notice for people and OAuth reviewers. */
export function PrivacyPage() {
  usePageSEO(PAGE_SEO.privacy);

  return <PageContainer
    title="Privacy, in plain language"
    subtitle="Task-Laureate is designed to help you make progress—not to turn your work into a product."
    ariaLabel="Task-Laureate privacy notice"
    maxWidth="md"
    spacing="spacious"
  >
    <article className="privacy-notice">
      <aside className="privacy-notice__promise">
        <span aria-hidden="true">◌</span>
        <div><strong>Our promise</strong><p>Your tasks remain yours. We collect only what is needed to provide features you choose to use.</p></div>
      </aside>
      <p className="privacy-notice__updated">Last updated {updated}</p>

      <section>
        <h2>What this notice covers</h2>
        <p>This notice explains how Task-Laureate handles information when you use the web app, optional cloud sync, optional analytics, AI task decomposition, collaboration, and Google Calendar scheduling.</p>
      </section>

      <section>
        <h2>Information you control</h2>
        <p>Tasks, lists, notes, attachments, plans, and reminders are the content you create. Task-Laureate stores everyday workspace state locally first. If you sign in and enable cloud sync, the information needed to synchronize your workspace is stored in the configured Supabase project under its access controls.</p>
        <p>You can use Settings to manage your account, review analytics choices, and export or delete local planning data.</p>
      </section>

      <section>
        <h2>Google Calendar: explicit, one-way scheduling</h2>
        <p>Google Calendar is optional. When you choose to connect it, Task-Laureate requests Calendar access only to create, update, and remove time blocks that <strong>you explicitly schedule from an individual task</strong>.</p>
        <ul>
          <li>We do not import, read, analyze, or modify unrelated calendar events.</li>
          <li>We do not use Google Calendar data for advertising, profiling, or AI training.</li>
          <li>Google refresh tokens are encrypted server-side before storage and are never sent to the browser.</li>
          <li>You can disconnect Google Calendar at any time. Existing Google events are left untouched unless you choose to remove their Task-Laureate block.</li>
        </ul>
      </section>

      <section>
        <h2>Optional AI task decomposition</h2>
        <p>AI decomposition is opt-in. Before a task is sent for a proposed breakdown, Task-Laureate requests your consent. Suggestions are reviewable; they do not change your task unless you accept them. The app is designed to minimize content sent to the provider and to avoid sending attachments, email, web captures, or calendar content.</p>
      </section>

      <section>
        <h2>Analytics and essential service data</h2>
        <p>Optional product analytics are governed by your choice in Settings. Essential operational information may be processed to deliver authentication, synchronization, security, error handling, and features you request. We do not sell personal information.</p>
      </section>

      <section>
        <h2>Sharing and retention</h2>
        <p>Task-Laureate shares information only when you direct it to: for example, with an invited collaborator, a connected service such as Google Calendar, or a configured AI provider. Cloud-stored data remains until you delete it, remove the workspace, or it is removed according to the configured service’s retention controls.</p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Do not connect optional providers.</li>
          <li>Disconnect Google Calendar from <Link to="/settings">Settings</Link>.</li>
          <li>Withdraw optional analytics consent in <Link to="/settings">Settings</Link>.</li>
          <li>Export or delete local planning data in <Link to="/settings">Settings</Link>.</li>
          <li>Ask questions or report a concern through <Link to="/support">Help &amp; Support</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>Changes to this notice</h2>
        <p>We will update this page when practices materially change and revise the date above. Continuing to use an optional integration after a material change means you can review the updated notice before using that integration again.</p>
      </section>
    </article>
  </PageContainer>;
}
