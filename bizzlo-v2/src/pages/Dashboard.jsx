import { Building2, CheckCircle2, ClipboardList, FileText, Landmark, UploadCloud, Users } from 'lucide-react';
import { referenceActions } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { money } from '../lib/status';
import { Panel, StatCard, StatusBadge } from '../components/ui';

export function Dashboard({ onNavigate }) {
  const {
    currentUser,
    visibleApplications,
    visibleStudents,
    visibleDocuments,
    visibleTasks,
    visibleCommissions,
    visiblePartnerFinanceProfiles,
    accountRequests,
    managers,
    organizations,
    users,
  } = useAppState();

  const pendingApps = visibleApplications.filter((app) => ['documents_pending', 'pending_admin_review', 'awaiting_decision', 'submitted_to_university'].includes(app.status));
  const offers = visibleApplications.filter((app) => ['offer_received', 'conditional_offer', 'unconditional_offer'].includes(app.status));
  const documentIssues = visibleDocuments.filter((doc) => doc.status === 'rejected');
  const commissionTotal = visibleCommissions.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
  const payoutCurrency = visibleCommissions[0]?.currency || visiblePartnerFinanceProfiles[0]?.payout_currency || 'INR';
  const partnerOrgs = organizations.filter((organization) => organization.kind !== 'admin');

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Admissions command center</h1>
          <p>Every student file, document, application, task, and payout in one controlled workspace.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('intake')}>
          Start intake
        </button>
      </div>

      <div className="stats-grid">
        <StatCard icon={Users} label="Students" value={visibleStudents.length} hint="active files" tone="blue" />
        <StatCard icon={FileText} label="Applications" value={visibleApplications.length} hint={`${pendingApps.length} need movement`} tone="orange" />
        <StatCard icon={UploadCloud} label="Document issues" value={documentIssues.length} hint="needs correction" tone="red" />
        {currentUser.role !== 'counselor' ? (
          <StatCard icon={Landmark} label="Commission" value={money(commissionTotal, payoutCurrency)} hint="visible pipeline" tone="green" />
        ) : (
          <StatCard icon={ClipboardList} label="Open tasks" value={visibleTasks.filter((task) => task.status === 'open').length} hint="assigned work" tone="violet" />
        )}
      </div>

      <Panel title="Quick Actions" description="Daily partner and Videshway workflows grouped for student files, applications, finance, and support.">
        <div className="action-grid">
          {referenceActions
            .filter((action) => currentUser.role !== 'counselor' || action.id !== 'commissions')
            .map((action) => {
              const Icon = action.icon;
              return (
                <button className="action-tile" type="button" key={`${action.label}-${action.id}`} onClick={() => onNavigate(action.id)}>
                  <Icon size={20} />
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </button>
              );
            })}
        </div>
      </Panel>

      <div className="dashboard-columns">
        <Panel title="Priority Applications" description="Applications that need document, admin, or university movement now.">
          <div className="stack-list">
            {pendingApps.slice(0, 5).map((application) => (
              <button className="record-row" key={application.id} type="button" onClick={() => onNavigate('applications')}>
                <div>
                  <strong>{application.university}</strong>
                  <span>{application.course} - {application.intake}</span>
                </div>
                <StatusBadge value={application.status} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Work To Clear" description="Tasks generated from missing documents and admin movement.">
          <div className="task-rail">
            {visibleTasks.filter((task) => task.status === 'open').slice(0, 4).map((task) => (
              <button className="task-card" key={task.id} type="button" onClick={() => onNavigate('tasks')}>
                <div>
                  <ClipboardList size={18} />
                  <span className={`priority-pill ${String(task.priority || 'Medium').toLowerCase()}`}>{task.priority || 'Medium'}</span>
                </div>
                <strong>{task.title}</strong>
                <span>Owner: {task.owner} - Due {task.due}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {currentUser.role === 'admin' ? (
        <Panel title="Partner Portal Access Board" description="Allocated partner manager usernames and sign-in emails for admin handoff.">
          <div className="stack-list">
            {partnerOrgs.slice(0, 6).map((organization) => {
              const manager = managers.find((user) => user.organization_id === organization.id || user.id === organization.primary_manager_id);
              const managerRequest = accountRequests.find((request) => request.role === 'manager' && request.organization_id === organization.id);
              const counselors = users.filter((user) => user.role === 'counselor' && user.organization_id === organization.id);
              return (
                <button className="record-row" key={organization.id} type="button" onClick={() => onNavigate('team')}>
                  <div>
                    <strong><Building2 size={16} /> {organization.name}</strong>
                    <span>Username: {manager?.portal_username || managerRequest?.portal_username || 'Awaiting allocation'} - Email: {manager?.email || managerRequest?.email || 'Login not created'} - Counselors: {counselors.length}/{organization.counselor_limit || 1}</span>
                  </div>
                  <StatusBadge value={manager ? 'active' : managerRequest?.status || organization.status || 'pending_manager_activation'} />
                </button>
              );
            })}
            {partnerOrgs.length === 0 ? <p className="muted-copy">No partner portal accounts have been allocated yet.</p> : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="Offer And Enrollment Signals" description="Manager view of likely commission-generating movement.">
        <div className="signal-strip">
          <div>
            <CheckCircle2 size={19} />
            <strong>{offers.length}</strong>
            <span>offers received</span>
          </div>
          <div>
            <Landmark size={19} />
            <strong>{visibleCommissions.filter((item) => item.status === 'ready_to_invoice').length}</strong>
            <span>ready to invoice</span>
          </div>
          <div>
            <UploadCloud size={19} />
            <strong>{visibleDocuments.filter((item) => item.status === 'approved').length}</strong>
            <span>approved documents</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
