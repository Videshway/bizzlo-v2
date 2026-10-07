import { useState } from 'react';
import { ClipboardCheck, ExternalLink, Link2, Plus, Search, UserRound } from 'lucide-react';
import {
  countryOptions,
  disciplineOptions,
  intakeOptions,
  normalizePhoneInput,
  nationalityOptions,
  studyLevelOptions,
  validatePhone,
} from '../data/formOptions';
import { useAppState } from '../lib/appState';
import { isAdminRole } from '../lib/roles';
import { EmptyState, Panel, StatusBadge, Modal, TextInput, SelectInput } from '../components/ui';

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  nationality: 'India',
  desired_countries: 'United Kingdom',
  study_level: 'Postgraduate',
  discipline: 'Business & Management',
  intake: 'September',
  counselor_id: '',
};

export function Students({ onNavigate, initialQuery = '', initialStudentId = '' }) {
  const { currentUser, visibleStudents, counselors, addStudent, createStudentInvite } = useAppState();
  const [query, setQuery] = useState(initialQuery);
  const [studentFilter, setStudentFilter] = useState(initialStudentId);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState(null);
  const [invitingId, setInvitingId] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const availableCounselors = isAdminRole(currentUser.role)
    ? counselors
    : counselors.filter((user) => (
      user.organization_id === currentUser.organization_id || user.manager_id === currentUser.id
    ));

  const filtered = visibleStudents.filter((student) => {
    if (studentFilter && student.id !== studentFilter) return false;
    const haystack = `${student.first_name} ${student.last_name} ${student.student_code || ''} ${student.email} ${student.phone || ''} ${student.discipline}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const selectedCounselorId = form.counselor_id || availableCounselors[0]?.id || '';

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError('Enter the student’s first and last name.');
      return;
    }
    if (!validatePhone(form.nationality, form.phone)) {
      setFormError(form.nationality === 'India'
        ? 'Indian phone numbers must be exactly 10 digits.'
        : 'International phone numbers must be 8 to 15 digits and may start with +.');
      return;
    }
    setSubmitting(true);
    try {
      await addStudent({ ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), counselor_id: selectedCounselorId });
      setOpen(false);
      setForm(emptyForm);
      setQuery('');
      setStudentFilter('');
    } catch (error) {
      setFormError(error?.message || 'Could not create this student. Your details are still here; please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function createInvite(student) {
    if (invitingId) return;
    setInvitingId(student.id);
    setInvite(null);
    setInviteError('');
    setCopyStatus('');
    try {
      const { link } = await createStudentInvite(student.id);
      setInvite({ student, link });
    } catch (error) {
      setInviteError(error?.message || 'Could not create this invite. Please try again.');
    } finally {
      setInvitingId('');
    }
  }

  async function copyInvite() {
    setCopyStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(invite.link);
      setCopyStatus('Copied to clipboard.');
    } catch {
      setCopyStatus('Copy is unavailable. Select and copy the invite link below.');
    }
  }

  function clearFilters() {
    setQuery('');
    setStudentFilter('');
    onNavigate?.('students');
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Students</h1>
          <p>Keep every student’s study plan, profile readiness, and next step in one place.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => {
          setOpen(true);
          setFormError('');
        }}>
          <Plus size={17} />
          New student
        </button>
      </div>

      <Panel>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input aria-label="Search students" placeholder="Search name, email, student code..." value={query} onChange={(event) => { setQuery(event.target.value); setStudentFilter(''); }} />
          </div>
          <span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'student' : 'students'}</span>
          {query || studentFilter ? <button type="button" className="secondary-button" onClick={clearFilters}>Show all students</button> : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Study Plan</th>
                <th>Readiness</th>
                <th>Status</th>
                <th>Counselor</th>
                <th>Invite</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="person-cell">
                      <div><UserRound size={17} /></div>
                      <span>
                        <strong>{student.first_name} {student.last_name}</strong>
                        <small>{student.student_code} · {student.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>{student.study_level} · {student.discipline}<small>{Array.isArray(student.desired_countries) ? student.desired_countries.join(', ') : student.desired_countries || 'Country not selected'}</small></td>
                  <td>
                    <progress className="progress-line" value={student.profile_score} max="100" aria-label="Profile completion" />
                    <small>{student.profile_score}% complete</small>
                  </td>
                  <td><StatusBadge value={student.status} /></td>
                  <td>{counselors.find((user) => user.id === student.counselor_id)?.name || 'Unassigned'}</td>
                  <td>
                    <button className="row-icon-button" type="button" disabled={Boolean(invitingId)} onClick={() => createInvite(student)} aria-label={`Create invite for ${student.first_name} ${student.last_name}`}>
                      <ExternalLink size={15} />
                      {invitingId === student.id ? 'Creating…' : 'Create invite'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td colSpan={6}><EmptyState icon={UserRound} title={query || studentFilter ? 'No matching students' : 'Your student workspace starts here'} text={query || studentFilter ? 'Try another name, email, or student code, or clear your search.' : 'Create your first student file to begin their study plan.'} /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Student Self-Service" description="Partners can invite students to complete profile data and upload files.">
        <div className="invite-strip">
          <ClipboardCheck size={19} />
          <div>
            <strong>{invite ? `Invite ready for ${invite.student.first_name} ${invite.student.last_name}` : 'Give students a clear next step'}</strong>
            <span>{invite ? 'Copy the secure link to share with this student, or open their document checklist.' : 'Create an invite for a student to complete their profile and upload documents.'}</span>
            {invite ? <input className="invite-link-input" aria-label="Student invite link" readOnly value={invite.link} onFocus={(event) => event.target.select()} /> : null}
            {copyStatus ? <span role="status">{copyStatus}</span> : null}
          </div>
          {invite ? (
            <div className="heading-actions">
            <button className="secondary-button" type="button" onClick={() => onNavigate?.('studentPortal', { path: `/student-link?invite=${encodeURIComponent(invite.student.student_code || invite.student.id)}` })}><ClipboardCheck size={15} />View checklist</button>
            <a className="secondary-button" href={invite.link} target="_blank" rel="noreferrer"><ExternalLink size={15} />Student page</a>
            <button className="secondary-button" type="button" onClick={copyInvite}>
              <Link2 size={15} />
              Copy link
            </button>
            </div>
          ) : null}
        </div>
        {inviteError ? <p className="form-error" role="alert">{inviteError}</p> : null}
      </Panel>

      <Modal open={open} onClose={() => { if (!submitting) setOpen(false); }} title="Create Student File" description="Start with the essentials. Students can complete the rest through their invite.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <TextInput label="First name" required value={form.first_name} onChange={(event) => updateForm('first_name', event.target.value)} />
          <TextInput label="Last name" required value={form.last_name} onChange={(event) => updateForm('last_name', event.target.value)} />
          <TextInput label="Email" type="email" required value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
          <TextInput label="Phone" type="tel" inputMode="tel" maxLength={16} required value={form.phone} onChange={(event) => {
            const nextValue = event.target.value;
            setForm((current) => ({ ...current, phone: normalizePhoneInput(current.nationality, nextValue) }));
          }} />
          <SelectInput label="Nationality" required value={form.nationality} onChange={(event) => {
            const nextNationality = event.target.value;
            setForm((current) => ({
              ...current,
              nationality: nextNationality,
              phone: normalizePhoneInput(nextNationality, current.phone),
            }));
          }}>
            {nationalityOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Desired country" required value={form.desired_countries} onChange={(event) => updateForm('desired_countries', event.target.value)}>
            {countryOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Study level" required value={form.study_level} onChange={(event) => updateForm('study_level', event.target.value)}>
            {studyLevelOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Discipline" required value={form.discipline} onChange={(event) => updateForm('discipline', event.target.value)}>
            {disciplineOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Intake" required value={form.intake} onChange={(event) => updateForm('intake', event.target.value)}>
            {intakeOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          {currentUser.role === 'counselor' ? null : (
            <SelectInput label="Counselor" required={availableCounselors.length > 0} value={selectedCounselorId} onChange={(event) => updateForm('counselor_id', event.target.value)}>
              {availableCounselors.length === 0 ? <option value="">Assign later</option> : null}
              {availableCounselors.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </SelectInput>
          )}
          {formError ? <p className="form-error form-wide" role="alert">{formError}</p> : null}
          <footer className="form-footer">
            <button className="secondary-button" type="button" disabled={submitting} onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create file'}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
