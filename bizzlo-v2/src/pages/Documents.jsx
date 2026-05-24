import { useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, FileDown, ShieldCheck, UploadCloud } from 'lucide-react';
import { useAppState } from '../lib/appState';
import { isAdminRole } from '../lib/roles';
import { Badge, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

const documentTypes = ['Passport', 'Academic Transcript', 'Degree Certificate', 'IELTS', 'SOP', 'LOR', 'CV', 'Bank Statement', 'Visa Document'];

function triggerDownload({ url, filename, revoke }, preparedWindow = null) {
  if (preparedWindow && !preparedWindow.closed) {
    preparedWindow.location.href = url;
    if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 500);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function Documents() {
  const {
    addDocument,
    currentUser,
    getDocumentDownloadUrl,
    refreshDocuments,
    updateDocumentStatus,
    users,
    visibleApplications,
    visibleDocuments,
    visibleStudents,
  } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [downloadId, setDownloadId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    student_id: visibleStudents[0]?.id || '',
    application_id: '',
    type: 'Passport',
    filename: '',
    file: null,
  });

  const selectedStudentId = visibleStudents.some((student) => student.id === form.student_id)
    ? form.student_id
    : visibleStudents[0]?.id || '';
  const studentApplications = visibleApplications.filter((application) => application.student_id === selectedStudentId);
  const filteredDocuments = useMemo(() => visibleDocuments.filter((documentRow) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['uploaded', 'documents_pending'].includes(documentRow.status);
    return documentRow.status === filter;
  }), [filter, visibleDocuments]);
  const pendingReview = visibleDocuments.filter((documentRow) => ['uploaded', 'documents_pending'].includes(documentRow.status)).length;
  const approvedCount = visibleDocuments.filter((documentRow) => documentRow.status === 'approved').length;
  const adminUser = isAdminRole(currentUser.role);

  useEffect(() => {
    refreshDocuments?.().catch(() => {});
  }, [refreshDocuments]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!selectedStudentId || !form.type || (!form.file && !form.filename.trim())) {
      setFormError('Choose a student, document type, and upload a file or enter a filename.');
      return;
    }
    setSubmitting(true);
    try {
      await addDocument({ ...form, student_id: selectedStudentId, filename: form.filename || form.file?.name || `${form.type.toLowerCase().replaceAll(' ', '-')}.pdf` });
      setForm({ ...form, filename: '', file: null });
      setFileInputKey((prev) => prev + 1);
    } catch (error) {
      setFormError(error?.message || 'Could not upload this document.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(documentId) {
    setDownloadId(documentId);
    setDownloadError('');
    const preparedWindow = window.open('about:blank', '_blank');
    if (preparedWindow) {
      preparedWindow.opener = null;
      preparedWindow.document.title = 'Preparing Bizzlo document...';
      preparedWindow.document.body.innerHTML = '<p style="font-family: system-ui, sans-serif; padding: 24px;">Preparing secure Bizzlo document download...</p>';
    }
    try {
      const download = await getDocumentDownloadUrl(documentId);
      triggerDownload(download, preparedWindow);
    } catch (error) {
      if (preparedWindow && !preparedWindow.closed) preparedWindow.close();
      setDownloadError(error?.message || 'Could not prepare this document download.');
    } finally {
      setDownloadId('');
    }
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Document Vault</h1>
          <p>Partners upload here. Videshway admin reviews, approves or rejects, and every accepted file remains downloadable.</p>
        </div>
      </div>

      <div className="document-stats">
        <section><strong>{visibleDocuments.length}</strong><span>Total files</span></section>
        <section><strong>{pendingReview}</strong><span>Waiting admin review</span></section>
        <section><strong>{approvedCount}</strong><span>Approved for submission</span></section>
        <section><strong>{visibleDocuments.filter((documentRow) => documentRow.status === 'rejected').length}</strong><span>Need re-upload</span></section>
      </div>

      <div className="dashboard-columns">
        <Panel title="Partner Upload" description="Manager/counselor uploads are immediately visible in the Videshway admin queue.">
          <form className="upload-box" onSubmit={handleSubmit}>
            <UploadCloud size={36} />
            <strong>Drop required file here</strong>
            <span>Student, document type, and file/filename are mandatory before sending to admin review.</span>
            <SelectInput label="Student *" required value={selectedStudentId} onChange={(event) => setForm({ ...form, student_id: event.target.value, application_id: '' })}>
              {visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
            </SelectInput>
            <SelectInput label="Application" value={form.application_id} onChange={(event) => setForm({ ...form, application_id: event.target.value })}>
              <option value="">General student file</option>
              {studentApplications.map((application) => (
                <option key={application.id} value={application.id}>{application.university} - {application.course}</option>
              ))}
            </SelectInput>
            <SelectInput label="Document type *" required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {documentTypes.map((type) => <option key={type}>{type}</option>)}
            </SelectInput>
            <label className="field">
              <span>File *</span>
              <input
                key={fileInputKey}
                type="file"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })}
              />
            </label>
            <TextInput label="Filename *" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} placeholder="passport.pdf" />
            {formError ? <p className="form-error">{formError}</p> : null}
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Uploading...' : 'Upload to review queue'}</button>
          </form>
        </Panel>

        <Panel title="Selected Student Checklist" description="This follows the chosen student in the upload form.">
          <div className="checklist">
            {documentTypes.slice(0, 8).map((type) => {
              const documentRow = visibleDocuments.find((item) => item.student_id === selectedStudentId && item.type === type);
              return (
                <div key={type}>
                  <FileCheck2 size={17} />
                  <span>{type}</span>
                  <StatusBadge value={documentRow ? (documentRow.status === 'rejected' ? 'rejected_document' : documentRow.status) : 'documents_pending'} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel
        title="Document Review Queue"
        description="Admin approval controls whether the file is ready for university submission."
        action={(
          <SelectInput label="Queue filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All files</option>
            <option value="pending">Waiting review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </SelectInput>
        )}
      >
        {downloadError ? <p className="form-error">{downloadError}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Student</th>
                <th>Application</th>
                <th>Uploaded by</th>
                <th>Status</th>
                <th>Notes</th>
                <th>File</th>
                {adminUser ? <th>Admin review</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((documentRow) => {
                const student = visibleStudents.find((item) => item.id === documentRow.student_id);
                const application = visibleApplications.find((item) => item.id === documentRow.application_id);
                const uploader = users.find((user) => user.id === documentRow.uploaded_by);
                return (
                  <tr key={documentRow.id}>
                    <td>
                      <strong>{documentRow.type}</strong>
                      <small>{documentRow.filename} · {documentRow.size}</small>
                    </td>
                    <td>{student?.first_name} {student?.last_name}</td>
                    <td>{application ? `${application.university} · ${application.course}` : 'General file'}</td>
                    <td>{uploader?.name || 'Partner user'}<small>{uploader?.role || 'uploaded'}</small></td>
                    <td>
                      <StatusBadge value={documentRow.status === 'rejected' ? 'rejected_document' : documentRow.status} />
                      <small>Scan: {documentRow.scan_status || 'skipped'}</small>
                    </td>
                    <td>{documentRow.note || '-'}</td>
                    <td>
                      <button className="row-icon-button" type="button" disabled={downloadId === documentRow.id} onClick={() => handleDownload(documentRow.id)}>
                        {downloadId === documentRow.id ? <FileDown size={15} /> : <Download size={15} />}
                        {downloadId === documentRow.id ? 'Preparing' : 'Download'}
                      </button>
                    </td>
                    {adminUser ? (
                      <td>
                        {documentRow.status === 'approved' ? (
                          <Badge tone="success">Approved</Badge>
                        ) : (
                          <div className="row-actions">
                            <button
                              type="button"
                              disabled={(documentRow.scan_status || 'skipped') === 'pending'}
                              title={(documentRow.scan_status || 'skipped') === 'pending' ? 'Document scan must finish before approval.' : 'Approve document'}
                              onClick={() => updateDocumentStatus(documentRow.id, 'approved').catch(() => {})}
                            >
                              Approve
                            </button>
                            <button type="button" onClick={() => updateDocumentStatus(documentRow.id, 'rejected', 'Please upload a clearer copy.').catch(() => {})}>Reject</button>
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <div className="document-protection">
          <ShieldCheck size={18} />
          <div>
            <strong>File handling path</strong>
            <span>Partner upload to private storage, Videshway review, approved download, and university submission.</span>
          </div>
          <Badge tone="success">ready</Badge>
        </div>
      </Panel>
    </div>
  );
}
