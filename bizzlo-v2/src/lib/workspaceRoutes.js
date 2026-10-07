export const pagePaths = {
  dashboard: '/',
  students: '/students',
  applications: '/applications',
  documents: '/documents',
  tasks: '/tasks',
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

export function resolveWorkspaceRoute(pathname, search = '') {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const inviteMatch = normalized.match(/^\/invite\/([^/]+)$/);
  if (inviteMatch) {
    let invite;
    try {
      invite = decodeURIComponent(inviteMatch[1]);
    } catch {
      return { page: 'notFound', path: pathname + search, search };
    }
    const params = new URLSearchParams(search);
    params.set('invite', invite);
    const inviteSearch = `?${params.toString()}`;
    return { page: 'studentPortal', path: `/student-link${inviteSearch}`, search: inviteSearch };
  }
  const path = ['/login', '/auth/login', '/dashboard'].includes(normalized) ? '/' : normalized;
  return { page: pathPages[path] || 'notFound', path: path + search, search };
}

export function buildWorkspaceRoute(page, options = {}, origin) {
  const destination = new URL(options.path || pagePaths[page] || '/not-found', origin);
  if (destination.origin !== origin) throw new Error('Workspace links must stay within this app.');
  for (const [option, parameter] of [['studentId', 'studentId'], ['applicationId', 'applicationId'], ['query', 'q']]) {
    if (options[option] !== undefined && options[option] !== null && options[option] !== '') destination.searchParams.set(parameter, options[option]);
  }
  return resolveWorkspaceRoute(destination.pathname, destination.search);
}
