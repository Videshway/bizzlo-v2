import { useMemo, useState } from 'react';
import { CheckCircle2, Download, MessageSquarePlus, Plus, Send, ShieldCheck } from 'lucide-react';
import { intakeOptions } from '../data/formOptions';
import { applicationStageAliases, applicationStages, requiredDocuments } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { summarizeCommissions } from '../lib/dashboardInsights';
import { labelFor, money } from '../lib/status';
import { isAdminRole } from '../lib/roles';
import { Badge, EmptyState, Modal, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

const adminStatuses = [
  'profile_incomplete',
  'documents_pending',
  'ready_for_admin_review',
  'pending_admin_review',
  'admin_changes_requested',
  'submitted_to_university',
  'awaiting_decision',
  'offer_received',
  'offer_rejected',
  'conditional_offer',
  'unconditional_offer',
  'deposit_paid',
  'cas_issued',
  'visa_filed',
  'visa_granted',
  'enrolled',
  'rejected',
];

const applicationIntakeMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Spring',
  'Summer',
  'Fall',
  'Winter',
];
const partnerSubmitStatuses = new Set(['profile_incomplete', 'documents_pending', 'admin_changes_requested']);
const adminReviewStatuses = new Set(['ready_for_admin_review', 'pending_admin_review']);
const submittedDocumentStatuses = new Set(['uploaded', 'approved']);

function stageIndex(status) {
  const normalizedStatus = applicationStageAliases[status] || status;
  const index = applicationStages.indexOf(normalizedStatus);
  return index === -1 ? 0 : index;
}

function isRejectedOutcome(status) {
  return ['offer_rejected', 'rejected'].includes(status);
}

function documentForType(documents, type) {
  return documents.filter((document) => document.type === type).sort((left, right) => (
    Number(Boolean(right.application_id)) - Number(Boolean(left.application_id))
    || (Date.parse(right.created_at || right.uploaded_at) || 0) - (Date.parse(left.created_at || left.uploaded_at) || 0)
  ))[0];
}

function intakeMonth(value) {
  return intakeOptions.find((item) => String(value || '').toLowerCase().includes(item.toLowerCase())) || intakeOptions[0];
}

function applicationIntakeMonth(value) {
  return applicationIntakeMonths.find((item) => String(value || '').toLowerCase().includes(item.toLowerCase())) || intakeMonth(value);
}

function applicationReference(application) {
  return application.application_code || String(application.id || '').slice(0, 8).toUpperCase() || 'Unassigned';
}

function applicationYear(application) {
  return String(application.intake || '').match(/20\d{2}/)?.[0] || '';
}

