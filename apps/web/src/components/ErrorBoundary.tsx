/**
 * ErrorBoundary Component
 * Catches and displays errors gracefully with recovery options
 */

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
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
              {this.state.error && (
                <details
                  style={{
                    textAlign: 'left',
                    padding: '1rem',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    borderLeft: '3px solid #dc2626',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Error details</summary>
                  <pre
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      maxHeight: '200px',
                      color: '#dc2626',
                    }}
                  >
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
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
                onClick={() => (window.location.href = '/')}
                className="secondary-button"
              >
                Back to Home
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
