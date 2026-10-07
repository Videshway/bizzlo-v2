import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardInsights, isOpenTask, sortTasks, studentName, summarizeCommissions, taskDue } from '../../src/lib/dashboardInsights.js';

const today = new Date(2026, 9, 7, 10, 30);

test('priority queue includes handoff and change requests, with blocked files before university waiting', () => {
  const applications = [
    { id: 'awaiting', status: 'awaiting_decision' },
    { id: 'ready', status: 'ready_for_admin_review' },
    { id: 'changes', status: 'admin_changes_requested' },
    { id: 'documents', status: 'documents_pending' },
    { id: 'enrolled', status: 'enrolled' },
  ];
  const result = buildDashboardInsights({ applications, now: today });
  assert.deepEqual(result.priorityApplications.map((application) => application.id), ['changes', 'documents', 'ready', 'awaiting']);
  assert.equal(result.adminReview.length, 1);
  assert.equal(applications[0].id, 'awaiting', 'building the queue must not reorder shared application state');
});

test('pipeline counts every application exactly once, including aliases, closed and unknown stages', () => {
  const statuses = ['profile_incomplete', 'documents_pending', 'admin_changes_requested', 'ready_for_admin_review', 'pending_admin_review', 'submitted_to_university', 'awaiting_decision', 'offer_received', 'conditional_offer', 'unconditional_offer', 'deposit_paid', 'cas_issued', 'visa_filed', 'visa_granted', 'enrolled', 'rejected', 'offer_rejected', 'cancelled', 'withdrawn', 'future_stage'];
  const { pipeline, offers } = buildDashboardInsights({ applications: statuses.map((status) => ({ status })), now: today });
  assert.equal(pipeline.reduce((sum, stage) => sum + stage.count, 0), statuses.length);
  assert.equal(pipeline.find((stage) => stage.id === 'review').count, 2);
  assert.equal(pipeline.find((stage) => stage.id === 'decision').count, 2);
  assert.equal(pipeline.find((stage) => stage.id === 'closed').count, 4);
  assert.equal(pipeline.find((stage) => stage.id === 'other').count, 1);
  assert.equal(offers.length, 3, 'rejected offers are not counted as active offers');
});

test('commission amounts stay in their recorded currencies and missing values remain explicit', () => {
  assert.deepEqual(summarizeCommissions([
    { currency: 'GBP', expected_amount: '1200.50' },
    { currency: ' gbp ', expected_amount: 100 },
    { currency: 'INR', expected_amount: 45000 },
    { currency: 'USD', expected_amount: 'invalid' },
    { currency: 'USD', expected_amount: null },
    { currency: '', expected_amount: 200 },
    { currency: 'EUR', expected_amount: 0 },
  ]), [
    { currency: 'EUR', amount: 0, count: 1, missingAmounts: 0 },
    { currency: 'GBP', amount: 1300.5, count: 2, missingAmounts: 0 },
    { currency: 'INR', amount: 45000, count: 1, missingAmounts: 0 },
    { currency: 'Unspecified', amount: 200, count: 1, missingAmounts: 0 },
    { currency: 'USD', amount: 0, count: 2, missingAmounts: 2 },
  ]);
});

test('date-only deadlines use the local calendar and reject malformed dates', () => {
  assert.deepEqual(taskDue({ due_date: '2026-10-07' }, today), { date: '2026-10-07', state: 'today', label: 'Due today' });
  assert.equal(taskDue({ due_date: '2026-10-07' }, new Date(2026, 9, 7, 0, 15)).state, 'today');
  assert.equal(taskDue({ due_date: '2026-10-07' }, new Date(2026, 9, 7, 23, 45)).state, 'today');
  assert.deepEqual(taskDue({ due: '2026-10-06' }, today), { date: '2026-10-06', state: 'overdue', label: '1 day overdue' });
  assert.equal(taskDue({ due: '2026-10-08' }, today).state, 'upcoming');
  assert.equal(taskDue({ due: '2026-02-30' }, today).state, 'unscheduled');
  assert.equal(taskDue({ due: 'not-a-date' }, today).label, 'No due date');
  assert.equal(taskDue({}, today).state, 'unscheduled');
});

test('open work sorts by deadline urgency without resurfacing completed or cancelled work', () => {
  const tasks = [
    { id: 'done', status: 'done', due: '2026-09-01', priority: 'High' },
    { id: 'future', status: 'open', due: '2026-10-09', priority: 'High' },
    { id: 'today-low', status: 'open', due: '2026-10-07', priority: 'Low' },
    { id: 'today-high', status: 'open', due: '2026-10-07', priority: 'High' },
    { id: 'cancelled', status: 'cancelled', due: '2026-09-01' },
    { id: 'overdue', status: 'in_progress', due_date: '2026-10-05', priority: 'Medium' },
    { id: 'no-date', status: 'open' },
  ];
  const insights = buildDashboardInsights({ tasks, now: today });
  assert.deepEqual(insights.openTasks.map((task) => task.id), ['overdue', 'today-high', 'today-low', 'future', 'no-date']);
  assert.equal(insights.overdueTasks.length, 1);
  assert.equal(insights.tasksDueToday.length, 2);
  assert.equal(sortTasks(tasks, today)[0].id, 'overdue');
  assert.equal(tasks[0].id, 'done', 'sorting must not mutate context state');
  assert.equal(isOpenTask({ status: 'cancelled' }), false);
});

test('empty workspaces and incomplete student records have honest fallbacks', () => {
  const result = buildDashboardInsights({ now: today });
  assert.equal(result.pipeline.reduce((sum, stage) => sum + stage.count, 0), 0);
  assert.deepEqual(result.priorityApplications, []);
  assert.deepEqual(summarizeCommissions([]), []);
  assert.equal(studentName({ first_name: 'Riya', last_name: 'Shah' }), 'Riya Shah');
  assert.equal(studentName({ student_code: 'ST-101' }), 'ST-101');
  assert.equal(studentName(undefined), 'Student file');
});
