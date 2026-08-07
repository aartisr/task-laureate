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
import { getCachedPostHogInstance, getInitPromise, shouldInitPostHog } from '../infrastructure/analytics/posthogClient';

interface AnalyticsDiagnostics {
  readonly consentDecision: ConsentDecision;
  readonly configValid: boolean;
  readonly configReason: string;
  readonly shouldInitNow: boolean;
  readonly cachedClient: boolean;
  readonly initInFlight: boolean;
  readonly tokenPrefix: string;
  readonly host: string;
  readonly distinctId: string;
  readonly optedOut: string;
  readonly checkedAt: string;
}

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
  const [diagnostics, setDiagnostics] = useState<AnalyticsDiagnostics | null>(null);

  const refreshDiagnostics = () => {
    const cachedClient = getCachedPostHogInstance();
    let distinctId = 'n/a';
    let optedOut = 'n/a';
    try {
      if (cachedClient) {
        distinctId = String(cachedClient.get_distinct_id?.() ?? 'unknown');
        optedOut = String(cachedClient.has_opted_out_capturing?.() ?? 'unknown');
      }
    } catch {
      distinctId = 'error reading client';
      optedOut = 'error reading client';
    }

    setDiagnostics({
      consentDecision: decision,
      configValid: config.isValid,
      configReason: config.reason,
      shouldInitNow: shouldInitPostHog(config),
      cachedClient: Boolean(cachedClient),
      initInFlight: Boolean(getInitPromise()),
      tokenPrefix: config.key ? `${config.key.slice(0, 8)}…` : '(missing)',
      host: config.host,
      distinctId,
      optedOut,
      checkedAt: new Date().toLocaleString(),
    });
  };

  useEffect(() => {
    refreshDiagnostics();
  }, [decision]);

  useEffect(() => {
    if (!analyticsConfigured) return;
    if (decision !== 'granted') return;
    getAnalyticsDispatcher().setConsent({ granted: true, version: config.consentVersion });
  }, [analyticsConfigured, decision, config.consentVersion]);

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
        {decision === 'unknown' && (
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
        {decision === 'denied' && (
          <button
            type="button"
            onClick={() => void handleGrant()}
            disabled={submitting || !analyticsConfigured}
            className="primary-button"
            style={{ minWidth: 'max-content' }}
          >
            {submitting ? 'Enabling…' : 'Enable analytics'}
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

      <section
        aria-labelledby="analytics-diagnostics-heading"
        style={{
          display: 'grid',
          gap: 'var(--spacing-3)',
          padding: 'var(--spacing-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          <h3
            id="analytics-diagnostics-heading"
            style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}
          >
            Analytics diagnostics
          </h3>
          <button type="button" className="secondary-button" onClick={refreshDiagnostics} style={{ minWidth: 'max-content' }}>
            Refresh diagnostics
          </button>
        </div>

        {diagnostics && (
          <div style={{ display: 'grid', gap: 'var(--spacing-2)', fontSize: '0.85rem' }}>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Checked:</strong> {diagnostics.checkedAt}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Consent decision:</strong> {diagnostics.consentDecision}</p>
            <p style={{ margin: 0, color: diagnostics.configValid ? 'var(--color-status-success)' : 'var(--color-status-error, #e53e3e)' }}><strong>Config valid:</strong> {String(diagnostics.configValid)}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Config reason:</strong> {diagnostics.configReason}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Should init now:</strong> {String(diagnostics.shouldInitNow)}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>SDK init in-flight:</strong> {String(diagnostics.initInFlight)}</p>
            <p style={{ margin: 0, color: diagnostics.cachedClient ? 'var(--color-status-success)' : 'var(--color-text-secondary)' }}><strong>Cached PostHog client:</strong> {String(diagnostics.cachedClient)}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Distinct ID:</strong> {diagnostics.distinctId}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Opted out:</strong> {diagnostics.optedOut}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Host:</strong> {diagnostics.host}</p>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}><strong>Token prefix:</strong> {diagnostics.tokenPrefix}</p>
          </div>
        )}
      </section>

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