function applicationUpdatedDate(application) {
  const value = application.updated_at || application.created_at;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesUpdatedDate(application, dateFilter) {
  if (!dateFilter) return true;
  const date = applicationUpdatedDate(application);
  if (!date) return false;
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return localDate === dateFilter;
}

function selectVisibleApplication(filtered, applications, selectedId) {
  if (selectedId && !applications.some((application) => application.id === selectedId)) return undefined;
  return filtered.find((application) => application.id === selectedId) || filtered[0];
}

function matchesApplicationIntake(application, intake) {
  if (intake === 'All') return true;
  return String(application.intake || '').toLowerCase().includes(intake.toLowerCase());
}

function csvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function downloadApplications(filename, rows, students) {
  const header = ['Application ID', 'Student', 'University', 'Program', 'Country', 'Intake', 'Status', 'Fee Status', 'Deposit Status'];
  const body = rows.map((application) => {
    const student = students.find((item) => item.id === application.student_id);
    return [
      application.id,
      student ? `${student.first_name} ${student.last_name}` : '',
      application.university,
      application.course,
      application.country,
      application.intake,
      labelFor(application.status),
      labelFor(application.fee_status),
      labelFor(application.deposit_status),
    ].map(csvCell).join(',');
  });
  const blob = new Blob(['\uFEFF', [header.map(csvCell).join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function studentOptionLabel(student) {
  if (!student) return '';
  return `${student.first_name} ${student.last_name} - ${student.student_code || student.email || 'Student'}`;
}

function findStudentFromInput(value, students) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) return null;
  const exactMatch = students.find((student) => [studentOptionLabel(student), student.email, student.student_code].some((item) => String(item || '').toLowerCase() === normalizedValue));
  if (exactMatch) return exactMatch;
  const nameMatches = students.filter((student) => {
    const fullName = `${student.first_name} ${student.last_name}`.trim().toLowerCase();
    return fullName === normalizedValue;
  });
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

export function Applications({ initialQuery = '', initialApplicationId = '' }) {
  const {
    addApplication,
    addApplicationNote,
    courses,
    currentUser,
    updateApplicationStatus,
    visibleApplicationNotes,
    visibleApplications,
    visibleCommissions,
    visibleDocuments,
    visibleStudents,
  } = useAppState();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [intakeFilter, setIntakeFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [updatedDateFilter, setUpdatedDateFilter] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState(initialApplicationId || visibleApplications[0]?.id || '');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState({
    student_id: visibleStudents[0]?.id || '',
    university: '',
    country: '',
    course: '',
    intake: 'September',
  });
  const [studentSearch, setStudentSearch] = useState(studentOptionLabel(visibleStudents[0]));
  const [formError, setFormError] = useState('');

  const countries = useMemo(() => ['All', ...new Set(visibleApplications.map((application) => application.country).filter(Boolean).sort())], [visibleApplications]);
  const universities = useMemo(() => ['All', ...new Set(visibleApplications.map((application) => application.university).filter(Boolean).sort())], [visibleApplications]);
  const intakeChoices = useMemo(() => ['All', ...new Set([...intakeOptions, ...visibleApplications.map((application) => applicationIntakeMonth(application.intake))])], [visibleApplications]);
  const yearChoices = useMemo(() => ['All', ...new Set(visibleApplications.map(applicationYear).filter(Boolean).sort())], [visibleApplications]);
  const commissionTotals = useMemo(() => summarizeCommissions(visibleCommissions), [visibleCommissions]);

  const filteredApplications = useMemo(() => visibleApplications.filter((application) => {
    if (statusFilter !== 'All' && application.status !== statusFilter) return false;
    if (countryFilter !== 'All' && application.country !== countryFilter) return false;
    if (universityFilter !== 'All' && application.university !== universityFilter) return false;
    if (!matchesApplicationIntake(application, intakeFilter)) return false;
    if (yearFilter !== 'All' && applicationYear(application) !== yearFilter) return false;
    if (!matchesUpdatedDate(application, updatedDateFilter)) return false;
    const student = visibleStudents.find((item) => item.id === application.student_id);
    const haystack = `${student?.first_name} ${student?.last_name} ${student?.email || ''} ${student?.student_code || ''} ${application.id} ${application.university} ${application.course} ${application.country}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [countryFilter, updatedDateFilter, intakeFilter, query, statusFilter, universityFilter, visibleApplications, visibleStudents, yearFilter]);

  const selectedApplication = selectVisibleApplication(filteredApplications, visibleApplications, selectedApplicationId);
  const unavailableSelection = Boolean(selectedApplicationId && !visibleApplications.some((application) => application.id === selectedApplicationId));
  const noteBody = noteDrafts[selectedApplication?.id] || '';
  const hasFilters = Boolean(query || updatedDateFilter || [statusFilter, countryFilter, universityFilter, intakeFilter, yearFilter].some((value) => value !== 'All'));
  const selectedStudent = selectedApplication
    ? visibleStudents.find((student) => student.id === selectedApplication.student_id)
    : null;
  const selectedDocuments = selectedApplication
    ? visibleDocuments.filter((document) => (
      document.application_id === selectedApplication.id
      || (!document.application_id && document.student_id === selectedApplication.student_id)
    ))
    : [];
  const selectedNotes = selectedApplication
    ? visibleApplicationNotes.filter((note) => note.application_id === selectedApplication.id)
    : [];
  const selectedCommission = selectedApplication
    ? visibleCommissions.find((commission) => commission.application_id === selectedApplication.id)
    : null;
  const completedDocuments = requiredDocuments.filter((type) => documentForType(selectedDocuments, type)?.status === 'approved').length;
  const submittedDocuments = requiredDocuments.filter((type) => {
    const document = documentForType(selectedDocuments, type);
    return submittedDocumentStatuses.has(document?.status);
  }).length;
  const completion = Math.round((completedDocuments / requiredDocuments.length) * 100);
  const statusOptions = adminStatuses;
  const adminUser = isAdminRole(currentUser.role);
  const canPartnerSendToAdmin = !adminUser
    && selectedApplication
    && partnerSubmitStatuses.has(selectedApplication.status);
  const partnerWaitingForAdmin = !adminUser
    && selectedApplication
    && adminReviewStatuses.has(selectedApplication.status);
  const partnerStatusLocked = !adminUser
    && selectedApplication
    && !canPartnerSendToAdmin
    && !partnerWaitingForAdmin;
  const hasSubmittedDocuments = submittedDocuments > 0;

  function clearFilters() {
    setQuery('');
    setStatusFilter('All');
    setCountryFilter('All');
    setUniversityFilter('All');
    setIntakeFilter('All');
    setYearFilter('All');
    setUpdatedDateFilter('');
  }

  function selectApplication(id) {
    setSelectedApplicationId(id);
    setActionError('');
  }

  function openApplicationModal(nextFields = {}) {
    const selectedFormStudent = visibleStudents.find((student) => student.id === form.student_id) || visibleStudents[0];
    setForm({
      student_id: selectedFormStudent?.id || '',
      university: '',
      country: '',
      course: '',
      intake: 'September',
      ...nextFields,
    });
    setStudentSearch(studentOptionLabel(selectedFormStudent));
    setFormError('');
    setOpen(true);
  }

  function fromCourse(course) {
    openApplicationModal({
      student_id: form.student_id || visibleStudents[0]?.id || '',
      university: course.university,
      country: course.country,
      course: course.course,
      intake: intakeMonth(course.intake),
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const chosenStudent = visibleStudents.find((student) => student.id === form.student_id) || findStudentFromInput(studentSearch, visibleStudents);
    if (!chosenStudent) {
      setFormError('Select an existing student by email or student code, or create their file in Students first.');
      return;
    }
    if (![form.university, form.country, form.course].every((value) => value.trim())) {
      setFormError('Enter a university, country, and course.');
      return;
    }
    setSubmitting(true);
    try {
      const nextApplication = await addApplication({ ...form, university: form.university.trim(), country: form.country.trim(), course: form.course.trim(), student_id: chosenStudent.id });
      setSelectedApplicationId(nextApplication.id);
      clearFilters();
      setOpen(false);
    } catch (error) {
      setFormError(error?.message || 'Could not create this application.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNoteSubmit(event) {
    event.preventDefault();
    if (!selectedApplication || !noteBody.trim() || noteSubmitting) return;
    const applicationId = selectedApplication.id;
    setNoteSubmitting(true);
    setActionError('');
    try {
      await addApplicationNote(applicationId, noteBody.trim());
      setNoteDrafts((current) => ({ ...current, [applicationId]: '' }));
    } catch (error) {
      setActionError(error?.message || 'Could not save your comment. Your draft is still here.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function handleSendToAdmin() {
    if (!selectedApplication || !hasSubmittedDocuments || statusSubmitting) return;
    setStatusSubmitting(true);
    setActionError('');
    try {
      await updateApplicationStatus(selectedApplication.id, 'ready_for_admin_review');
    } catch (error) {
      setActionError(error?.message || 'Could not send this application for review. Please try again.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function handleStatusChange(status) {
    if (!selectedApplication || statusSubmitting) return;
    setStatusSubmitting(true);
    setActionError('');
    try {
      await updateApplicationStatus(selectedApplication.id, status);
    } catch (error) {
      setActionError(error?.message || 'Could not update this application. Please try again.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Applications</h1>
          <p>Move each application forward with clear requirements, shared notes, and progress you can trust.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" disabled={filteredApplications.length === 0} onClick={() => downloadApplications('bizzlo-application-data.csv', filteredApplications, visibleStudents)}>
            <Download size={17} />
            Export Application Data
          </button>
          <button className="primary-button" type="button" onClick={() => openApplicationModal()}>
            <Plus size={17} />
            New application
          </button>
        </div>
      </div>

      <div className="app-metrics">
        <section>
          <span>Total applications</span>
          <strong>{visibleApplications.length}</strong>
        </section>
        <section>
          <span>Admin review</span>
          <strong>{visibleApplications.filter((item) => adminReviewStatuses.has(item.status)).length}</strong>
        </section>
        <section>
          <span>Offers</span>
          <strong>{visibleApplications.filter((item) => ['offer_received', 'conditional_offer', 'unconditional_offer'].includes(item.status)).length}</strong>
        </section>
        <section>
          <span>Commission pipeline</span>
          <strong>{commissionTotals.map((group) => `${group.count === group.missingAmounts ? `${group.currency}: amount not recorded` : money(group.amount, group.currency)}${group.missingAmounts > 0 && group.count !== group.missingAmounts ? ' + unrecorded amounts' : ''}`).join(' · ') || 'Not recorded'}</strong>
        </section>
      </div>

      <Panel>
        <div className="toolbar application-filter-bar">
          <div className="search-box">
            <Send size={17} />
            <input aria-label="Search applications" placeholder="Search student, university, course..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <SelectInput label="Country" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
            {countries.map((country) => <option key={country}>{country}</option>)}
          </SelectInput>
          <SelectInput label="University" value={universityFilter} onChange={(event) => setUniversityFilter(event.target.value)}>
            {universities.map((university) => <option key={university}>{university}</option>)}
          </SelectInput>
          <SelectInput label="Intake" value={intakeFilter} onChange={(event) => setIntakeFilter(event.target.value)}>
            {intakeChoices.map((intake) => <option key={intake}>{intake}</option>)}
          </SelectInput>
          <SelectInput label="Year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            {yearChoices.map((year) => <option key={year}>{year}</option>)}
          </SelectInput>
          <SelectInput label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All</option>
            {adminStatuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
          </SelectInput>
          <TextInput label="Updated on" type="date" value={updatedDateFilter} onChange={(event) => setUpdatedDateFilter(event.target.value)} />
          {hasFilters ? <button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button> : null}
        </div>
      </Panel>

      <div className="application-workspace">
        <Panel title="Application Queue" description={`${filteredApplications.length} of ${visibleApplications.length} applications · Select a file to review its next step.`}>
          <div className="application-list">
            {filteredApplications.length === 0 ? <EmptyState icon={Send} title={hasFilters ? 'No matching applications' : 'Start your first application'} text={hasFilters ? 'Clear a filter or try a different student, university, or course.' : 'Choose a student and a program to start tracking their progress.'} /> : null}
            {filteredApplications.map((application) => {
              const student = visibleStudents.find((item) => item.id === application.student_id);
              const docs = visibleDocuments.filter((document) => document.application_id === application.id || (!document.application_id && document.student_id === application.student_id));
              const approved = requiredDocuments.filter((type) => documentForType(docs, type)?.status === 'approved').length;
              return (
                <button
                  className={application.id === selectedApplication?.id ? 'application-row active' : 'application-row'}
                  key={application.id}
                  type="button"
                  aria-pressed={application.id === selectedApplication?.id}
                  onClick={() => selectApplication(application.id)}
                >
                  <div>
                    <strong>{student?.first_name} {student?.last_name}</strong>
                    <span>{application.university}</span>
                    <small>{application.course} · {application.intake}</small>
                  </div>
                  <div>
                    <StatusBadge value={application.status} />
                    <small>{approved}/{requiredDocuments.length} docs</small>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          title={selectedApplication ? `${selectedApplication.university}` : unavailableSelection ? 'Application unavailable' : 'Application Detail'}
          description={selectedApplication ? `${selectedApplication.course} · ${selectedApplication.country}` : 'Select an application to inspect requirements.'}
          className="application-detail-panel"
        >
          {selectedApplication ? (
            <div className="application-detail">
              <div className="detail-head">
                <div>
                  <Badge tone="info">{selectedStudent?.student_code || 'Student'}</Badge>
                  <h2>{selectedStudent?.first_name} {selectedStudent?.last_name}</h2>
                  <p>{selectedStudent?.email} · {selectedStudent?.study_level} · {selectedStudent?.discipline}</p>
                </div>
                {adminUser ? (
                  <label className="field compact-select">
                    <span>Status</span>
                    <select value={selectedApplication.status} disabled={statusSubmitting} onChange={(event) => handleStatusChange(event.target.value)}>
                      {statusOptions.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="partner-status-control">
                    <span>Current stage</span>
                    <StatusBadge value={selectedApplication.status} />
                    {canPartnerSendToAdmin ? (
                      <button className="primary-button" type="button" disabled={!hasSubmittedDocuments || statusSubmitting} onClick={handleSendToAdmin}>
                        <Send size={16} />
                        {statusSubmitting ? 'Sending…' : 'Send to admin'}
                      </button>
                    ) : null}
                    {partnerWaitingForAdmin ? <small>Submitted to Videshway admin for decision.</small> : null}
                    {partnerStatusLocked ? <small>Videshway admin controls the next movement.</small> : null}
                    {!hasSubmittedDocuments && canPartnerSendToAdmin ? <small>Upload at least one document first.</small> : null}
                  </div>
                )}
              </div>
              {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}

              <div className="stage-track">
                {applicationStages.map((stage, index) => {
                  const currentStageIndex = stageIndex(selectedApplication.status);
                  const failedAtOffer = isRejectedOutcome(selectedApplication.status) && stage === 'offer_received';
                  const className = [
                    'stage-step',
                    index <= currentStageIndex ? 'complete' : '',
                    failedAtOffer ? 'failed' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <div className={className} key={stage}>
                      <span>{index + 1}</span>
                      <small>{failedAtOffer ? labelFor(selectedApplication.status) : labelFor(stage)}</small>
                    </div>
                  );
                })}
              </div>

              <div className={isRejectedOutcome(selectedApplication.status) ? 'workflow-outcome rejected' : 'workflow-outcome'}>
                <strong>Workflow</strong>
                <span>
                  {isRejectedOutcome(selectedApplication.status)
                    ? 'This file has a rejected outcome. Admin can reopen it from the status control if the university allows resubmission.'
                    : 'After university submission, admin records offer received or rejected, then deposit, CAS/I-20/COE, visa, and enrollment movement.'}
                </span>
              </div>

              <div className="detail-split">
                <section className="requirement-panel">
                  <div className="section-title-row">
                    <div>
                      <strong>Document Requirements</strong>
                      <span>{submittedDocuments}/{requiredDocuments.length} submitted · {completion}% approved</span>
                    </div>
                    <ShieldCheck size={18} />
                  </div>
                  <progress className="progress-line wide" value={completion} max="100" aria-label="Document completion" />
                  <div className="requirement-list">
                    {requiredDocuments.map((type) => {
                      const document = documentForType(selectedDocuments, type);
                      return (
                        <div key={type}>
                          <CheckCircle2 size={17} />
                          <span>{type}</span>
                          <StatusBadge value={document ? (document.status === 'rejected' ? 'rejected_document' : document.status) : 'documents_pending'} />
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="requirement-panel">
                  <div className="section-title-row">
                    <div>
                      <strong>Payments & Commission</strong>
                      <span>Visible to manager and admin</span>
                    </div>
                    <StatusBadge value={selectedCommission?.status || 'projected'} />
                  </div>
                  <dl className="detail-dl">
                    <div><dt>Application fee</dt><dd>{labelFor(selectedApplication.fee_status)}</dd></div>
                    <div><dt>Deposit</dt><dd>{labelFor(selectedApplication.deposit_status)}</dd></div>
                    <div><dt>Commission</dt><dd>{selectedCommission ? money(selectedCommission.expected_amount, selectedCommission.currency) : 'Projected after offer'}</dd></div>
                    <div><dt>Finance status</dt><dd>{labelFor(selectedCommission?.status || 'projected')}</dd></div>
                  </dl>
                </section>
              </div>

              <section className="notes-panel">
                <div className="section-title-row">
                  <div>
                    <strong>Comments & Notifications</strong>
                    <span>Shared timeline for counselor, manager, and Videshway admin.</span>
                  </div>
                  <MessageSquarePlus size={18} />
                </div>
                <form className="note-form" onSubmit={handleNoteSubmit}>
                  <textarea aria-label="Application comment" placeholder="Add an internal comment or instruction..." disabled={noteSubmitting} value={noteBody} onChange={(event) => setNoteDrafts((current) => ({ ...current, [selectedApplication.id]: event.target.value }))} />
                  <button className="secondary-button" type="submit" disabled={noteSubmitting || !noteBody.trim()}>{noteSubmitting ? 'Saving…' : 'Add comment'}</button>
                </form>
                <div className="note-list">
                  {selectedNotes.length === 0 ? <p className="muted-copy">No comments yet. Add the next step so your team stays aligned.</p> : null}
                  {selectedNotes.map((note) => (
                    <article key={note.id}>
                      <strong>{note.author_name}</strong>
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                      <p>{note.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <p className="muted-copy">{unavailableSelection ? 'This application is no longer available to your account. Select another file from the queue.' : 'No applications match the current filter.'}</p>
          )}
        </Panel>
      </div>

      <Panel title="All application details" description="References, study plans, and current progress for the selected filters.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Last updated</th>
                <th>Student</th>
                <th>University</th>
                <th>Program</th>
                <th>Intake</th>
                <th>Status</th>
                <th>Fee status</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => {
                const student = visibleStudents.find((item) => item.id === application.student_id);
                const updatedDate = applicationUpdatedDate(application);
                return (
                  <tr key={`table-${application.id}`}>
                    <td>
                      <button className="table-link-button" type="button" title={application.id} onClick={() => selectApplication(application.id)}>
                        {applicationReference(application)}
                      </button>
                    </td>
                    <td>{updatedDate ? updatedDate.toLocaleDateString() : 'Not recorded'}{updatedDate ? <small>{updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small> : null}</td>
                    <td>{student?.first_name} {student?.last_name}<small>{student?.student_code}</small></td>
                    <td>{application.university}<small>{application.country}</small></td>
                    <td>{application.course}</td>
                    <td>{application.intake}</td>
                    <td><StatusBadge value={application.status} /></td>
                    <td><StatusBadge value={application.fee_status} /></td>
                  </tr>
                );
              })}
              {filteredApplications.length === 0 ? <tr><td colSpan={8}><p className="muted-copy">No applications to display.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Start from a program" description="Choose a course from the partner catalogue, then attach a student to begin.">
        <div className="course-mini-grid">
          {courses.slice(0, 3).map((course) => (
            <button className="course-mini" type="button" key={course.id} onClick={() => fromCourse(course)}>
              <Send size={16} />
              <strong>{course.course}</strong>
              <span>{course.university} · {course.intake}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Modal open={open} onClose={() => { if (!submitting) setOpen(false); }} title="Create Application" description="Attach one student to one course and start the document/admin workflow.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Student</span>
            <input
              list="application-student-options"
              placeholder="Type student name, email, or code"
              required
              value={studentSearch}
              onChange={(event) => {
                const nextValue = event.target.value;
                const matchedStudent = findStudentFromInput(nextValue, visibleStudents);
                setStudentSearch(nextValue);
                setForm({ ...form, student_id: matchedStudent?.id || '' });
                setFormError('');
              }}
            />
            <datalist id="application-student-options">
              {visibleStudents.map((student) => (
                <option key={student.id} value={studentOptionLabel(student)} />
              ))}
            </datalist>
          </label>
          <TextInput label="University" required value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value })} />
          <TextInput label="Country" required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          <TextInput label="Course" required value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })} />
          <SelectInput label="Intake" required value={form.intake} onChange={(event) => setForm({ ...form, intake: event.target.value })}>
            {intakeOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          {formError ? <p className="form-error form-wide" role="alert">{formError}</p> : null}
          <footer className="form-footer">
            <button className="secondary-button" type="button" disabled={submitting} onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create application'}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
