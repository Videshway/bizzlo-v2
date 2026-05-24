import { useMemo, useState } from 'react';
import { CheckCircle2, Download, MessageSquarePlus, Plus, Send, ShieldCheck } from 'lucide-react';
import { intakeOptions } from '../data/formOptions';
import { applicationStageAliases, applicationStages, requiredDocuments } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { labelFor, money } from '../lib/status';
import { isAdminRole } from '../lib/roles';
import { Badge, Modal, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

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

const deadlineTypes = [
  'All',
  'Application Deadline',
  'Payment Deadline',
  'CAS Request Deadline',
  'Enrollment Deadline',
  'GS Submission Deadline',
  'Visa Received Deadline',
  'Course Start Date',
  'Offer Acceptance Deadline',
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
  return documents.find((document) => document.type === type);
}

function intakeMonth(value) {
  return intakeOptions.find((item) => String(value || '').toLowerCase().includes(item.toLowerCase())) || intakeOptions[0];
}

function applicationIntakeMonth(value) {
  return applicationIntakeMonths.find((item) => String(value || '').toLowerCase().includes(item.toLowerCase())) || intakeMonth(value);
}

function applicationAck(application, index) {
  const numeric = String(application.id || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
  return `${numeric || String(index + 1).padStart(4, '0')}/26-27`;
}

function applicationYear(application) {
  const match = String(application.intake || application.updated_at || '').match(/20\d{2}/);
  return match?.[0] || '2026';
}

function applicationUpdatedDate(application) {
  return new Date(application.updated_at || '2026-05-22T00:00:00Z');
}

function matchesApplicationIntake(application, intake) {
  if (intake === 'All') return true;
  return String(application.intake || '').toLowerCase().includes(intake.toLowerCase());
}

function downloadApplications(filename, rows, students) {
  const header = ['Ack No', 'Student', 'University', 'Program', 'Country', 'Intake', 'Status', 'Fee Status', 'Deposit Status'];
  const body = rows.map((application, index) => {
    const student = students.find((item) => item.id === application.student_id);
    return [
      applicationAck(application, index),
      student ? `${student.first_name} ${student.last_name}` : '',
      application.university,
      application.course,
      application.country,
      application.intake,
      labelFor(application.status),
      labelFor(application.fee_status),
      labelFor(application.deposit_status),
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
  });
  const blob = new Blob([[header.map((value) => `"${value}"`).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
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
  return students.find((student) => {
    const fullName = `${student.first_name} ${student.last_name}`.trim().toLowerCase();
    const label = studentOptionLabel(student).toLowerCase();
    const email = String(student.email || '').toLowerCase();
    const code = String(student.student_code || '').toLowerCase();
    return [label, fullName, email, code].includes(normalizedValue);
  }) || null;
}

export function Applications() {
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
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [universityFilter, setUniversityFilter] = useState('All');
  const [intakeFilter, setIntakeFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [deadlineType, setDeadlineType] = useState('All');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState(visibleApplications[0]?.id || '');
  const [noteBody, setNoteBody] = useState('');
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
  const yearChoices = useMemo(() => ['All', ...new Set(visibleApplications.map(applicationYear).sort())], [visibleApplications]);

  const filteredApplications = useMemo(() => visibleApplications.filter((application) => {
    if (statusFilter !== 'All' && application.status !== statusFilter) return false;
    if (countryFilter !== 'All' && application.country !== countryFilter) return false;
    if (universityFilter !== 'All' && application.university !== universityFilter) return false;
    if (!matchesApplicationIntake(application, intakeFilter)) return false;
    if (yearFilter !== 'All' && applicationYear(application) !== yearFilter) return false;
    if (deadlineDate && !String(application.updated_at || '').includes(deadlineDate)) return false;
    if (deadlineType !== 'All' && !String(application.status || '').toLowerCase().includes(deadlineType.split(' ')[0].toLowerCase())) return false;
    const student = visibleStudents.find((item) => item.id === application.student_id);
    const haystack = `${student?.first_name} ${student?.last_name} ${application.university} ${application.course} ${application.country}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [countryFilter, deadlineDate, deadlineType, intakeFilter, query, statusFilter, universityFilter, visibleApplications, visibleStudents, yearFilter]);

  const selectedApplication = filteredApplications.find((application) => application.id === selectedApplicationId) || filteredApplications[0];
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
    setFormError('');
    const chosenStudent = visibleStudents.find((student) => student.id === form.student_id) || findStudentFromInput(studentSearch, visibleStudents);
    if (!chosenStudent) {
      setFormError('Select an existing student from the suggestions, or create the student in Intake first.');
      return;
    }
    setSubmitting(true);
    try {
      const nextApplication = await addApplication({ ...form, student_id: chosenStudent.id });
      setSelectedApplicationId(nextApplication.id);
      setOpen(false);
    } catch (error) {
      setFormError(error?.message || 'Could not create this application.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNoteSubmit(event) {
    event.preventDefault();
    if (!selectedApplication || !noteBody.trim()) return;
    await addApplicationNote(selectedApplication.id, noteBody.trim());
    setNoteBody('');
  }

  async function handleSendToAdmin() {
    if (!selectedApplication || !hasSubmittedDocuments) return;
    await updateApplicationStatus(selectedApplication.id, 'ready_for_admin_review').catch(() => {});
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Applications</h1>
          <p>Reference-style workspace for requirements, comments, payments, university submission, and partner visibility.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={() => downloadApplications('bizzlo-application-data.csv', filteredApplications, visibleStudents)}>
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
          <span>Open applications</span>
          <strong>{visibleApplications.length}</strong>
        </section>
        <section>
          <span>Admin review</span>
          <strong>{visibleApplications.filter((item) => item.status === 'pending_admin_review').length}</strong>
        </section>
        <section>
          <span>Offers</span>
          <strong>{visibleApplications.filter((item) => ['offer_received', 'conditional_offer', 'unconditional_offer'].includes(item.status)).length}</strong>
        </section>
        <section>
          <span>Commission pipeline</span>
          <strong>{money(visibleCommissions.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0), visibleCommissions[0]?.currency || 'INR')}</strong>
        </section>
      </div>

      <Panel>
        <div className="toolbar application-filter-bar">
          <div className="search-box">
            <Send size={17} />
            <input placeholder="Search student, university, course..." value={query} onChange={(event) => setQuery(event.target.value)} />
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
          <SelectInput label="Deadline type" value={deadlineType} onChange={(event) => setDeadlineType(event.target.value)}>
            {deadlineTypes.map((type) => <option key={type}>{type}</option>)}
          </SelectInput>
          <TextInput label="Deadline date" type="date" value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} />
        </div>
      </Panel>

      <div className="application-workspace">
        <Panel title="Application Queue" description="List/detail layout like a serious admissions desk.">
          <div className="application-list">
            {filteredApplications.map((application) => {
              const student = visibleStudents.find((item) => item.id === application.student_id);
              const docs = visibleDocuments.filter((document) => document.student_id === application.student_id);
              const approved = requiredDocuments.filter((type) => docs.some((document) => document.type === type && document.status === 'approved')).length;
              return (
                <button
                  className={application.id === selectedApplication?.id ? 'application-row active' : 'application-row'}
                  key={application.id}
                  type="button"
                  onClick={() => setSelectedApplicationId(application.id)}
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
          title={selectedApplication ? `${selectedApplication.university}` : 'Application Detail'}
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
                    <select value={selectedApplication.status} onChange={(event) => updateApplicationStatus(selectedApplication.id, event.target.value).catch(() => {})}>
                      {statusOptions.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="partner-status-control">
                    <span>Current stage</span>
                    <StatusBadge value={selectedApplication.status} />
                    {canPartnerSendToAdmin ? (
                      <button className="primary-button" type="button" disabled={!hasSubmittedDocuments} onClick={handleSendToAdmin}>
                        <Send size={16} />
                        Send to admin
                      </button>
                    ) : null}
                    {partnerWaitingForAdmin ? <small>Submitted to Videshway admin for decision.</small> : null}
                    {partnerStatusLocked ? <small>Videshway admin controls the next movement.</small> : null}
                    {!hasSubmittedDocuments && canPartnerSendToAdmin ? <small>Upload at least one document first.</small> : null}
                  </div>
                )}
              </div>

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
                  <textarea placeholder="Add an internal comment or instruction..." value={noteBody} onChange={(event) => setNoteBody(event.target.value)} />
                  <button className="secondary-button" type="submit">Add comment</button>
                </form>
                <div className="note-list">
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
            <p className="muted-copy">No applications match the current filter.</p>
          )}
        </Panel>
      </div>

      <Panel title="Operations Table" description="Application grid for acknowledgement number, filters, status, and team ownership.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ack. No.</th>
                <th>Date Created</th>
                <th>Student</th>
                <th>University</th>
                <th>Program</th>
                <th>Intake</th>
                <th>Status</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application, index) => {
                const student = visibleStudents.find((item) => item.id === application.student_id);
                const updatedDate = applicationUpdatedDate(application);
                return (
                  <tr key={`table-${application.id}`}>
                    <td>
                      <button className="table-link-button" type="button" onClick={() => setSelectedApplicationId(application.id)}>
                        {applicationAck(application, index)}
                      </button>
                    </td>
                    <td>{updatedDate.toLocaleDateString()}<small>{updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></td>
                    <td>{student?.first_name} {student?.last_name}<small>{student?.student_code}</small></td>
                    <td>{application.university}<small>{application.country}</small></td>
                    <td>{application.course}</td>
                    <td>{application.intake}</td>
                    <td><StatusBadge value={application.status} /></td>
                    <td>{adminUser ? 'Videshway Admin' : currentUser.name}<small>{labelFor(application.fee_status)} fee</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Fast Create From Program Search" description="Build one student into multiple university applications from the partner catalogue.">
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

      <Modal open={open} onClose={() => setOpen(false)} title="Create Application" description="Attach one student to one course and start the document/admin workflow.">
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
          {formError ? <p className="form-error form-wide">{formError}</p> : null}
          <footer className="form-footer">
            <button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create application'}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
