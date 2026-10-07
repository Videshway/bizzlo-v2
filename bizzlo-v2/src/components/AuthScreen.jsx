import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Eye, EyeOff, FileCheck2, GraduationCap, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import { useAppState } from '../lib/appState';

export function AuthScreen() {
  const { authLoading, appError, clearError, resetPassword, signIn } = useAppState();
  const [form, setForm] = useState({ email: '', password: '' });
  const [pendingAction, setPendingAction] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const busy = Boolean(pendingAction) || authLoading;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    clearError();
    setMessage('');
    setPendingAction('signin');
    try {
      await signIn(form.email, form.password);
    } catch {
      // The provider surfaces authentication failures in appError.
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPassword() {
    if (!form.email.trim()) {
      setMessage('Enter your username or email first, then request a reset link.');
      return;
    }
    clearError();
    setMessage('');
    setPendingAction('reset');
    try {
      await resetPassword(form.email);
      setMessage('Password reset link sent if the account is active. Check your inbox and spam folder.');
    } catch {
      // The provider surfaces reset failures in appError.
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="auth-page login-experience">
      <div className="auth-shell">
        <section className="auth-story" aria-label="Bizzlo overview">
          <div className="brand-lockup auth-brand">
            <div className="brand-mark"><GraduationCap size={25} strokeWidth={1.7} /></div>
            <div><strong>bizzlo<span className="brand-dot">.</span></strong><span>BY VIDESH WAY</span></div>
          </div>
          <div className="auth-copy">
            <span className="auth-eyebrow"><span /> THE PARTNER WORKSPACE</span>
            <h1>Big ambitions.<br />Clear next steps.</h1>
            <p>From the first student conversation to the final offer. Give every application the attention it deserves.</p>
          </div>
          <div className="journey-preview" aria-label="How Bizzlo connects your workflow">
            <div className="journey-head"><span>ONE CONNECTED JOURNEY</span><ArrowUpRight size={18} /></div>
            <div className="journey-step"><span className="journey-icon"><UsersRound size={18} /></span><div><strong>A student’s next chapter</strong><span>Profiles, plans, and the right programs</span></div><Check size={16} /></div>
            <div className="journey-step"><span className="journey-icon"><FileCheck2 size={18} /></span><div><strong>Every detail, in place</strong><span>Documents and applications, together</span></div><Check size={16} /></div>
            <div className="journey-step"><span className="journey-icon journey-final"><GraduationCap size={18} /></span><div><strong>Move forward with confidence</strong><span>Clear updates from review to enrollment</span></div><ArrowUpRight size={17} /></div>
          </div>
          <div className="auth-story-footer"><ShieldCheck size={16} /><span>Your students. Your team. One private workspace.</span></div>
        </section>
        <section className="auth-panel">
          <div className="auth-heading">
            <span className="auth-welcome">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Good to see you. Let’s move your students forward.</p>
          </div>
          {appError ? <div className="system-banner error" role="alert">{appError}</div> : null}
          {message ? <div className="system-banner success" role="status">{message}</div> : null}
          <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
            <label className="field">
              <span>Username or email</span>
              <input type="text" required autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="Enter your username or email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} onBlur={() => setForm((current) => ({ ...current, email: current.email.trim() }))} />
            </label>
            <div className="password-field">
              <label className="field" htmlFor="signin-password"><span>Password</span></label>
              <div className="password-input-wrap">
                <input id="signin-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <button className="reset-password text-button" type="button" disabled={busy} onClick={handleResetPassword}>{pendingAction === 'reset' ? 'Sending reset link…' : 'Send password reset'}</button>
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{pendingAction === 'signin' || authLoading ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button>
          </form>
          <div className="auth-access-note"><LockKeyhole size={17} /><div><strong>Here by invitation</strong><p>Use the account provided by your Videshway admin. Public sign-up stays closed to keep your workspace private.</p></div></div>
          <footer className="auth-legal"><span>Built for better student journeys.</span><div><a href="/legal/privacy">Privacy</a><span>·</span><a href="/legal/terms">Terms</a></div></footer>
        </section>
      </div>
    </main>
  );
}
