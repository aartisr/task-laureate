/**
 * Analytics consent control for the Settings page.
 *
 * Accessibility requirements:
 *   - Keyboard-navigable with visible focus rings
 *   - Readable at 320 px (single-column, no horizontal overflow)
 *   - Status communicated via aria-live for screen readers
 *   - No prechecked boxes; no dark patterns; product access is never blocked
 *
 * What is collected (exactly what the event catalog approves) is listed inline
 * so users can make an informed decision without leaving the page.
 */

import { useState, useEffect } from 'react';
import { getConsentDecision, setConsentDecision, withdrawConsent, subscribeToConsent, type ConsentDecision } from '../core/privacy/analyticsConsent';
import { getAnalyticsConfig } from '../infrastructure/analytics/analyticsConfig';
import { getAnalyticsDispatcher } from '../infrastructure/analytics/analytics';

function useConsentState(): [ConsentDecision, boolean] {
  const config = getAnalyticsConfig();
  const [decision, setDecision] = useState<ConsentDecision>(() =>
    getConsentDecision(config.consentVersion),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribeToConsent((next) => setDecision(next));
  }, []);

  return [decision, busy];
}

export function AnalyticsConsentControl() {
  const config = getAnalyticsConfig();
  const analyticsConfigured = config.isValid;
  const [decision, setBusy] = useConsentState();
  const [busy] = [false]; // keep API consistent; remove lint warning below
  void busy; // consumed above

  // We need separate state for the button loading state
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleGrant = async () => {
    if (!analyticsConfigured) {
      setStatusMessage(`Analytics is currently unavailable: ${config.reason}`);
      return;
    }
    setSubmitting(true);
    setConsentDecision('granted', config.consentVersion);
    getAnalyticsDispatcher().setConsent({ granted: true, version: config.consentVersion });
    setStatusMessage('Analytics enabled. Thank you for helping improve Task-Laureate.');
    setSubmitting(false);
  };

  const handleDeny = () => {
    setConsentDecision('denied', config.consentVersion);
    getAnalyticsDispatcher().setConsent({ granted: false, version: config.consentVersion });
    getAnalyticsDispatcher().reset();
    setStatusMessage('Analytics disabled. No data will be collected.');
  };

  const handleWithdraw = () => {
    withdrawConsent(config.consentVersion);
    getAnalyticsDispatcher().setConsent({ granted: false, version: config.consentVersion });
    getAnalyticsDispatcher().reset();
    setStatusMessage('Analytics consent withdrawn and identity reset.');
  };

  return (
    <section
      aria-labelledby="analytics-consent-heading"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--spacing-6)',
        display: 'grid',
        gap: 'var(--spacing-5)',
        maxWidth: '100%',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--spacing-2)' }}>
        <h2
          id="analytics-consent-heading"
          style={{
            fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
            fontWeight: 'var(--font-weight-extrabold)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          📊 Product Analytics
        </h2>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 'var(--line-height-relaxed)' }}>
          Help improve Task-Laureate by sharing anonymous usage data. This is entirely optional —
          the app works identically whether you opt in or out.
        </p>
      </div>

      {/* What is and is not collected */}
      <div style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
        <CollectedInfo
          title="What IS collected (the complete list)"
          color="var(--color-status-success)"
          icon="✓"
          items={[
            'Which surface you first visited (landing, demo)',
            'Whether sign-up started and completed',
            'First-ever list, task, due date, task completion, and share — once per account',
            'Whether a shared invitation was accepted',
            'Whether a reminder rule was enabled — offset minutes only',
            'When the workspace enters a sync error state — surface name only',
          ]}
        />
        <CollectedInfo
          title="What is NEVER collected"
          color="var(--color-status-error, #e53e3e)"
          icon="✗"
          items={[
            'Task titles, notes, tags, descriptions, or due dates',
            'List titles or content of any kind',
            'Email addresses, names, or any contact information',
            'Resource IDs, invitation tokens, or authentication tokens',
            'Query text from search',
            'URLs containing IDs or tokens',
            'IP address or device identifiers added by application code',
            'Session recordings, clicks, or keystrokes',
          ]}
        />
      </div>

      {/* Consent status */}
      <div
        style={{
          padding: 'var(--spacing-3) var(--spacing-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor:
            decision === 'granted'
              ? 'color-mix(in srgb, var(--color-status-success) 12%, transparent)'
              : decision === 'denied'
                ? 'color-mix(in srgb, var(--color-status-error, #e53e3e) 10%, transparent)'
                : 'var(--color-bg-tertiary, var(--color-bg-secondary))',
          border: `1px solid ${
            decision === 'granted'
              ? 'color-mix(in srgb, var(--color-status-success) 30%, transparent)'
              : 'var(--color-border-light)'
          }`,
          fontSize: '0.875rem',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
        }}
      >
        {decision === 'granted' && '✓ Analytics enabled – thank you for helping improve the product.'}
        {decision === 'denied' && '✗ Analytics disabled – no usage data is collected.'}
        {decision === 'unknown' && '○ Not yet decided – analytics is off until you choose.'}
      </div>

      {!analyticsConfigured && (
        <div
          role="alert"
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'color-mix(in srgb, var(--color-status-error, #e53e3e) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-status-error, #e53e3e) 30%, transparent)',
            color: 'var(--color-text-primary)',
            fontSize: '0.875rem',
          }}
        >
          Analytics is unavailable in this deployment: {config.reason}.
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          alignItems: 'center',
        }}
      >
        {decision !== 'granted' && (
          <button
            type="button"
            disabled={submitting || !analyticsConfigured}
            onClick={() => void handleGrant()}
            className="primary-button"
            style={{ minWidth: 'max-content' }}
          >
            {submitting ? 'Enabling…' : 'Enable analytics'}
          </button>
        )}
        {decision === 'unknown' && (
          <button
            type="button"
            disabled={!analyticsConfigured}
            onClick={handleDeny}
            className="secondary-button"
            style={{ minWidth: 'max-content' }}
          >
            No thanks
          </button>
        )}
        {decision === 'granted' && (
          <button
            type="button"
            disabled={!analyticsConfigured}
            onClick={handleWithdraw}
            className="secondary-button"
            style={{ minWidth: 'max-content' }}
          >
            Withdraw consent
          </button>
        )}
        {decision === 'denied' && (
          <button
            type="button"
            onClick={() => void handleGrant()}
            disabled={submitting || !analyticsConfigured}
            className="secondary-button"
            style={{ minWidth: 'max-content' }}
          >
            Enable analytics
          </button>
        )}
      </div>

      {/* Live status for screen readers */}
      {statusMessage && (
        <p
          role="status"
          aria-live="polite"
          style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}
        >
          {statusMessage}
        </p>
      )}

      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-tertiary, var(--color-text-secondary))' }}>
        {analyticsConfigured
          ? `Usage data is sent to PostHog${config.host !== 'https://us.i.posthog.com' ? ` at ${config.host}` : ''}.`
          : 'Analytics is disabled in this deployment until PostHog environment variables are configured.'}
        You can withdraw at any time. Your tasks and notes are never shared with any analytics provider.
      </p>
    </section>
  );
}

function CollectedInfo({
  title,
  color,
  icon,
  items,
}: {
  title: string;
  color: string;
  icon: string;
  items: string[];
}) {
  return (
    <div
      style={{
        padding: 'var(--spacing-4)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
      }}
    >
      <p
        style={{
          margin: '0 0 var(--spacing-2) 0',
          fontSize: '0.8rem',
          fontWeight: 'var(--font-weight-extrabold)',
          color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 'var(--spacing-1)',
        }}
      >
        {items.map((item) => (
          <li
            key={item}
            style={{
              display: 'flex',
              gap: 'var(--spacing-2)',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
            }}
          >
            <span aria-hidden="true" style={{ color, flexShrink: 0, fontWeight: 'bold' }}>
              {icon}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
