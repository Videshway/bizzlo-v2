import { ArrowRight, Building2, CheckCircle2, ClipboardList, FileText, GraduationCap, Landmark, Plus, UploadCloud, Users } from 'lucide-react';
import { referenceActions } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { buildDashboardInsights, nextApplicationAction, studentName, summarizeCommissions, taskDue } from '../lib/dashboardInsights';
import { canManageFinance, canManagePartners } from '../lib/roles';
import { EmptyState, Panel, StatCard, StatusBadge } from '../components/ui';

function commissionAmount(group) {
  if (group.missingAmounts === group.count) return 'Amount not recorded';
  if (group.currency === 'Unspecified') return group.amount.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: group.currency, maximumFractionDigits: 2 }).format(group.amount);
  } catch {
    return group.amount.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
}

export function Dashboard({ onNavigate }) {
  const {
    currentUser,
    visibleApplications,
    visibleStudents,
    visibleDocuments,
    visibleTasks,
    visibleCommissions,
    accountRequests,
    managers,
    organizations,
    users,
  } = useAppState();
  const now = new Date();
  const insights = buildDashboardInsights({ applications: visibleApplications, tasks: visibleTasks, documents: visibleDocuments, now });
  const studentsById = new Map(visibleStudents.map((student) => [student.id, student]));
  const financeVisible = currentUser.role === 'manager' || canManageFinance(currentUser, users);
  const partnerOwner = canManagePartners(currentUser, users);
  const partnerOrgs = organizations.filter((organization) => organization.kind !== 'admin');
  const commissionGroups = financeVisible ? summarizeCommissions(visibleCommissions) : [];
  const urgentTaskCount = insights.overdueTasks.length + insights.tasksDueToday.length;
  const firstName = currentUser.name?.trim().split(/\s+/)[0];

  return (
    <div className="page-grid dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow-text">{firstName ? `Welcome back, ${firstName}` : 'Welcome to your workspace'}</p>
          <h1>Your admissions overview</h1>
          <p>See what needs attention. Keep every student moving forward.</p>
        </div>
        <div className="dashboard-hero-actions">
          <span className="dashboard-date">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button className="primary-button" type="button" onClick={() => onNavigate('students')}>
            <Plus size={17} aria-hidden="true" /> Open students
          </button>
        </div>
      </section>

      <div className="stats-grid metric-grid">
        <StatCard icon={Users} label="Student files" value={visibleStudents.length} hint="Across your workspace" tone="blue" />
        <StatCard icon={FileText} label="Applications" value={visibleApplications.length} hint={`${insights.adminReview.length} at admin review`} tone="violet" />
        <StatCard icon={GraduationCap} label="Offers received" value={insights.offers.length} hint="Currently at offer stage" tone="green" />
        <StatCard icon={ClipboardList} label="Open tasks" value={insights.openTasks.length} hint={insights.overdueTasks.length ? `${insights.overdueTasks.length} overdue · ${insights.tasksDueToday.length} due today` : `${insights.tasksDueToday.length} due today`} tone={insights.overdueTasks.length ? 'orange' : 'blue'} />
      </div>

      <div className="dashboard-main-grid">
        <Panel className="dashboard-priority-panel" title="Applications to move forward" description="Changes and missing documents first, then reviews and decisions." action={<button className="text-button" type="button" onClick={() => onNavigate('applications')}>View all <ArrowRight size={15} aria-hidden="true" /></button>}>
          {insights.priorityApplications.length ? (
            <div className="dashboard-application-list">
              {insights.priorityApplications.slice(0, 5).map((application) => {
                const student = studentsById.get(application.student_id);
                const name = studentName(student);
                return (
                  <button className="dashboard-application-row" key={application.id} type="button" onClick={() => onNavigate('applications', { applicationId: application.id })}>
                    <span className="student-avatar" aria-hidden="true">{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>
                    <span className="dashboard-record-main">
                      <strong>{name}</strong>
                      <span>{application.university || 'University not set'}</span>
                      <small>{[application.course, application.intake].filter(Boolean).join(' · ') || 'Course details pending'}</small>
                    </span>
                    <span className="dashboard-record-action">
                      <StatusBadge value={application.status} />
                      <small>{nextApplicationAction(application.status)}</small>
                    </span>
                    <ArrowRight className="row-arrow" size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title={visibleApplications.length ? 'Nothing waiting in this queue' : 'Start with a student file'} text={visibleApplications.length ? 'Applications needing documents, reviews, offers or decisions will appear here.' : 'Add a student, explore programs and create their first application.'} />
          )}
        </Panel>

        <Panel className="dashboard-work-panel" title="Your work queue" description={urgentTaskCount ? `${urgentTaskCount} ${urgentTaskCount === 1 ? 'task needs' : 'tasks need'} attention today.` : 'Your next actions, ordered by due date.'} action={<button className="text-button" type="button" onClick={() => onNavigate('tasks')}>All tasks <ArrowRight size={15} aria-hidden="true" /></button>}>
          {insights.openTasks.length ? (
            <div className="dashboard-task-list">
              {insights.openTasks.slice(0, 4).map((task) => {
                const due = taskDue(task, now);
                return (
                  <button className="dashboard-task-row" key={task.id} type="button" onClick={() => onNavigate('tasks')}>
                    <span className="task-check-icon"><ClipboardList size={17} aria-hidden="true" /></span>
                    <span className="dashboard-task-main">
                      <strong>{task.title}</strong>
                      <span>{studentName(studentsById.get(task.student_id))} · {task.owner || 'Unassigned'}</span>
                      <span className="dashboard-task-meta"><span className={`due-label due-${due.state}`}>{due.label}</span><span className={`priority-pill ${String(task.priority || 'Medium').toLowerCase()}`}>{task.priority || 'Medium'}</span></span>
                    </span>
                    <ArrowRight size={15} className="row-arrow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : <EmptyState icon={CheckCircle2} title="Your task list is clear" text="New follow-ups and application tasks will appear here." />}
          {insights.documentIssues.length ? <button className="document-attention" type="button" onClick={() => onNavigate('documents')}><UploadCloud size={18} aria-hidden="true" /><span><strong>{insights.documentIssues.length} {insights.documentIssues.length === 1 ? 'document needs' : 'documents need'} correction</strong><small>Review feedback and upload a replacement.</small></span><ArrowRight size={16} aria-hidden="true" /></button> : null}
        </Panel>
      </div>

      <Panel className="dashboard-pipeline-panel" title="Application pipeline" description="A snapshot of each application's current stage." action={<span className="panel-count">{visibleApplications.length} total</span>}>
        <div className="pipeline-grid">
          {insights.pipeline.map((stage, index) => (
            <div className={`pipeline-stage pipeline-${stage.tone}`} key={stage.id}>
              <div className="pipeline-stage-header"><span className="pipeline-dot" /><span>{stage.label}</span>{index < insights.pipeline.length - 1 ? <ArrowRight size={13} aria-hidden="true" /> : null}</div>
              <strong>{stage.count}</strong>
              <progress max={Math.max(visibleApplications.length, 1)} value={stage.count} aria-label={`${stage.label}: ${stage.count} of ${visibleApplications.length} applications`} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="dashboard-bottom-grid">
        <Panel className="dashboard-shortcuts-panel" title="Keep things moving" description="The tools you use throughout the day.">
          <div className="dashboard-shortcuts">
            {referenceActions.filter((action) => action.id !== 'resources').filter((action) => action.id !== 'commissions' || financeVisible).map((action) => {
              const Icon = action.icon;
              return <button className="dashboard-shortcut" type="button" key={action.id} onClick={() => onNavigate(action.id)}><span className="shortcut-icon"><Icon size={19} aria-hidden="true" /></span><span><strong>{action.label}</strong><small>{action.id === 'courses' ? 'Explore partner programs' : action.id === 'students' ? 'Manage files and upload links' : action.id === 'applications' ? 'Follow each application' : 'Review commissions and payouts'}</small></span><ArrowRight size={15} aria-hidden="true" /></button>;
            })}
          </div>
        </Panel>

        {financeVisible ? <Panel className="dashboard-finance-panel" title="Expected commissions" description="Recorded amounts, grouped by currency." action={<button className="text-button" type="button" onClick={() => onNavigate('commissions')}>Finance <ArrowRight size={15} aria-hidden="true" /></button>}>
          {commissionGroups.length ? <div className="dashboard-currency-list">{commissionGroups.map((group) => <div className="dashboard-currency-row" key={group.currency}><span><strong>{group.currency === 'Unspecified' ? 'Currency not set' : group.currency}</strong><small>{group.count} {group.count === 1 ? 'record' : 'records'}{group.missingAmounts ? ` · ${group.missingAmounts} missing ${group.missingAmounts === 1 ? 'amount' : 'amounts'}` : ''}</small></span><strong>{commissionAmount(group)}</strong></div>)}<p className="dashboard-finance-note">{visibleCommissions.filter((item) => item.status === 'ready_to_invoice').length} ready to invoice · Expected amounts are not confirmed payouts.</p></div> : <EmptyState icon={Landmark} title="No commission records yet" text="Recorded commissions will appear here as applications progress." />}
        </Panel> : <Panel className="dashboard-documents-panel" title="Document progress" description="Keep student files ready for the next review."><div className="document-summary"><span><strong>{visibleDocuments.filter((document) => document.status === 'approved').length}</strong> approved</span><span><strong>{visibleDocuments.filter((document) => ['uploaded', 'scanning'].includes(document.status)).length}</strong> awaiting review</span><span><strong>{insights.documentIssues.length}</strong> need correction</span></div><button className="secondary-button" type="button" onClick={() => onNavigate('documents')}>Open document vault <ArrowRight size={15} aria-hidden="true" /></button></Panel>}
      </div>

      {partnerOwner ? <Panel className="dashboard-partners-panel" title="Partner workspace access" description="Manager accounts and counselor seats at a glance." action={<button className="text-button" type="button" onClick={() => onNavigate('team')}>Manage partners <ArrowRight size={15} aria-hidden="true" /></button>}>
        <div className="stack-list">
          {partnerOrgs.slice(0, 4).map((organization) => {
            const manager = managers.find((user) => user.organization_id === organization.id || user.id === organization.primary_manager_id);
            const request = accountRequests.find((item) => item.role === 'manager' && item.organization_id === organization.id);
            const counselorCount = users.filter((user) => user.role === 'counselor' && user.organization_id === organization.id).length;
            return <button className="record-row dashboard-partner-row" key={organization.id} type="button" onClick={() => onNavigate('team')}><span className="partner-icon"><Building2 size={18} aria-hidden="true" /></span><span className="dashboard-record-main"><strong>{organization.name}</strong><span>{manager?.name || request?.name || 'Manager setup pending'} · {counselorCount}/{organization.counselor_limit || 1} counselor seats</span></span><StatusBadge value={manager ? 'active' : request?.status || organization.status || 'pending_manager_activation'} /><ArrowRight size={15} aria-hidden="true" /></button>;
          })}
          {!partnerOrgs.length ? <EmptyState icon={Building2} title="Your partner network starts here" text="Create a partner workspace from Team & Partners to invite its manager." /> : null}
        </div>
      </Panel> : null}
    </div>
  );
}
