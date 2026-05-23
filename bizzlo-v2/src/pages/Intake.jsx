import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardCheck, FileUp, Send } from 'lucide-react';
import {
  countryOptions,
  disciplineOptions,
  intakeOptions,
  nationalityOptions,
  normalizePhoneInput,
  studyLevelOptions,
  validatePhone,
} from '../data/formOptions';
import { useAppState } from '../lib/appState';
import { Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

const requiredDocs = ['Passport', 'Academic Transcript', 'Degree Certificate', 'IELTS', 'SOP', 'LOR', 'CV'];

const emptyStudent = {
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

export function Intake({ onNavigate }) {
  const {
    addApplication,
    addStudent,
    counselors,
    courses,
    currentUser,
    documents,
    updateApplicationStatus,
    visibleApplications,
    visibleStudents,
  } = useAppState();
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [created, setCreated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId) || courses[0], [courseId, courses]);
  const selectedCounselorId = studentForm.counselor_id || counselors[0]?.id || '';
  const adminQueue = visibleApplications.filter((application) => ['pending_admin_review', 'ready_for_admin_review', 'documents_pending'].includes(application.status));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!selectedCourse) {
      setFormError('Choose a university course before creating intake.');
      return;
    }
    if (!validatePhone(studentForm.nationality, studentForm.phone)) {
      setFormError(studentForm.nationality === 'India'
        ? 'Indian phone numbers must be exactly 10 digits.'
        : 'International phone numbers must be 8 to 15 digits and may start with +.');
      return;
    }
    setSubmitting(true);
    try {
      const nextStudent = await addStudent({
        ...studentForm,
        counselor_id: selectedCounselorId,
      });
      const nextApplication = await addApplication({
        student_id: nextStudent.id,
        course_id: selectedCourse.id,
        university: selectedCourse.university,
        country: selectedCourse.country,
        course: selectedCourse.course,
        intake: selectedCourse.intake,
      });
      setCreated({ student: nextStudent, application: nextApplication });
      setStudentForm(emptyStudent);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendToAdmin() {
    if (!created?.application?.id) return;
    await updateApplicationStatus(created.application.id, 'pending_admin_review');
    setCreated({
      ...created,
      application: { ...created.application, status: 'pending_admin_review' },
    });
  }

  if (currentUser.role === 'admin') {
    return (
      <div className="page-grid">
        <div className="page-heading">
          <div>
            <h1>Videshway Review Queue</h1>
            <p>Counselor-created student files, university selections, and uploaded documents land here for admin action.</p>
          </div>
        </div>

        <Panel title="Incoming Applications" description="This is where Videshway team reviews student info, checks documents, then submits to the university.">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>University</th>
                  <th>Course</th>
                  <th>Documents</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {adminQueue.map((application) => {
                  const student = visibleStudents.find((item) => item.id === application.student_id);
                  const docCount = documents.filter((document) => document.student_id === application.student_id).length;
                  return (
                    <tr key={application.id}>
                      <td><strong>{student?.first_name} {student?.last_name}</strong><small>{student?.email}</small></td>
                      <td>{application.university}</td>
                      <td>{application.course}</td>
                      <td>{docCount}/{requiredDocs.length}</td>
                      <td><StatusBadge value={application.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Student Intake</h1>
          <p>Counselor adds the student, chooses the university course, then uploads documents for Videshway admin review.</p>
        </div>
      </div>

      <div className="intake-flow">
        <div><ClipboardCheck size={18} /><span>Student info</span></div>
        <ArrowRight size={16} />
        <div><Send size={18} /><span>Select university</span></div>
        <ArrowRight size={16} />
        <div><FileUp size={18} /><span>Upload docs</span></div>
        <ArrowRight size={16} />
        <div><ClipboardCheck size={18} /><span>Admin review</span></div>
      </div>

      <div className="dashboard-columns">
        <Panel title="Create Student + Application" description="This is the main counselor flow before documents.">
          <form className="form-grid compact-form" onSubmit={handleSubmit}>
            <TextInput label="First name" required value={studentForm.first_name} onChange={(event) => setStudentForm({ ...studentForm, first_name: event.target.value })} />
            <TextInput label="Last name" required value={studentForm.last_name} onChange={(event) => setStudentForm({ ...studentForm, last_name: event.target.value })} />
            <TextInput label="Email" type="email" required value={studentForm.email} onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} />
            <TextInput label="Phone" type="tel" inputMode="tel" maxLength={16} required value={studentForm.phone} onChange={(event) => setStudentForm({ ...studentForm, phone: normalizePhoneInput(studentForm.nationality, event.target.value) })} />
            <SelectInput label="Nationality" required value={studentForm.nationality} onChange={(event) => setStudentForm({ ...studentForm, nationality: event.target.value, phone: normalizePhoneInput(event.target.value, studentForm.phone) })}>
              {nationalityOptions.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Desired country" required value={studentForm.desired_countries} onChange={(event) => setStudentForm({ ...studentForm, desired_countries: event.target.value })}>
              {countryOptions.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Study level" required value={studentForm.study_level} onChange={(event) => setStudentForm({ ...studentForm, study_level: event.target.value })}>
              {studyLevelOptions.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Intake" required value={studentForm.intake} onChange={(event) => setStudentForm({ ...studentForm, intake: event.target.value })}>
              {intakeOptions.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Subject interest" required value={studentForm.discipline} onChange={(event) => setStudentForm({ ...studentForm, discipline: event.target.value })}>
              {disciplineOptions.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            {currentUser.role === 'manager' ? (
              <SelectInput label="Counselor" required value={selectedCounselorId} onChange={(event) => setStudentForm({ ...studentForm, counselor_id: event.target.value })}>
                {counselors.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </SelectInput>
            ) : null}
            <SelectInput label="University course" required value={selectedCourse?.id || ''} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.university} - {course.course}</option>
              ))}
            </SelectInput>
            {formError ? <p className="form-error form-wide">{formError}</p> : null}
            <footer className="form-footer">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create intake'}
              </button>
            </footer>
          </form>
        </Panel>

        <Panel title="Selected Course" description="The created application appears in Videshway admin immediately.">
          {selectedCourse ? (
            <div className="selected-course">
              <strong>{selectedCourse.course}</strong>
              <span>{selectedCourse.university} · {selectedCourse.city}, {selectedCourse.country}</span>
              <dl>
                <div><dt>Intake</dt><dd>{selectedCourse.intake}</dd></div>
                <div><dt>Tuition</dt><dd>{selectedCourse.tuition}</dd></div>
                <div><dt>Deadline</dt><dd>{selectedCourse.deadline}</dd></div>
                <div><dt>Partner note</dt><dd>{selectedCourse.partner_note || 'Verify partner eligibility'}</dd></div>
              </dl>
            </div>
          ) : null}

          <div className="doc-route-box">
            <strong>Where documents are collected</strong>
            <span>Counselor uploads student documents in Documents. Videshway admin sees them in the same Document Review Queue.</span>
          </div>
        </Panel>
      </div>

      {created ? (
        <Panel title="Intake Created" description="Next step is document upload, then admin review.">
          <div className="created-flow">
            <div>
              <strong>{created.student.first_name} {created.student.last_name}</strong>
              <span>{created.application.university} · {created.application.course}</span>
              <StatusBadge value={created.application.status} />
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => onNavigate('documents')}>Upload documents</button>
              <button type="button" onClick={() => sendToAdmin().catch(() => {})}>Send to admin review</button>
              <button type="button" onClick={() => onNavigate('applications')}>View application</button>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
