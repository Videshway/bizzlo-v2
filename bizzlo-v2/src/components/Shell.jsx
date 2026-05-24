import {
  Bell,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { roles } from '../data/seed';
import { labelFor } from '../lib/status';
import { useAppState } from '../lib/appState';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'counselor'] },
  { id: 'students', label: 'Students', icon: Users, roles: ['admin', 'manager', 'counselor'] },
  { id: 'applications', label: 'Applications', icon: FileText, roles: ['admin', 'manager', 'counselor'] },
  { id: 'documents', label: 'Documents', icon: UploadCloud, roles: ['admin', 'manager', 'counselor'] },
  { id: 'courses', label: 'Program Search', icon: Search, roles: ['admin', 'manager', 'counselor'] },
  { id: 'team', label: 'Team & Partners', icon: UsersRound, roles: ['admin', 'manager'] },
  { id: 'commissions', label: 'Finance', icon: Landmark, roles: ['admin', 'manager'] },
  { id: 'support', label: 'Support', icon: LifeBuoy, roles: ['admin', 'manager', 'counselor'] },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, roles: ['admin'] },
];

const adminDecisionStatuses = new Set([
  'pending_admin_review',
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
]);

export function Shell({ activePage, onNavigate, children }) {
  const {
    appError,
    clearError,
    currentUser,
    dataLoading,
    isDemoMode,
    refreshData,
    setCurrentUser,
    signOut,
    users,
    visibleApplicationNotes,
    visibleApplications,
    visibleDocuments,
    visibleStudents,
  } = useAppState();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const items = nav.filter((item) => item.roles.includes(currentUser.role));
  const studentName = (studentId) => {
    const student = visibleStudents.find((item) => item.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : 'Student file';
  };
  const applicationName = (application) => `${studentName(application.student_id)} · ${application.university || 'Application'}`;
  const practicalAlerts = [
    ...(currentUser.role === 'admin'
      ? visibleApplications
        .filter((application) => ['ready_for_admin_review', 'pending_admin_review'].includes(application.status))
        .map((application) => ({
          id: `app-${application.id}`,
          icon: FileText,
          page: 'applications',
          title: applicationName(application),
          detail: application.status === 'ready_for_admin_review' ? 'Partner sent documents for admin decision' : labelFor(application.status),
        }))
      : visibleApplications
        .filter((application) => application.status === 'admin_changes_requested' || adminDecisionStatuses.has(application.status))
        .map((application) => ({
          id: `app-${application.id}`,
          icon: FileText,
          page: 'applications',
          title: applicationName(application),
          detail: application.status === 'admin_changes_requested' ? 'Admin requested changes' : `Admin update: ${labelFor(application.status)}`,
        }))),
    ...(currentUser.role === 'admin'
      ? visibleDocuments
        .filter((document) => document.status === 'uploaded')
        .map((document) => ({
          id: `doc-${document.id}`,
          icon: UploadCloud,
          page: 'documents',
          title: `${studentName(document.student_id)} · ${document.type}`,
          detail: 'Document waiting for admin approval',
        }))
      : visibleDocuments
        .filter((document) => document.status === 'rejected')
        .map((document) => ({
          id: `doc-${document.id}`,
          icon: UploadCloud,
          page: 'documents',
          title: `${studentName(document.student_id)} · ${document.type}`,
          detail: document.note || 'Admin rejected this document. Re-upload needed.',
        }))),
    ...(currentUser.role === 'admin'
      ? []
      : visibleApplicationNotes
        .filter((note) => {
          const actor = users.find((user) => user.id === note.author_id);
          return actor?.role === 'admin' || /admin|videshway/i.test(note.author_name || '');
        })
        .slice(0, 6)
        .map((note) => {
          const application = visibleApplications.find((item) => item.id === note.application_id);
          return {
            id: `note-${note.id}`,
            icon: FileText,
            page: 'applications',
            title: application ? applicationName(application) : 'Admin note',
            detail: note.body || 'Admin added an application update',
          };
        })),
  ].slice(0, 12);
  const alertCount = practicalAlerts.length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <GraduationCap size={24} />
          </div>
          <div>
            <strong>Bizzlo</strong>
            <span>Videshway admissions OS</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activePage === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Protected file flow</strong>
            <span>Private storage, role checks, audit trail ready.</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>{roles[currentUser.role].label}</p>
            <h1>{roles[currentUser.role].home}</h1>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={() => setAlertsOpen((open) => !open)}>
              <Bell size={17} />
              Alerts
              {alertCount ? <small className="button-count">{alertCount}</small> : null}
            </button>
            {alertsOpen ? (
              <div className="alerts-popover">
                <header>
                  <strong>Alerts</strong>
                  <span>{alertCount} open item(s)</span>
                </header>
                <div>
                  {practicalAlerts.map((alert) => {
                    const Icon = alert.icon;
                    return (
                      <button key={alert.id} type="button" onClick={() => { setAlertsOpen(false); onNavigate(alert.page); }}>
                        <Icon size={15} />
                        <span>{alert.title}<small>{alert.detail}</small></span>
                      </button>
                    );
                  })}
                  {!alertCount ? <p>No open alerts.</p> : null}
                </div>
              </div>
            ) : null}
            {!isDemoMode ? (
              <button className="ghost-button" type="button" onClick={refreshData} disabled={dataLoading}>
                <RefreshCw size={17} />
                Sync
              </button>
            ) : null}
            {isDemoMode ? (
              <label className="role-switcher">
                <BriefcaseBusiness size={16} />
                <select
                  value={currentUser.id}
                  onChange={(event) => {
                    const nextUser = users.find((user) => user.id === event.target.value);
                    if (nextUser) setCurrentUser(nextUser);
                  }}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({roles[user.role].label})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button className="ghost-button" type="button" onClick={signOut}>
                <LogOut size={17} />
                Sign out
              </button>
            )}
          </div>
        </header>

        <div className="content-frame">
          {dataLoading ? <div className="system-banner">Syncing secure workspace...</div> : null}
          {appError ? (
            <div className="system-banner error">
              <span>{appError}</span>
              <button type="button" onClick={clearError}>Dismiss</button>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
