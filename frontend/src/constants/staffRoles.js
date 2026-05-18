export const STAFF_ROLES = Object.freeze({
  ADMIN: 'admin',
  SUB_ADMIN: 'sub_admin',
  TEAM_MEMBER: 'team_member',
});

export const STAFF_ROLE_LABELS = {
  [STAFF_ROLES.ADMIN]: 'Super Admin',
  [STAFF_ROLES.SUB_ADMIN]: 'Sub Admin',
  [STAFF_ROLES.TEAM_MEMBER]: 'Team Member',
};

export function isSuperAdmin(role) {
  return role === STAFF_ROLES.ADMIN;
}

export function isSubAdmin(role) {
  return role === STAFF_ROLES.SUB_ADMIN;
}

export function isTeamMember(role) {
  return role === STAFF_ROLES.TEAM_MEMBER;
}

/** Super admin + sub admin */
export function hasOperationalAccess(role) {
  return isSuperAdmin(role) || isSubAdmin(role);
}

export function canAccessTeamManagement(role) {
  return isSuperAdmin(role);
}

export function canAccessPaymentSettings(role) {
  return isSuperAdmin(role);
}

export function canManageTaskAssignment(role) {
  return hasOperationalAccess(role);
}

export function canViewTaskActivityLog(role) {
  return isSuperAdmin(role);
}

export function canManagePlatformSettings(role) {
  return hasOperationalAccess(role);
}

export function canManageKitsCatalog(role) {
  return hasOperationalAccess(role);
}

export function canAccessUsers(role) {
  return hasOperationalAccess(role);
}

/** Nav visibility helper */
export function roleCanAccess(roles, userRole) {
  if (!roles?.length) return true;
  return roles.includes(userRole);
}
