import { useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useAppState } from '../lib/appState';
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

  const selectedStudentApplications = visibleApplications.filter((application) => application.student_id === form.student_id);

  async function handleSubmit(event) {
    event.preventDefault();
    await addTask(form);
    setForm(emptyTask);
    setOpen(false);
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Tasks</h1>
          <p>Task center for missing requirements, admin review, deposits, and finance actions.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          <Plus size={17} />
          New task
        </button>
      </div>

      <Panel title="Open Work">
        {visibleTasks.length ? (
          <div className="task-list">
            {visibleTasks.map((task) => {
              const student = visibleStudents.find((item) => item.id === task.student_id);
              return (
                <article className={task.status === 'done' ? 'task-row done' : 'task-row'} key={task.id}>
                  <div className="task-symbol"><ClipboardCheck size={18} /></div>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{student?.first_name} {student?.last_name} · {task.owner} · Due {task.due}</span>
                  </div>
                  <StatusBadge value={task.status} />
                  <span className="priority-pill">{task.priority}</span>
                  <button className="secondary-button" type="button" disabled={task.status === 'done'} onClick={() => closeTask(task.id).catch(() => {})}>
                    Mark done
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No open tasks" text="Tasks appear automatically from application movement or can be created manually." />
        )}
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="New Task" description="Create a persisted task for a student or application.">
        <form className="form-grid" onSubmit={(event) => handleSubmit(event).catch(() => {})}>
          <SelectInput label="Student" required value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value, application_id: '' })}>
            <option value="">Select student</option>
            {visibleStudents.map((student) => (
              <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>
            ))}
          </SelectInput>
          <SelectInput label="Application" value={form.application_id} onChange={(event) => setForm({ ...form, application_id: event.target.value })}>
            <option value="">General student task</option>
            {selectedStudentApplications.map((application) => (
              <option key={application.id} value={application.id}>{application.university} - {application.course}</option>
            ))}
          </SelectInput>
          <TextInput label="Task title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <SelectInput label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </SelectInput>
          <TextInput label="Due date" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
          <footer className="form-footer">
            <button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit">Create task</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
