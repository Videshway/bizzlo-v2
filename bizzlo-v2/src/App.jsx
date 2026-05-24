import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { CookieConsent } from './components/CookieConsent';
import { Shell } from './components/Shell';
import { AppStateProvider, useAppState } from './lib/appState';
import { Audit } from './pages/Audit';
import { Applications } from './pages/Applications';
import { Commissions } from './pages/Commissions';
import { CourseFinder } from './pages/CourseFinder';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { PrivacyPolicy, TermsOfService } from './pages/Legal';
import { Support } from './pages/StaticInfo';
import { StudentPortal } from './pages/StudentPortal';
import { StudentSelfServiceApp } from './pages/StudentSelfService';
import { Students } from './pages/Students';
import { Team } from './pages/Team';

function NotFound({ onNavigate }) {
  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Page not found</h1>
          <p>This Bizzlo route does not exist or you do not have access to it.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate('dashboard')}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

const pages = {
  dashboard: Dashboard,
  students: Students,
  applications: Applications,
  documents: Documents,
  courses: CourseFinder,
  team: Team,
  commissions: Commissions,
  support: Support,
  audit: Audit,
  studentPortal: StudentPortal,
  notFound: NotFound,
  privacy: PrivacyPolicy,
  terms: TermsOfService,
};

const pagePaths = {
  dashboard: '/',
  students: '/students',
  applications: '/applications',
  documents: '/documents',
  courses: '/program-search',
  team: '/team',
  commissions: '/finance',
  support: '/support',
  audit: '/audit',
  studentPortal: '/student-link',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
};

const pathPages = Object.fromEntries(Object.entries(pagePaths).map(([page, path]) => [path, page]));

function routeFromLocation() {
  const { pathname, search } = window.location;
  const inviteMatch = pathname.match(/^\/invite\/([^/]+)\/?$/);
  if (inviteMatch) {
    const params = new URLSearchParams(search);
    params.set('invite', decodeURIComponent(inviteMatch[1]));
    window.history.replaceState({}, '', `/student-link?${params.toString()}`);
    return 'studentPortal';
  }
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (['/login', '/auth/login', '/dashboard'].includes(normalized)) {
    window.history.replaceState({}, '', '/');
    return 'dashboard';
  }
  return pathPages[normalized] || 'notFound';
}

function BizzloApp() {
  const {
    setActiveInviteStudentId,
    setActiveInviteUrl,
    activeInviteUrl,
    visibleStudents,
  } = useAppState();
  const [activePage, setActivePage] = useState(routeFromLocation);
  const Page = pages[activePage] || Dashboard;

  const navigate = useCallback((page, options = {}) => {
    const path = options.path || pagePaths[page] || '/';
    if (window.location.pathname + window.location.search !== path) {
      window.history.pushState({ page }, '', path);
    }
    setActivePage(page);
  }, []);

  useEffect(() => {
    const handlePopState = () => setActivePage(routeFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const inviteFromQuery = new URLSearchParams(window.location.search).get('invite');
    const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);
    const inviteCode = inviteFromQuery || (match ? match[1] : '');
    if (!inviteCode) return;

    const code = decodeURIComponent(inviteCode).toLowerCase();
    const student = visibleStudents.find((item) => (
      String(item.student_code || '').toLowerCase() === code
      || String(item.id).toLowerCase() === code
    ));

    if (student) {
      setActiveInviteStudentId(student.id);
      const token = new URLSearchParams(window.location.search).get('token');
      if (!activeInviteUrl || !activeInviteUrl.includes('/portal/')) {
        setActiveInviteUrl(`${window.location.origin}/portal/${encodeURIComponent(String(student.student_code || student.id).toLowerCase())}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      }
    }
  }, [activeInviteUrl, setActiveInviteStudentId, setActiveInviteUrl, visibleStudents]);

  return (
    <Shell activePage={activePage} onNavigate={navigate}>
      <Page onNavigate={navigate} />
    </Shell>
  );
}

function AppRuntime() {
  const { isDemoMode, isProductionMisconfigured, authLoading, currentUser } = useAppState();
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);

  if (!isDemoMode && !currentUser && inviteMatch) {
    const target = `/portal/${inviteMatch[1]}${window.location.search}`;
    window.history.replaceState({}, '', target);
    return <StudentSelfServiceApp />;
  }

  if (isProductionMisconfigured) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-heading">
            <h1>Secure setup required</h1>
            <p>Supabase environment variables must be configured before this production portal can open.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!isDemoMode && authLoading && !currentUser) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="loading-state">Preparing secure workspace...</div>
        </section>
      </main>
    );
  }

  if (!isDemoMode && !currentUser) {
    return <AuthScreen />;
  }

  return <BizzloApp />;
}

export default function App() {
  if (/^\/portal\/[^/]+\/?$/.test(window.location.pathname)) {
    return <StudentSelfServiceApp />;
  }

  if (window.location.pathname === '/legal/privacy') {
    return (
      <>
        <PrivacyPolicy />
        <CookieConsent />
      </>
    );
  }

  if (window.location.pathname === '/legal/terms') {
    return (
      <>
        <TermsOfService />
        <CookieConsent />
      </>
    );
  }

  return (
    <AppStateProvider>
      <AppRuntime />
      <CookieConsent />
    </AppStateProvider>
  );
}
