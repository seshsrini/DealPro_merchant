import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '../services/sentryService';

// ────────────────────────────────────────────────────────────────────────
// Top-level safety net for uncaught component errors.
//
// React error boundaries MUST be class components — `componentDidCatch` and
// `getDerivedStateFromError` aren't available via hooks. This boundary sits
// outside every provider so it catches errors in the providers themselves.
//
// Two recovery affordances:
//   1. "Try again" — resets the boundary state. If the error was transient
//      (e.g. a flaky data fetch on first render), the next render may succeed.
//   2. "Reload app" — full page reload. Last-resort but always works.
//
// When Sentry / similar is wired in later, drop a Sentry.captureException
// inside componentDidCatch — that's the canonical signal-to-noise gate.
// ────────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Triggers a re-render with the error UI on the next paint.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Best-effort console capture for dev tools.
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
    // Forward to Sentry (no-op if Sentry isn't configured).
    captureException(error, {
      componentStack: errorInfo?.componentStack,
      source: 'react_error_boundary',
    });
    this.setState({ errorInfo });
  }

  handleTryAgain = () => {
    // Reset state so React re-renders the children. If the underlying issue
    // persists (e.g. corrupt localStorage, dead session) the boundary will
    // re-trigger immediately and the user can fall back to "Reload app".
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleReload = () => {
    try { window.location.reload(); } catch { /* noop */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'An unexpected error occurred.';
    const stack = this.state.errorInfo?.componentStack || this.state.error?.stack || '';

    return (
      <div
        // Inline styles so this works even if Tailwind / app CSS failed to load.
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#0f172a',
          color: '#f1f5f9',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: '#1e293b',
            borderRadius: '20px',
            padding: '32px 24px',
            border: '1px solid #334155',
          }}
        >
          {/* Alert glyph (inline SVG so no icon-library dep) */}
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '64px', height: '64px', borderRadius: '16px',
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
            DealFynd hit an unexpected snag. Tap “Try again” to retry — if it keeps happening, reload the app.
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <button
              onClick={this.handleTryAgain}
              style={{
                flex: 1, height: '44px', borderRadius: '12px',
                border: '1px solid #334155', background: '#0f172a', color: '#cbd5e1',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                flex: 1, height: '44px', borderRadius: '12px',
                border: 'none', background: '#eab308', color: '#0f172a',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>

          <button
            onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
            style={{
              background: 'transparent', border: 'none', color: '#64748b',
              fontSize: '12px', cursor: 'pointer', padding: '4px',
            }}
          >
            {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>

          {this.state.showDetails && (
            <div
              style={{
                marginTop: '16px', padding: '12px', borderRadius: '8px',
                background: '#0f172a', border: '1px solid #334155',
                textAlign: 'left', fontSize: '11px', color: '#94a3b8',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <div style={{ color: '#f87171', marginBottom: '8px' }}>{message}</div>
              {stack ? <div style={{ opacity: 0.7 }}>{stack}</div> : null}
            </div>
          )}
        </div>
      </div>
    );
  }
}
