import { PageContainer } from '../components/layouts';
import { useTheme } from '../core/themes/ThemeProvider';
import { ThemeSwitcher, ThemePreviewCard } from '../core/themes/ThemeSwitcher';
import { THEME_OPTIONS } from '../core/themes/themes';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { WorkspaceDataPanel } from '../components/WorkspaceDataPanel';
import { CloudSyncAuthPanel } from '../components/CloudSyncAuthPanel';
import { UndoCenter } from '../components/UndoCenter';
import { authProvider } from '../config/persistence.config';

/**
 * Premium Settings Page
 * 
 * Allows users to configure app settings including:
 * - Beautiful theme selection and real-time preview
 * - Notification preferences with toggle controls
 * - All changes apply instantly without reload
 */
export function SettingsPage() {
  usePageSEO(PAGE_SEO.settings);
  const { currentTheme } = useTheme();
  const currentThemeLabel = THEME_OPTIONS.find(t => t.name === currentTheme)?.label || 'Unknown';

  return (
    <PageContainer
      title="Settings"
      subtitle="Customize Task-Laureate to match your perfect experience"
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Settings and preferences"
      spacing="spacious"
      maxWidth="lg"
    >
      <div style={{ display: 'grid', gap: 'var(--spacing-12)', maxWidth: '100%' }}>
        <UndoCenter />

        {/* Appearance Section */}
        <section style={{ display: 'grid', gap: 'var(--spacing-8)' }}>
          <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 'var(--line-height-tight)',
            }}>
              🎨 Appearance & Themes
            </h2>
            <p style={{
              fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              margin: 0,
            }}>
              Choose a theme that resonates with your workflow. All themes feature refined colors, 
              smooth animations, and premium interactions. Your choice is saved automatically.
            </p>
          </div>

          {/* Theme Cards Grid */}
          <div style={{ display: 'grid', gap: 'var(--spacing-6)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--spacing-4)',
            }}>
              <h3 style={{
                fontSize: '0.75rem',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--color-text-primary)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                Available Themes
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                padding: 'var(--spacing-1) var(--spacing-3)',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-action-primary)',
                color: 'var(--color-text-inverse)',
                fontSize: '0.75rem',
                fontWeight: 'var(--font-weight-extrabold)',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '9999px',
                  backgroundColor: 'currentColor',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }} />
                {currentThemeLabel}
              </span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {THEME_OPTIONS.map((theme) => (
                <ThemePreviewCard key={theme.name} themeName={theme.name} />
              ))}
            </div>
          </div>

          {/* Quick Switcher */}
          <div style={{
            backgroundColor: 'var(--color-bg-secondary)',
            padding: 'var(--spacing-6)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
          }}>
            <ThemeSwitcher />
          </div>

          {/* Theme Features */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            <div style={{
              padding: 'var(--spacing-5)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-light)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-2)' }}>⚡</div>
              <h4 style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: '0 0 var(--spacing-1) 0',
              }}>Instant Switching</h4>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}>Changes apply instantly across the entire app</p>
            </div>
            <div style={{
              padding: 'var(--spacing-5)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-light)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-2)' }}>🎯</div>
              <h4 style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: '0 0 var(--spacing-1) 0',
              }}>WCAG AAA Contrast</h4>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}>All themes meet accessibility standards</p>
            </div>
            <div style={{
              padding: 'var(--spacing-5)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-light)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-2)' }}>💾</div>
              <h4 style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: '0 0 var(--spacing-1) 0',
              }}>Auto-Saved</h4>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}>Your preference persists across sessions</p>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div style={{
          borderTop: '1px solid var(--color-border-light)',
        }} />

        {/* Notifications Section */}
        <section style={{ display: 'grid', gap: 'var(--spacing-8)' }}>
          <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 'var(--line-height-tight)',
            }}>
              🔔 Notifications
            </h2>
            <p style={{
              fontSize: 'clamp(0.95rem, 2vw, 1.05rem)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              margin: 0,
            }}>
              Stay informed with curated notifications. Choose which events trigger alerts.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-bg-secondary)',
            padding: 'var(--spacing-6)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            display: 'grid',
            gap: 'var(--spacing-4)',
          }}>
            {[
              { 
                id: 'task-due',
                label: 'Task due soon',
                description: 'Get notified when tasks are due within the next 24 hours',
                defaultChecked: true,
                icon: '⏰'
              },
              { 
                id: 'task-completed',
                label: 'Task completed',
                description: 'Celebrate when tasks are marked as complete',
                defaultChecked: true,
                icon: '✅'
              },
              { 
                id: 'task-assigned',
                label: 'Task assigned',
                description: 'Get notified when tasks are assigned to you',
                defaultChecked: true,
                icon: '👤'
              },
              { 
                id: 'weekly-digest',
                label: 'Weekly digest',
                description: 'Receive a summary of your week every Sunday',
                defaultChecked: false,
                icon: '📧'
              },
            ].map((notif) => (
              <label key={notif.id} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-4)',
                padding: 'var(--spacing-3)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'background-color var(--transition-base)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}>
                <input
                  type="checkbox"
                  id={notif.id}
                  defaultChecked={notif.defaultChecked}
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '0.125rem',
                    border: '1px solid var(--color-border-default)',
                    accentColor: 'var(--color-action-primary)',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>{notif.icon}</span>
                    <span style={{
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-primary)',
                    }}>
                      {notif.label}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    margin: 'var(--spacing-1) 0 0 0',
                  }}>
                    {notif.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div style={{
          borderTop: '1px solid var(--color-border-light)',
        }} />

        <CloudSyncAuthPanel provider={authProvider} />

        <div style={{
          borderTop: '1px solid var(--color-border-light)',
        }} />

        <WorkspaceDataPanel />

        <div style={{
          borderTop: '1px solid var(--color-border-light)',
        }} />

        {/* About Section */}
        <section style={{
          background: 'linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-primary) 100%)',
          padding: 'var(--spacing-6)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
        }}>
          <h3 style={{
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            margin: '0 0 var(--spacing-3) 0',
            fontSize: '1rem',
          }}>About Task-Laureate</h3>
          <p style={{
            fontSize: '0.95rem',
            color: 'var(--color-text-secondary)',
            margin: '0 0 var(--spacing-4) 0',
            lineHeight: 'var(--line-height-relaxed)',
          }}>
            Built with premium design principles from the world's best task management apps.
            Every interaction is crafted for delight and efficiency.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--spacing-4)',
            fontSize: '0.75rem',
          }}>
            <div>
              <span style={{
                color: 'var(--color-text-tertiary)',
                fontSize: '0.7rem',
              }}>Version</span>
              <p style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                margin: 'var(--spacing-1) 0 0 0',
              }}>1.0.0</p>
            </div>
            <div>
              <span style={{
                color: 'var(--color-text-tertiary)',
                fontSize: '0.7rem',
              }}>Status</span>
              <p style={{
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-status-success)',
                margin: 'var(--spacing-1) 0 0 0',
              }}>Premium Ready</p>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
