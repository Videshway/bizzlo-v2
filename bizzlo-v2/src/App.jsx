import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { CookieConsent } from './components/CookieConsent';
import { Shell } from './components/Shell';
import { RouteLoading } from './components/RouteLoading';
import { AppStateProvider, useAppState } from './lib/appState';
import { buildWorkspaceRoute, resolveWorkspaceRoute } from './lib/workspaceRoutes';
import { Dashboard } from './pages/Dashboard';

const Audit = lazy(() => import('./pages/Audit').then((module) => ({ default: module.Audit })));
const Applications = lazy(() => import('./pages/Applications').then((module) => ({ default: module.Applications })));
const Commissions = lazy(() => import('./pages/Commissions').then((module) => ({ default: module.Commissions })));
const CourseFinder = lazy(() => import('./pages/CourseFinder').then((module) => ({ default: module.CourseFinder })));
const Documents = lazy(() => import('./pages/Documents').then((module) => ({ default: module.Documents })));
const Support = lazy(() => import('./pages/StaticInfo').then((module) => ({ default: module.Support })));
const StudentPortal = lazy(() => import('./pages/StudentPortal').then((module) => ({ default: module.StudentPortal })));
const StudentSelfServiceApp = lazy(() => import('./pages/StudentSelfService').then((module) => ({ default: module.StudentSelfServiceApp })));
const Students = lazy(() => import('./pages/Students').then((module) => ({ default: module.Students })));
const Team = lazy(() => import('./pages/Team').then((module) => ({ default: module.Team })));
const Tasks = lazy(() => import('./pages/Tasks').then((module) => ({ default: module.Tasks })));
const PrivacyPolicy = lazy(() => import('./pages/Legal').then((module) => ({ default: module.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/Legal').then((module) => ({ default: module.TermsOfService })));

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
  tasks: Tasks,
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

function routeFromLocation() {
  const route = resolveWorkspaceRoute(window.location.pathname, window.location.search);
  if (window.location.pathname + window.location.search !== route.path) {
    window.history.replaceState({}, '', route.path);
  }
  return route;
}

function BizzloApp() {
  const {
    setActiveInviteStudentId,
    setActiveInviteUrl,
    activeInviteUrl,
    visibleStudents,
  } = useAppState();
  const [route, setRoute] = useState(routeFromLocation);
  const activePage = route.page;
  const routeParams = new URLSearchParams(route.search);
  const Page = pages[activePage] || Dashboard;

  const navigate = useCallback((page, options = {}) => {
    const destination = buildWorkspaceRoute(page, options, window.location.origin);
    if (window.location.pathname + window.location.search !== destination.path) {
      window.history.pushState({ page: destination.page }, '', destination.path);
    }
    setRoute(destination);
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const inviteCode = new URLSearchParams(route.search).get('invite');
    if (!inviteCode) return;

    const code = inviteCode.toLowerCase();
    const student = visibleStudents.find((item) => (
      String(item.student_code || '').toLowerCase() === code
      || String(item.id).toLowerCase() === code
    ));

    if (student) {
      setActiveInviteStudentId(student.id);
      const token = new URLSearchParams(route.search).get('token');
      const portalPath = `/portal/${encodeURIComponent(String(student.student_code || student.id).toLowerCase())}`;
      const existingInvite = activeInviteUrl ? new URL(activeInviteUrl, window.location.origin) : null;
      if (existingInvite?.pathname !== portalPath || (token && existingInvite.searchParams.get('token') !== token)) {
        setActiveInviteUrl(`${window.location.origin}${portalPath}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      }
    }
  }, [activeInviteUrl, route.search, setActiveInviteStudentId, setActiveInviteUrl, visibleStudents]);

  return (
    <Shell activePage={activePage} onNavigate={navigate}>
      <Suspense key={`${activePage}${route.search}`} fallback={<RouteLoading label="workspace" />}>
        <Page
          onNavigate={navigate}
          initialQuery={routeParams.get('q') || ''}
          initialStudentId={routeParams.get('studentId') || ''}
          initialApplicationId={routeParams.get('applicationId') || ''}
        />
      </Suspense>
    </Shell>
  );
}

function AppRuntime() {
  const { isDemoMode, isProductionMisconfigured, authLoading, currentUser } = useAppState();
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/);

  if (!isDemoMode && !currentUser && inviteMatch) {
    const target = `/portal/${inviteMatch[1]}${window.location.search}`;
    window.history.replaceState({}, '', target);
    return <Suspense fallback={<RouteLoading label="student portal" />}><StudentSelfServiceApp /></Suspense>;
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
    return <Suspense fallback={<RouteLoading label="student portal" />}><StudentSelfServiceApp /></Suspense>;
  }

  if (window.location.pathname === '/legal/privacy') {
    return (
      <>
        <Suspense fallback={<RouteLoading label="privacy policy" />}><PrivacyPolicy /></Suspense>
        <CookieConsent />
      </>
    );
  }

  if (window.location.pathname === '/legal/terms') {
    return (
      <>
        <Suspense fallback={<RouteLoading label="terms of service" />}><TermsOfService /></Suspense>
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
