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
import { Panel, StatusBadge, Modal, TextInput, SelectInput } from '../components/ui';

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

export function Students({ onNavigate }) {
  const { currentUser, visibleStudents, counselors, addStudent, createStudentInvite } = useAppState();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const availableCounselors = isAdminRole(currentUser.role)
    ? counselors
    : counselors.filter((user) => (
      user.organization_id === currentUser.organization_id || user.manager_id === currentUser.id
    ));

  const filtered = visibleStudents.filter((student) => {
    const haystack = `${student.first_name} ${student.last_name} ${student.email} ${student.discipline}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selectedCounselorId = form.counselor_id || availableCounselors[0]?.id || '';

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!validatePhone(form.nationality, form.phone)) {
      setFormError(form.nationality === 'India'
        ? 'Indian phone numbers must be exactly 10 digits.'
        : 'International phone numbers must be 8 to 15 digits and may start with +.');
      return;
    }
    setSubmitting(true);
    try {
      await addStudent({ ...form, counselor_id: selectedCounselorId });
      setOpen(false);
      setForm(emptyForm);
    } finally {
      setSubmitting(false);
    }
  }

  async function createInvite(student) {
    const { link } = await createStudentInvite(student.id);
    setInvite({ student, link });
    navigator.clipboard?.writeText(link).catch(() => {});
    onNavigate?.('studentPortal', { path: `/student-link?invite=${encodeURIComponent(student.student_code || student.id)}` });
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Students</h1>
          <p>Manager and counselor controlled student files with profile readiness and application context.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => {
          setOpen(true);
        }}>
          <Plus size={17} />
          New student
        </button>
      </div>

      <Panel>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input placeholder="Search student, email, subject..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <span>{filtered.length} files</span>
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
                  <td>{student.study_level} · {student.discipline}<small>{student.desired_countries.join(', ')}</small></td>
                  <td>
                    <progress className="progress-line" value={student.profile_score} max="100" aria-label="Profile completion" />
                    <small>{student.profile_score}% complete</small>
                  </td>
                  <td><StatusBadge value={student.status} /></td>
                  <td>{counselors.find((user) => user.id === student.counselor_id)?.name || 'Unassigned'}</td>
                  <td>
                    <button className="row-icon-button" type="button" onClick={() => createInvite(student).catch(() => {})}>
                      <ExternalLink size={15} />
                      Open link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Student Self-Service" description="Partners can invite students to complete profile data and upload files.">
        <div className="invite-strip">
          <ClipboardCheck size={19} />
          <div>
            <strong>{invite ? `Invite opened for ${invite.student.first_name} ${invite.student.last_name}` : 'Student invite opens a working checklist'}</strong>
            <span>{invite?.link || 'Pick Open link on any student to view the student upload page and copy the secure invite pattern.'}</span>
          </div>
          {invite ? (
            <button className="secondary-button" type="button" onClick={() => navigator.clipboard?.writeText(invite.link).catch(() => {})}>
              <Link2 size={15} />
              Copy
            </button>
          ) : null}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Student File" description="Create a complete student profile before applications and documents.">
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
          {formError ? <p className="form-error form-wide">{formError}</p> : null}
          <footer className="form-footer">
            <button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create file'}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
