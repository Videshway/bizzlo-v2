const reviewStatuses = new Set(['ready_for_admin_review', 'pending_admin_review']);
const offerStatuses = new Set(['offer_received', 'conditional_offer', 'unconditional_offer']);
const applicationPriority = {
  admin_changes_requested: 0,
  documents_pending: 1,
  ready_for_admin_review: 2,
  pending_admin_review: 3,
  profile_incomplete: 4,
  conditional_offer: 5,
  unconditional_offer: 5,
  offer_received: 5,
  awaiting_decision: 6,
  submitted_to_university: 7,
};

const pipelineDefinitions = [
  { id: 'preparing', label: 'Preparing', tone: 'amber', statuses: ['profile_incomplete', 'documents_pending', 'admin_changes_requested'] },
  { id: 'review', label: 'Admin review', tone: 'violet', statuses: [...reviewStatuses] },
  { id: 'decision', label: 'University decision', tone: 'blue', statuses: ['submitted_to_university', 'awaiting_decision'] },
  { id: 'offers', label: 'Offer received', tone: 'teal', statuses: [...offerStatuses] },
  { id: 'arrival', label: 'Deposit & visa', tone: 'indigo', statuses: ['deposit_paid', 'cas_issued', 'visa_filed', 'visa_granted'] },
  { id: 'enrolled', label: 'Enrolled', tone: 'green', statuses: ['enrolled'] },
  { id: 'closed', label: 'Closed', tone: 'slate', statuses: ['rejected', 'offer_rejected', 'cancelled', 'withdrawn'] },
];

export function studentName(student) {
  return [student?.first_name, student?.last_name].filter(Boolean).join(' ').trim() || student?.student_code || 'Student file';
}

export function isOpenTask(task) {
  return task.status === 'open' || task.status === 'in_progress';
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDateKey(value) {
  const key = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
}

export function taskDue(task, now = new Date()) {
  const date = validDateKey(task.due_date || task.due);
  if (!date) return { date: null, state: 'unscheduled', label: 'No due date' };
  const today = localDateKey(now);
  if (date < today) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
    return { date, state: 'overdue', label: `${days} ${days === 1 ? 'day' : 'days'} overdue` };
  }
  if (date === today) return { date, state: 'today', label: 'Due today' };
  return {
    date,
    state: 'upcoming',
    label: `Due ${new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) })}`,
  };
}

export function sortTasks(tasks, now = new Date()) {
  const urgency = { overdue: 0, today: 1, upcoming: 2, unscheduled: 3 };
  const priority = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    const aDue = taskDue(a, now);
    const bDue = taskDue(b, now);
    return Number(!isOpenTask(a)) - Number(!isOpenTask(b))
      || urgency[aDue.state] - urgency[bDue.state]
      || String(aDue.date || '').localeCompare(String(bDue.date || ''))
      || (priority[String(a.priority).toLowerCase()] ?? 1) - (priority[String(b.priority).toLowerCase()] ?? 1)
      || String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function summarizeCommissions(commissions) {
  const currencies = new Map();
  for (const commission of commissions) {
    const currency = String(commission.currency || '').trim().toUpperCase() || 'Unspecified';
    const group = currencies.get(currency) || { currency, amount: 0, count: 0, missingAmounts: 0 };
    const amount = Number(commission.expected_amount);
    group.count += 1;
    if (commission.expected_amount === null || commission.expected_amount === undefined || String(commission.expected_amount).trim() === '' || !Number.isFinite(amount)) {
      group.missingAmounts += 1;
    } else {
      group.amount += amount;
    }
    currencies.set(currency, group);
  }
  return [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildDashboardInsights({ applications = [], tasks = [], documents = [], now = new Date() }) {
  const openTasks = sortTasks(tasks.filter(isOpenTask), now);
  const pipeline = pipelineDefinitions.map((stage) => ({
    ...stage,
    count: applications.filter((application) => stage.statuses.includes(application.status)).length,
  }));
  const knownStatuses = new Set(pipelineDefinitions.flatMap((stage) => stage.statuses));
  const otherCount = applications.filter((application) => !knownStatuses.has(application.status)).length;
  if (otherCount) pipeline.push({ id: 'other', label: 'Other stages', tone: 'slate', count: otherCount });

  return {
    openTasks,
    overdueTasks: openTasks.filter((task) => taskDue(task, now).state === 'overdue'),
    tasksDueToday: openTasks.filter((task) => taskDue(task, now).state === 'today'),
    offers: applications.filter((application) => offerStatuses.has(application.status)),
    adminReview: applications.filter((application) => reviewStatuses.has(application.status)),
    documentIssues: documents.filter((document) => ['rejected', 'rejected_document'].includes(document.status)),
    priorityApplications: applications.filter((application) => Object.hasOwn(applicationPriority, application.status)).sort((a, b) => (
      applicationPriority[a.status] - applicationPriority[b.status]
      || String(a.updated_at || a.created_at || '').localeCompare(String(b.updated_at || b.created_at || ''))
    )),
    pipeline,
  };
}

export function nextApplicationAction(status) {
  return {
    admin_changes_requested: 'Resolve requested changes',
    documents_pending: 'Complete required documents',
    ready_for_admin_review: 'Ready for the admin team',
    pending_admin_review: 'Admin review in progress',
    profile_incomplete: 'Complete the student profile',
    conditional_offer: 'Review offer conditions',
    unconditional_offer: 'Plan the next step',
    offer_received: 'Review the university offer',
    awaiting_decision: 'Follow up on the decision',
    submitted_to_university: 'Track the university response',
  }[status] || 'Open the application board';
}
