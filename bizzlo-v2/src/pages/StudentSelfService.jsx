import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileCheck2, GraduationCap, KeyRound, Send, UploadCloud } from 'lucide-react';
import { requiredDocuments } from '../data/referenceWorkflow';
import { isSupabaseConfigured, supabaseConfig } from '../lib/supabase';
import { Panel, SelectInput, TextInput } from '../components/ui';

function portalCodeFromPath() {
  const match = window.location.pathname.match(/^\/portal\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function tokenFromLocation() {
  return new URLSearchParams(window.location.search).get('token') || '';
}

function bytesToLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function invokePortalFunction(name, body) {
  const response = await fetch(`${supabaseConfig.url}/functions/v1/${name}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      apikey: supabaseConfig.anonKey,
      'content-type': 'application/json',
      'x-bizzlo-request-id': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

async function uploadPortalDocument(body) {
  const response = await fetch(`${supabaseConfig.url}/functions/v1/student-upload-document`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      apikey: supabaseConfig.anonKey,
      'x-bizzlo-request-id': crypto.randomUUID(),
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || `Upload failed with ${response.status}`);
  return data;
}

function TurnstileBox({ onVerify }) {
  const containerRef = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current || containerRef.current.dataset.rendered) return;
      containerRef.current.dataset.rendered = 'true';
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerify(token),
        'expired-callback': () => onVerify(''),
        'error-callback': () => onVerify(''),
      });
    };

    if (!document.querySelector('script[data-bizzlo-turnstile]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.bizzloTurnstile = 'true';
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      const timer = window.setInterval(renderWidget, 200);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [onVerify, siteKey]);

  if (!siteKey) {
    return <p className="form-error">Human verification is not configured for this environment.</p>;
  }

  return <div className="turnstile-box" ref={containerRef} />;
}

export function StudentSelfServiceApp() {
  const studentCode = useMemo(() => portalCodeFromPath(), []);
  const inviteToken = useMemo(() => tokenFromLocation(), []);
  const [state, setState] = useState({
    loading: false,
    error: '',
    otpSent: false,
    verified: false,
    student: null,
    uploadToken: '',
    uploadedDocuments: [],
  });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [otp, setOtp] = useState('');
  const [form, setForm] = useState({
    document_type: requiredDocuments[0],
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function requestOtp(event) {
    event.preventDefault();
    setMessage('');
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      await invokePortalFunction('redeem-student-invite', {
        action: 'request_otp',
        student_code: studentCode,
        token: inviteToken,
        turnstile_token: turnstileToken,
      });
      setState((current) => ({ ...current, loading: false, otpSent: true }));
      setMessage('A six-digit code has been sent to the student email address.');
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setMessage('');
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await invokePortalFunction('redeem-student-invite', {
        action: 'verify_otp',
        student_code: studentCode,
        token: inviteToken,
        otp,
      });
      setState((current) => ({
        ...current,
        loading: false,
        verified: true,
        student: data.student,
        uploadToken: data.session?.access_token || '',
        uploadedDocuments: [],
      }));
      setMessage('');
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    setMessage('');
    if (!form.file) {
      setMessage('Choose a file before uploading.');
      return;
    }

    const payload = new FormData();
    payload.append('token', state.uploadToken);
    payload.append('document_type', form.document_type);
    payload.append('file', form.file);

    setSubmitting(true);
    try {
      const data = await uploadPortalDocument(payload);
      setState((current) => ({
        ...current,
        uploadedDocuments: [data.document, ...current.uploadedDocuments],
      }));
      setForm({ document_type: form.document_type, file: null });
      setMessage('Uploaded successfully. Videshway will review this document.');
    } catch (error) {
      setMessage(error.message || 'Upload failed. Please ask your counselor for a new link.');
    } finally {
      setSubmitting(false);
    }
  }

  const checklist = state.student?.required_documents?.length
    ? state.student.required_documents
    : requiredDocuments;

  if (!isSupabaseConfigured || !studentCode || !inviteToken) {
    return (
      <main className="public-portal-page">
        <section className="public-portal-panel">
          <AlertCircle size={34} />
          <h1>Upload link unavailable</h1>
          <p>This upload link is missing secure configuration. Please ask your counselor for a new link.</p>
        </section>
      </main>
    );
  }

  if (state.error && !state.otpSent && !state.verified) {
    return (
      <main className="public-portal-page">
        <section className="public-portal-panel">
          <AlertCircle size={34} />
          <h1>Link expired or already used</h1>
          <p>{state.error}</p>
          <a className="primary-button" href="mailto:support@bizzlo.co?subject=New%20Bizzlo%20student%20upload%20link%20needed">
            Request new link
          </a>
        </section>
      </main>
    );
  }

  if (!state.verified) {
    return (
      <main className="public-portal-page">
        <section className="public-portal-panel portal-otp-panel">
          <GraduationCap size={32} />
          <h1>Verify student upload</h1>
          <p>Complete the human check, send a one-time code to the student email, then enter it here to open the secure uploader.</p>

          {!state.otpSent ? (
            <form className="auth-form" onSubmit={requestOtp}>
              <TurnstileBox onVerify={setTurnstileToken} />
              {state.error ? <p className="form-error">{state.error}</p> : null}
              {message ? <p className="form-success">{message}</p> : null}
              <button className="primary-button" type="submit" disabled={state.loading || !turnstileToken}>
                <Send size={15} />
                {state.loading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={verifyOtp}>
              <TextInput label="Six-digit code" inputMode="numeric" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              {state.error ? <p className="form-error">{state.error}</p> : null}
              {message ? <p className="form-success">{message}</p> : null}
              <button className="primary-button" type="submit" disabled={state.loading || otp.length !== 6}>
                <KeyRound size={15} />
                {state.loading ? 'Verifying...' : 'Verify code'}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="public-portal-page">
      <section className="public-portal-shell">
        <header className="public-portal-header">
          <div className="brand-mark">
            <GraduationCap size={24} />
          </div>
          <div>
            <p>Secure student upload</p>
            <h1>{state.student.first_name} {state.student.last_name}</h1>
          </div>
        </header>

        <div className="public-portal-grid">
          <Panel title="Document Checklist" description="Upload each required file once. Videshway admin will review and approve the documents inside Bizzlo.">
            <div className="checklist">
              {checklist.map((type) => {
                const document = state.uploadedDocuments.find((item) => item.document_type === type);
                return (
                  <div key={type}>
                    {document ? <CheckCircle2 size={17} /> : <FileCheck2 size={17} />}
                    <span>{type}</span>
                    <small>{document ? `Uploaded ${bytesToLabel(document.file_size)}` : 'Required'}</small>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Upload File" description="PDF, image, and document uploads are stored in Bizzlo private storage.">
            <form className="upload-box compact-upload" onSubmit={handleUpload}>
              <UploadCloud size={34} />
              <SelectInput label="Document type" required value={form.document_type} onChange={(event) => setForm({ ...form, document_type: event.target.value })}>
                {checklist.map((type) => <option key={type}>{type}</option>)}
              </SelectInput>
              <label className="field">
                <span>File</span>
                <input required type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} />
              </label>
              {form.file ? <p className="muted-copy">{form.file.name} · {bytesToLabel(form.file.size)}</p> : null}
              {message ? <p className={message.includes('success') ? 'form-success' : 'form-error'}>{message}</p> : null}
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Uploading...' : 'Upload document'}
              </button>
            </form>
          </Panel>
        </div>
      </section>
    </main>
  );
}
