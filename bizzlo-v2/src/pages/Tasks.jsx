import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, Search } from 'lucide-react';
import { useAppState } from '../lib/appState';
import { isOpenTask, sortTasks, studentName, taskDue } from '../lib/dashboardInsights';
import { EmptyState, Modal, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

const emptyTask = {
  student_id: '',
  application_id: '',
  title: '',
  priority: 'Medium',
  due_date: '',
};

export function Tasks() {
  const { addTask, visibleApplications, visibleTasks, visibleStudents, closeTask } = useAppState();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTask);
  const [view, setView] = useState('open');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [closingIds, setClosingIds] = useState([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const now = new Date();
  const studentsById = new Map(visibleStudents.map((student) => [student.id, student]));
  const applicationsById = new Map(visibleApplications.map((application) => [application.id, application]));
  const selectedStudentApplications = visibleApplications.filter((application) => application.student_id === form.student_id);
  const openTasks = visibleTasks.filter(isOpenTask);
  const completedTasks = visibleTasks.filter((task) => task.status === 'done');
  const overdueCount = openTasks.filter((task) => taskDue(task, now).state === 'overdue').length;
  const normalizedQuery = query.trim().toLowerCase();
  const displayedTasks = sortTasks(visibleTasks.filter((task) => {
    if (view === 'open' && !isOpenTask(task)) return false;
    if (view === 'done' && task.status !== 'done') return false;
    const application = applicationsById.get(task.application_id);
    return !normalizedQuery || [task.title, task.owner, studentName(studentsById.get(task.student_id)), application?.university, application?.course].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
  }), now);

  function openNewTask() {
    setError('');
    setFeedback('');
    setForm(emptyTask);
    setOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      setError('Enter a task title so the next action is clear.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { due_date, ...task } = form;
      await addTask({ ...task, title: task.title.trim(), ...(due_date ? { due_date } : {}) });
      setForm(emptyTask);
      setOpen(false);
      setView('open');
      setQuery('');
      setFeedback('Task created.');
    } catch (failure) {
      setError(failure.message || 'Could not create this task. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(task) {
    if (closingIds.includes(task.id)) return;
    setClosingIds((ids) => [...ids, task.id]);
    setError('');
    setFeedback('');
    try {
      await closeTask(task.id);
      setFeedback(`Completed: ${task.title}`);
    } catch (failure) {
      setError(failure.message || 'Could not complete this task. Please try again.');
    } finally {
      setClosingIds((ids) => ids.filter((id) => id !== task.id));
    }
  }

  return (
    <div className="page-grid tasks-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow-text">Your next steps</p>
          <h1>Tasks & follow-ups</h1>
          <p>{openTasks.length} open {openTasks.length === 1 ? 'task' : 'tasks'}{overdueCount ? ` · ${overdueCount} overdue` : ''}. Keep student files moving, one action at a time.</p>
        </div>
        <button className="primary-button" type="button" onClick={openNewTask} disabled={!visibleStudents.length} title={!visibleStudents.length ? 'Add a student file before creating a task' : undefined}>
          <Plus size={17} aria-hidden="true" /> New task
        </button>
      </div>

      {feedback ? <p className="task-feedback success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{feedback}</p> : null}
      {error && !open ? <p className="task-feedback error" role="alert">{error}</p> : null}

      <Panel title="Your work queue" description="Overdue work appears first, followed by upcoming deadlines.">
        <div className="task-controls">
          <div className="task-view-tabs" role="group" aria-label="Task status">
            {[{ id: 'open', label: 'Open', count: openTasks.length }, { id: 'done', label: 'Completed', count: completedTasks.length }, { id: 'all', label: 'All tasks', count: visibleTasks.length }].map((item) => (
              <button className={view === item.id ? 'task-filter-button active' : 'task-filter-button'} type="button" key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label} <span>{item.count}</span></button>
            ))}
          </div>
          <label className="task-search"><Search size={17} aria-hidden="true" /><input aria-label="Search tasks, students or owners" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, students or owners" /></label>
        </div>
        {displayedTasks.length ? (
          <div className="task-list">
            {displayedTasks.map((task) => {
              const student = studentsById.get(task.student_id);
              const application = applicationsById.get(task.application_id);
              const due = taskDue(task, now);
              const completing = closingIds.includes(task.id);
              const active = isOpenTask(task);
              return (
                <article className={task.status === 'done' ? 'task-row done' : 'task-row'} key={task.id}>
                  <div className="task-symbol"><ClipboardCheck size={18} aria-hidden="true" /></div>
                  <div className="task-content">
                    <strong>{task.title}</strong>
                    <span>{studentName(student)} · {task.owner || 'Unassigned'}</span>
                    {application ? <small>{[application.university, application.course].filter(Boolean).join(' · ')}</small> : null}
                    <span className={`due-label ${active ? `due-${due.state}` : ''}`} title={due.date || undefined}>{active ? due.label : due.date ? `Due date: ${due.date}` : 'No due date'}</span>
                  </div>
                  <StatusBadge value={task.status} />
                  <span className={`priority-pill ${String(task.priority || 'Medium').toLowerCase()}`}>{task.priority || 'Medium'}</span>
                  {active ? <button className="secondary-button" type="button" disabled={completing} onClick={() => handleComplete(task)} aria-label={`Mark ${task.title} done`}>{completing ? 'Saving…' : 'Mark done'}</button> : <span className="task-complete-label">{task.status === 'done' ? <><CheckCircle2 size={16} aria-hidden="true" /> Completed</> : 'Closed'}</span>}
                </article>
              );
            })}
          </div>
        ) : <EmptyState icon={ClipboardCheck} title={normalizedQuery ? 'No matching tasks' : view === 'done' ? 'No completed tasks yet' : 'Your task list is clear'} text={normalizedQuery ? 'Try a student name, owner or another part of the task title.' : !visibleStudents.length ? 'Add a student file first, then create a follow-up for their next step.' : view === 'done' ? 'Tasks you mark done will appear here.' : 'Create a follow-up for a student, or check Completed for work already finished.'} />}
      </Panel>

      <Modal open={open} onClose={() => { if (!saving) setOpen(false); }} title="Create a task" description="Make the next step clear for a student file or application.">
        <form className="form-grid" onSubmit={handleSubmit}>
          {error ? <p className="task-feedback error full-width" role="alert">{error}</p> : null}
          <SelectInput label="Student" required value={form.student_id} disabled={saving} onChange={(event) => setForm({ ...form, student_id: event.target.value, application_id: '' })}>
            <option value="">Select student</option>
            {visibleStudents.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}
          </SelectInput>
          <SelectInput label="Application" value={form.application_id} disabled={saving || !form.student_id} onChange={(event) => setForm({ ...form, application_id: event.target.value })}>
            <option value="">General student task</option>
            {selectedStudentApplications.map((application) => <option key={application.id} value={application.id}>{application.university} - {application.course}</option>)}
          </SelectInput>
          <TextInput label="What needs to happen?" placeholder="For example, collect the updated transcript" required maxLength={500} value={form.title} disabled={saving} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <SelectInput label="Priority" value={form.priority} disabled={saving} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option>High</option><option>Medium</option><option>Low</option>
          </SelectInput>
          <TextInput label="Due date" type="date" required value={form.due_date} disabled={saving} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
          <footer className="form-footer">
            <button className="secondary-button" type="button" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create task'}</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
