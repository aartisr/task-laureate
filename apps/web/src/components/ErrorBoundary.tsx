/**
 * ErrorBoundary Component
 * Catches and displays errors gracefully with recovery options
 */

import React, { ReactNode } from 'react';
import { ExceptionReportDialog } from './ExceptionReportDialog';
import { createExceptionReportDraft } from '../infrastructure/support/exceptionReporting';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  reportOpen: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reportOpen: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reportOpen: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, reportOpen: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                maxWidth: '500px',
                animation: 'slideInUp 0.4s ease-out',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                Something went wrong
              </h2>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  marginBottom: '2rem',
                }}
              >
                We encountered an unexpected error. Try refreshing the page or contact support if
                the problem persists.
              </p>
              <button
                onClick={this.handleReset}
                className="primary-button"
                style={{
                  marginRight: '1rem',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => this.setState({ reportOpen: true })}
                className="secondary-button"
              >
                Send report to Support
              </button>
              <button onClick={() => (window.location.href = '/')} className="secondary-button">Back to Home</button>
              {this.state.reportOpen && this.state.error ? <ExceptionReportDialog draft={createExceptionReportDraft(this.state.error)} onClose={() => this.setState({ reportOpen: false })} /> : null}
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
