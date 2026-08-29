import { PageContainer } from '../components/layouts';
import { useTheme } from '../core/themes/ThemeProvider';
import { ThemeSwitcher, ThemePreviewCard } from '../core/themes/ThemeSwitcher';
import { THEME_OPTIONS } from '../core/themes/themes';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { WorkspaceDataPanel } from '../components/WorkspaceDataPanel';
import { CloudSyncAuthPanel } from '../components/CloudSyncAuthPanel';
import { UndoCenter } from '../components/UndoCenter';
import { authProvider } from '../config/persistence.config';
import { NotificationInbox } from '../components/NotificationInbox';
import { ReminderDeliveryPreferences } from '../components/ReminderDeliveryPreferences';
import { AnalyticsConsentControl } from '../components/AnalyticsConsentControl';
import { AntiBacklogPrivacyControls } from '../components/AntiBacklogPrivacyControls';
import { CalendarConnectionPanel } from '../components/CalendarConnectionPanel';
import { EcosystemIntegrationsPanel } from '../components/EcosystemIntegrationsPanel';
import { isFeatureEnabled } from '../config/featureFlags';
import { SyncCenter } from '../components/SyncCenter';
import { WorkspaceExperienceControl } from '../components/WorkspaceExperienceControl';

/** Keeps everyday preferences visible and infrequent administration available on demand. */
export function SettingsPage() {
  usePageSEO(PAGE_SEO.settings);
  const { currentTheme } = useTheme();
  const currentThemeLabel = THEME_OPTIONS.find((theme) => theme.name === currentTheme)?.label ?? 'Unknown';
  const calendarEnabled = isFeatureEnabled('calendarIntegration');

  return (
    <PageContainer
      title="Settings"
      subtitle="Choose how Task-Laureate looks and communicates. Everything else is here when you need it."
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Settings and preferences"
      spacing="spacious"
      maxWidth="lg"
    >
      <div className="settings-page">
        <section className="settings-section" aria-labelledby="appearance-heading">
          <div className="settings-section__heading">
            <p className="settings-section__eyebrow">Everyday preference</p>
            <h2 id="appearance-heading">Appearance</h2>
            <p>Current theme: <strong>{currentThemeLabel}</strong></p>
          </div>
          <ThemeSwitcher />
          <details className="settings-disclosure settings-disclosure--nested">
            <summary>Preview all themes</summary>
            <div className="settings-theme-grid">
              {THEME_OPTIONS.map((theme) => <ThemePreviewCard key={theme.name} themeName={theme.name} />)}
            </div>
          </details>
        </section>

        <section className="settings-section" aria-labelledby="experience-heading">
          <div className="settings-section__heading">
            <p className="settings-section__eyebrow">Navigation preference</p>
            <h2 id="experience-heading">Focus &amp; workspace mode</h2>
            <p>Choose a calm navigation for getting things done, or reveal planning and collaboration tools. Your tasks and permissions stay the same.</p>
          </div>
          <WorkspaceExperienceControl />
        </section>

        <details className="settings-disclosure">
          <summary><span>Notifications &amp; reminders</span><small>Choose what reaches you</small></summary>
          <div className="settings-disclosure__body">
            <NotificationInbox />
            <ReminderDeliveryPreferences />
          </div>
        </details>

        <details className="settings-disclosure">
          <summary><span>Privacy &amp; analytics</span><small>Control usage insights</small></summary>
          <div className="settings-disclosure__body"><AnalyticsConsentControl /><AntiBacklogPrivacyControls /></div>
        </details>

        <details className="settings-disclosure">
          <summary><span>Account &amp; sync</span><small>Connect or manage your account</small></summary>
          <div className="settings-disclosure__body"><CloudSyncAuthPanel provider={authProvider} /><SyncCenter /></div>
        </details>

        <details className="settings-disclosure">
          <summary><span>Ecosystem &amp; Calendar Integrations</span><small>Google Calendar, Notion, Todoist &amp; Webhooks</small></summary>
          <div className="settings-disclosure__body">
            <EcosystemIntegrationsPanel />
          </div>
        </details>

        <details className="settings-disclosure">
          <summary><span>Calendar scheduling</span><small>Protect time for focused work</small></summary>
          <div className="settings-disclosure__body"><CalendarConnectionPanel enabled={calendarEnabled} /></div>
        </details>

        <details className="settings-disclosure">
          <summary><span>Data &amp; recovery</span><small>Restore work or manage stored data</small></summary>
          <div className="settings-disclosure__body">
            <UndoCenter />
            <WorkspaceDataPanel />
          </div>
        </details>

        <details className="settings-disclosure">
          <summary><span>About Task-Laureate</span><small>Version and product information</small></summary>
          <div className="settings-disclosure__body settings-about">
            <p>Task-Laureate helps you keep the next useful action clear.</p>
            <dl><div><dt>Version</dt><dd>1.0.0</dd></div><div><dt>Status</dt><dd>Ready</dd></div></dl>
          </div>
        </details>
      </div>
    </PageContainer>
  );
}
