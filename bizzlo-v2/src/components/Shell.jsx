import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ClipboardPenLine,
  ClipboardList,
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
  { id: 'intake', label: 'Intake', icon: ClipboardPenLine, roles: ['admin', 'manager', 'counselor'] },
  { id: 'students', label: 'Students', icon: Users, roles: ['admin', 'manager', 'counselor'] },
  { id: 'applications', label: 'Applications', icon: FileText, roles: ['admin', 'manager', 'counselor'] },
  { id: 'documents', label: 'Documents', icon: UploadCloud, roles: ['admin', 'manager', 'counselor'] },
  { id: 'courses', label: 'Program Search', icon: Search, roles: ['admin', 'manager', 'counselor'] },
  { id: 'team', label: 'Team & Partners', icon: UsersRound, roles: ['admin', 'manager', 'counselor'] },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, roles: ['admin', 'manager', 'counselor'] },
  { id: 'commissions', label: 'Finance', icon: Landmark, roles: ['admin', 'manager'] },
  { id: 'resources', label: '360 Solutions', icon: BookOpen, roles: ['admin', 'manager', 'counselor'] },
  { id: 'support', label: 'Support', icon: LifeBuoy, roles: ['admin', 'manager', 'counselor'] },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, roles: ['admin'] },
];

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
    visibleApplications,
    visibleDocuments,
    visibleTasks,
  } = useAppState();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const items = nav.filter((item) => item.roles.includes(currentUser.role));
  const openTasks = visibleTasks.filter((task) => task.status === 'open').length;
  const reviewApplications = visibleApplications.filter((application) => ['pending_admin_review', 'documents_pending', 'admin_changes_requested'].includes(application.status));
  const reviewDocuments = visibleDocuments.filter((document) => ['uploaded', 'rejected'].includes(document.status));
  const alertCount = openTasks + reviewApplications.length + reviewDocuments.length;

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
                {item.id === 'tasks' && openTasks > 0 ? <small>{openTasks}</small> : null}
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
                  {reviewApplications.slice(0, 4).map((application) => (
                    <button key={application.id} type="button" onClick={() => { setAlertsOpen(false); onNavigate('applications'); }}>
                      <FileText size={15} />
                      <span>{application.university}<small>{labelFor(application.status)}</small></span>
                    </button>
                  ))}
                  {reviewDocuments.slice(0, 4).map((document) => (
                    <button key={document.id} type="button" onClick={() => { setAlertsOpen(false); onNavigate('documents'); }}>
                      <UploadCloud size={15} />
                      <span>{document.type}<small>{labelFor(document.status === 'rejected' ? 'rejected_document' : document.status)}</small></span>
                    </button>
                  ))}
                  {visibleTasks.filter((task) => task.status === 'open').slice(0, 4).map((task) => (
                    <button key={task.id} type="button" onClick={() => { setAlertsOpen(false); onNavigate('tasks'); }}>
                      <ClipboardList size={15} />
                      <span>{task.title}<small>Due {task.due}</small></span>
                    </button>
                  ))}
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
