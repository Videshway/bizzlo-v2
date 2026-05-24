export const ADMIN_ROLES = new Set(['super_admin', 'admin']);

export function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

export function isSuperAdminRole(role) {
  return role === 'super_admin';
}

export function hasSuperAdmin(users = []) {
  return users.some((user) => user.role === 'super_admin' && user.is_active !== false);
}

export function canManageFinance(user, users = []) {
  if (!user) return false;
  if (isSuperAdminRole(user.role)) return true;
  return user.role === 'admin' && !hasSuperAdmin(users);
}

export function canManagePartners(user, users = []) {
  if (!user) return false;
  if (isSuperAdminRole(user.role)) return true;
  return user.role === 'admin' && !hasSuperAdmin(users);
}
