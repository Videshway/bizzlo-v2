import React from 'react';
import { captureException } from '../lib/telemetry';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-page">
          <section className="auth-panel">
            <div className="auth-heading">
              <h1>Bizzlo hit a temporary issue</h1>
              <p>Please refresh the page. If it continues, contact support@bizzlo.co.</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

