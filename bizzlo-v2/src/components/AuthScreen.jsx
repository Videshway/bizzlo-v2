import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useAppState } from '../lib/appState';

export function AuthScreen() {
  const { authLoading, appError, resetPassword, signIn } = useAppState();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn(form.email, form.password);
    } catch {
      // The global banner shows the exact sign-in error.
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!form.email) {
      setMessage('Enter your username or email first, then request a reset link.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await resetPassword(form.email);
      setMessage('Password reset link sent if the account is active.');
    } catch {
      // The global banner shows the exact reset error.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-story" aria-label="Bizzlo overview">
          <div className="auth-brandline">
            <div className="brand-lockup auth-brand">
              <div className="brand-mark">
                <GraduationCap size={24} />
              </div>
              <div>
                <strong>Bizzlo</strong>
                <span>Videshway admissions OS</span>
              </div>
            </div>
            <span className="auth-security-pill"><ShieldCheck size={15} /> Private partner workspace</span>
          </div>

          <div className="auth-copy">
            <h1>Partner admissions, documents, and offers in one controlled workspace.</h1>
            <p>
              Bizzlo keeps partner teams, counselors, student files, and application stages moving through one secure operating view.
            </p>
          </div>

          <div className="auth-proof-grid" aria-label="Workspace coverage">
            <div>
              <UsersRound size={18} />
              <strong>Partner teams</strong>
              <span>Managers and counselors work inside scoped accounts.</span>
            </div>
            <div>
              <FileCheck2 size={18} />
              <strong>Document control</strong>
              <span>Uploads enter review before Videshway approval.</span>
            </div>
            <div>
              <Building2 size={18} />
              <strong>Course pipeline</strong>
              <span>Partner-linked courses, applications, and stages stay connected.</span>
            </div>
          </div>

          <div className="auth-preview" aria-label="Bizzlo workflow preview">
            <div className="auth-preview-head">
              <span>Live workflow</span>
              <strong>Application review queue</strong>
            </div>
            <div className="auth-preview-row">
              <span className="auth-avatar">AM</span>
              <div>
                <strong>Aarav Mehta</strong>
                <span>University of Manchester - MSc Management</span>
              </div>
              <BadgeCheck size={18} />
            </div>
            <div className="auth-stage-track">
              <span className="complete">Submitted</span>
              <span className="complete">Offer received</span>
              <span>Deposit</span>
              <span>Visa</span>
            </div>
            <div className="auth-preview-metrics">
              <div>
                <strong>42</strong>
                <span>docs reviewed</span>
              </div>
              <div>
                <strong>18</strong>
                <span>offers active</span>
              </div>
              <div>
                <strong>9</strong>
                <span>partners live</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-heading">
            <div className="auth-lock-icon">
              <LockKeyhole size={22} />
            </div>
            <h1>Sign in to your workspace</h1>
            <p>Accounts are created by Videshway admin. Public sign-up stays closed for partner data protection.</p>
          </div>

          {appError ? <div className="system-banner error">{appError}</div> : null}
          {message ? <div className="system-banner success">{message}</div> : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Username or email</span>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="partner-login-id or name@company.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <button className="primary-button auth-submit" type="submit" disabled={submitting || authLoading}>
              {submitting || authLoading ? 'Signing in...' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" type="button" disabled={submitting || authLoading} onClick={handleResetPassword}>
              Send password reset
            </button>
          </form>

          <div className="auth-footnote">
            <ShieldCheck size={16} />
            <span>Protected access for Videshway admins, partner managers, and counselors.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
