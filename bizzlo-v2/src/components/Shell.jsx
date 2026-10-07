import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CommandSearch } from './CommandSearch';
import { roles } from '../data/seed';
import { labelFor } from '../lib/status';
import { useAppState } from '../lib/appState';
import { canManageFinance, canManagePartners, isAdminRole } from '../lib/roles';
import { isOpenTask } from '../lib/dashboardInsights';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'students', label: 'Students', icon: Users, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'applications', label: 'Applications', icon: FileText, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'documents', label: 'Documents', icon: UploadCloud, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'tasks', label: 'Tasks', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'courses', label: 'Program Search', icon: Search, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'team', label: 'Team & Partners', icon: UsersRound, roles: ['super_admin', 'admin', 'manager'] },
  { id: 'commissions', label: 'Finance', icon: Landmark, roles: ['super_admin', 'admin', 'manager'] },
  { id: 'support', label: 'Support', icon: LifeBuoy, roles: ['super_admin', 'admin', 'manager', 'counselor'] },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, roles: ['super_admin', 'admin'] },
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
    visibleTasks,
  } = useAppState();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const alertsRef = useRef(null);
  const alertTriggerRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuTriggerRef = useRef(null);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (document.querySelector('.modal[aria-modal="true"]:not(.command-modal)')) return;
        setAlertsOpen(false);
        setSidebarOpen(false);
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!alertsOpen) return;
    const handlePointerDown = (event) => {
      if (!alertsRef.current?.contains(event.target)) setAlertsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAlertsOpen(false);
        alertTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [alertsOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const sidebar = sidebarRef.current;
    const trigger = menuTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.querySelector('.sidebar-close')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key !== 'Tab') return;
      const buttons = Array.from(sidebar.querySelectorAll('button, a[href], select')).filter((element) => element.getClientRects().length > 0);
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const desktop = window.matchMedia('(min-width: 841px)');
    const handleResize = () => { if (desktop.matches) setSidebarOpen(false); };
    document.addEventListener('keydown', handleKeyDown);
    desktop.addEventListener('change', handleResize);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      desktop.removeEventListener('change', handleResize);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [sidebarOpen]);
  const items = nav.filter((item) => {
    if (!item.roles.includes(currentUser.role)) return false;
    if (item.id === 'team') return currentUser.role === 'manager' || canManagePartners(currentUser, users);
    if (item.id === 'commissions') return currentUser.role === 'manager' || canManageFinance(currentUser, users);
    if (item.id === 'audit') return isAdminRole(currentUser.role);
    return true;
  });
  const studentName = (studentId) => {
    const student = visibleStudents.find((item) => item.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : 'Student file';
  };
  const applicationName = (application) => `${studentName(application.student_id)} · ${application.university || 'Application'}`;
  const practicalAlerts = [
    ...(isAdminRole(currentUser.role)
      ? visibleApplications
        .filter((application) => ['ready_for_admin_review', 'pending_admin_review'].includes(application.status))
        .map((application) => ({
          id: `app-${application.id}`,
          icon: FileText,
          page: 'applications',
          options: { applicationId: application.id },
          title: applicationName(application),
          detail: application.status === 'ready_for_admin_review' ? 'Partner sent documents for admin decision' : labelFor(application.status),
        }))
      : visibleApplications
        .filter((application) => application.status === 'admin_changes_requested' || adminDecisionStatuses.has(application.status))
        .map((application) => ({
          id: `app-${application.id}`,
          icon: FileText,
          page: 'applications',
          options: { applicationId: application.id },
          title: applicationName(application),
          detail: application.status === 'admin_changes_requested' ? 'Admin requested changes' : `Admin update: ${labelFor(application.status)}`,
        }))),
    ...(isAdminRole(currentUser.role)
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
    ...(isAdminRole(currentUser.role)
      ? []
      : visibleApplicationNotes
        .filter((note) => {
          const actor = users.find((user) => user.id === note.author_id);
          return isAdminRole(actor?.role) || /admin|videshway/i.test(note.author_name || '');
        })
        .slice(0, 6)
        .map((note) => {
          const application = visibleApplications.find((item) => item.id === note.application_id);
          return {
            id: `note-${note.id}`,
            icon: FileText,
            page: 'applications',
            options: application ? { applicationId: application.id } : undefined,
            title: application ? applicationName(application) : 'Admin note',
            detail: note.body || 'Admin added an application update',
          };
        })),
  ].slice(0, 12);
  const alertCount = practicalAlerts.length;

  const activeLabel = nav.find((item) => item.id === activePage)?.label || (activePage === 'studentPortal' ? 'Student self-service' : 'Workspace');
  const openTaskCount = visibleTasks.filter(isOpenTask).length;
  const initials = String(currentUser.name || 'Bizzlo').split(' ').filter(Boolean).map((name) => name[0]).slice(0, 2).join('');

  function navigate(page, options) {
    setSidebarOpen(false);
    setAlertsOpen(false);
    onNavigate(page, options);
  }

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <a href="#workspace-content" className="shell-skip-link">Skip to workspace</a>
      {sidebarOpen ? <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" tabIndex={-1} /> : null}
      <aside className="sidebar" id="workspace-navigation" ref={sidebarRef} role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen ? 'true' : undefined} aria-label="Workspace navigation">
        <div className="brand-lockup">
          <div className="brand-mark"><GraduationCap size={24} aria-hidden="true" /></div>
          <div><strong>bizzlo<span className="brand-dot">.</span></strong><span>BY VIDESH WAY</span></div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <p className="nav-section-label">Workspace</p>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={activePage === item.id ? 'nav-item active' : 'nav-item'} aria-current={activePage === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
                <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
                {item.id === 'tasks' && openTaskCount ? <small className="nav-count" aria-label={`${openTaskCount} open tasks`}>{openTaskCount}</small> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className={`workspace-status${isDemoMode ? ' is-demo' : ''}`}><span aria-hidden="true" />{isDemoMode ? 'Demo workspace' : 'Secure workspace'}</div>
          <div className="sidebar-profile">
            <div className="profile-avatar" aria-hidden="true">{initials}</div>
            <div className="profile-details"><strong>{currentUser.name}</strong><span>{roles[currentUser.role]?.label || 'Bizzlo user'}</span></div>
            {!isDemoMode ? <button className="profile-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button> : null}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="icon-button mobile-nav-toggle" type="button" ref={menuTriggerRef} aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="workspace-navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <div className="workspace-breadcrumb"><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><strong>{activeLabel}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="topbar-search" type="button" onClick={() => { setAlertsOpen(false); setSearchOpen(true); }} aria-label="Search workspace (Control or Command K)"><Search size={17} aria-hidden="true" /><span>Search anything...</span><kbd>⌘ K</kbd></button>
            <div className="alerts-anchor" ref={alertsRef}>
              <button className="ghost-button alerts-trigger" ref={alertTriggerRef} type="button" aria-expanded={alertsOpen} aria-controls="workspace-alerts" aria-label={`Alerts, ${alertCount} open items`} onClick={() => setAlertsOpen((open) => !open)}>
                <Bell size={18} aria-hidden="true" />{alertCount ? <small className="button-count">{alertCount}</small> : null}
              </button>
              {alertsOpen ? (
                <div className="alerts-popover" id="workspace-alerts" role="region" aria-label="Workspace alerts">
                  <header><strong>Needs your attention</strong><span>{alertCount} open</span></header>
                  <div>
                    {practicalAlerts.map((alert) => {
                      const Icon = alert.icon;
                      return <button key={alert.id} type="button" onClick={() => navigate(alert.page, alert.options)}><Icon size={16} aria-hidden="true" /><span>{alert.title}<small>{alert.detail}</small></span></button>;
                    })}
                    {!alertCount ? <p>You're all caught up. No open alerts.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
            {!isDemoMode ? <button className="ghost-button sync-button" type="button" onClick={refreshData} disabled={dataLoading}><RefreshCw size={16} aria-hidden="true" /><span>{dataLoading ? 'Syncing…' : 'Sync'}</span></button> : null}
            {isDemoMode ? (
              <label className="role-switcher" title="Switch demo account">
                <BriefcaseBusiness size={16} aria-hidden="true" />
                <select aria-label="Demo account" value={currentUser.id} onChange={(event) => {
                  const nextUser = users.find((user) => user.id === event.target.value);
                  if (nextUser) { setAlertsOpen(false); setSearchOpen(false); setCurrentUser(nextUser); navigate('dashboard'); }
                }}>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({roles[user.role]?.label || user.role})</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </header>
        <div className="content-frame" id="workspace-content" tabIndex={-1}>
          {dataLoading ? <div className="system-banner" role="status">Syncing secure workspace...</div> : null}
          {appError ? <div className="system-banner error" role="alert"><span>{appError}</span><button type="button" onClick={clearError}>Dismiss</button></div> : null}
          {children}
        </div>
      </main>
      {searchOpen ? <CommandSearch items={items} students={visibleStudents} applications={visibleApplications} onNavigate={navigate} onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}
