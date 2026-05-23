import { useState } from 'react';
import { GraduationCap, LockKeyhole } from 'lucide-react';
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
      setMessage('Enter your email first, then request a reset link.');
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
      <section className="auth-panel">
        <div className="brand-lockup auth-brand">
          <div className="brand-mark">
            <GraduationCap size={24} />
          </div>
          <div>
            <strong>Bizzlo</strong>
            <span>Videshway admissions OS</span>
          </div>
        </div>

        <div className="auth-heading">
          <LockKeyhole size={22} />
          <h1>Sign in to your workspace</h1>
          <p>Accounts are created by Videshway admin. Public sign-up stays closed for partner data protection.</p>
        </div>

        {appError ? <div className="system-banner error">{appError}</div> : null}
        {message ? <div className="system-banner success">{message}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
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
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <button className="primary-button" type="submit" disabled={submitting || authLoading}>
            {submitting || authLoading ? 'Signing in...' : 'Sign in'}
          </button>
          <button className="text-button" type="button" disabled={submitting || authLoading} onClick={handleResetPassword}>
            Send password reset
          </button>
        </form>
      </section>
    </main>
  );
}
