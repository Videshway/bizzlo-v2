import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, Copy, FileCheck2, UploadCloud } from 'lucide-react';
import { requiredDocuments } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { EmptyState, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

export function StudentPortal({ onNavigate }) {
  const {
    activeInviteStudentId,
    activeInviteUrl,
    addDocument,
    createStudentInvite,
    studentInvites,
    visibleApplications,
    visibleDocuments,
    visibleStudents,
  } = useAppState();
  const student = visibleStudents.find((item) => item.id === activeInviteStudentId);
  const applications = useMemo(() => (
    student ? visibleApplications.filter((application) => application.student_id === student.id) : []
  ), [student, visibleApplications]);
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [formError, setFormError] = useState('');
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState({
    type: requiredDocuments[0],
    application_id: '',
    filename: '',
    file: null,
  });

  if (!student) {
    const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
    return (
      <div className="page-grid">
        <div className="page-heading">
          <div>
            <h1>Student Link</h1>
            <p>Select a student from the Students page to open their upload checklist.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => onNavigate('students')}>
            <ArrowLeft size={16} />
            Back to students
          </button>
        </div>
        <Panel>
          <EmptyState
            icon={ClipboardCheck}
            title={inviteFromUrl ? 'Invite unavailable' : 'No student invite selected'}
            text={inviteFromUrl
              ? 'This student link is not available to your account. Ask Videshway admin if you need access.'
              : 'Open a student invite to view the document checklist and upload area.'}
          />
        </Panel>
      </div>
    );
  }

  const inviteLink = activeInviteUrl || `${window.location.origin}/invite/${encodeURIComponent(student.student_code.toLowerCase())}`;
  const studentDocuments = visibleDocuments.filter((document) => document.student_id === student.id);
  const inviteRows = studentInvites.filter((invite) => invite.student_id === student.id);

  async function refreshInviteLink() {
    const { link } = await createStudentInvite(student.id);
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  async function handleUpload(event) {
    event.preventDefault();
    setFormError('');
    if (!form.type || (!form.file && !form.filename.trim())) {
      setFormError('Choose a document type and upload a file or enter a filename.');
      return;
    }
    setSubmitting(true);
    try {
      await addDocument({
        student_id: student.id,
        application_id: form.application_id,
        type: form.type,
        filename: form.filename || form.file?.name,
        file: form.file,
      });
      setForm({ type: form.type, application_id: form.application_id, filename: '', file: null });
      setFileInputKey((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Student Document Link</h1>
          <p>{student.first_name} {student.last_name} can complete documents and see review status here.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate('students')}>
          <ArrowLeft size={16} />
          Back to students
        </button>
      </div>

      <Panel title="Invite Link" description="Copy the signed student upload link. New links are scoped to this student and expire from the invite table.">
        <div className="invite-strip">
          <ClipboardCheck size={19} />
          <div>
            <strong>{student.student_code} · {student.email}</strong>
            <span>{inviteLink}</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => refreshInviteLink().catch(() => {})}>
            <ClipboardCheck size={15} />
            New
          </button>
          <button className="secondary-button" type="button" onClick={() => navigator.clipboard?.writeText(inviteLink).catch(() => {})}>
            <Copy size={15} />
            Copy
          </button>
        </div>
      </Panel>

      <Panel title="Active Student Invites" description="Counselors can see links they created; Videshway admin can see all invite status.">
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Used</th>
              </tr>
            </thead>
            <tbody>
              {inviteRows.map((invite) => {
                const expired = invite.expires_at && new Date(invite.expires_at).getTime() < now;
                return (
                  <tr key={invite.id}>
                    <td><StatusBadge value={invite.used_at ? 'approved' : expired ? 'rejected_document' : invite.status} /></td>
                    <td>{invite.created_at ? new Date(invite.created_at).toLocaleDateString() : '-'}</td>
                    <td>{invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : '-'}</td>
                    <td>{invite.used_at ? new Date(invite.used_at).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
              {!inviteRows.length ? (
                <tr><td colSpan="4">No visible invite records for this student yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="dashboard-columns">
        <Panel title="Required Documents" description="Approved files stop needing action; rejected files stay visible for re-upload.">
          <div className="checklist">
            {requiredDocuments.map((type) => {
              const document = studentDocuments.find((item) => item.type === type);
              return (
                <div key={type}>
                  <FileCheck2 size={17} />
                  <span>{type}</span>
                  <StatusBadge value={document ? (document.status === 'rejected' ? 'rejected_document' : document.status) : 'documents_pending'} />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Upload Document" description="Files uploaded here land in Videshway admin document review.">
          <form className="upload-box compact-upload" onSubmit={handleUpload}>
            <UploadCloud size={34} />
            <SelectInput label="Application" value={form.application_id} onChange={(event) => setForm({ ...form, application_id: event.target.value })}>
              <option value="">General student file</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>{application.university} - {application.course}</option>
              ))}
            </SelectInput>
            <SelectInput label="Document type *" required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {requiredDocuments.map((type) => <option key={type}>{type}</option>)}
            </SelectInput>
            <label className="field">
              <span>File *</span>
              <input key={fileInputKey} type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} />
            </label>
            <TextInput label="Filename *" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} placeholder="passport.pdf" />
            {formError ? <p className="form-error">{formError}</p> : null}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Uploading...' : 'Upload document'}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
