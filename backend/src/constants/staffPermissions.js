import { USER_ROLES } from './roles.js';

/** Roles that can use the admin panel API */
export const STAFF_ROLES = Object.freeze([
  USER_ROLES.ADMIN,
  USER_ROLES.SUB_ADMIN,
  USER_ROLES.TEAM_MEMBER,
]);

/** Route groups for restrictTo() */
export const ROUTE_ROLES = Object.freeze({
  ALL_STAFF: STAFF_ROLES,
  OPERATIONS: [USER_ROLES.ADMIN, USER_ROLES.SUB_ADMIN],
  SUPER_ADMIN: [USER_ROLES.ADMIN],
});

export function isSuperAdmin(staff) {
  return staff?.role === USER_ROLES.ADMIN;
}

export function isSubAdmin(staff) {
  return staff?.role === USER_ROLES.SUB_ADMIN;
}

export function isTeamMember(staff) {
  return staff?.role === USER_ROLES.TEAM_MEMBER;
}

/** Super admin + sub admin — full operational visibility (all drivers, tasks, assign) */
export function hasOperationalStaffAccess(staff) {
  return isSuperAdmin(staff) || isSubAdmin(staff);
}

export function canManageTeam(staff) {
  return isSuperAdmin(staff);
}

export function canManagePaymentSettings(staff) {
  return isSuperAdmin(staff);
}

export function canManageTaskAssignment(staff) {
  return hasOperationalStaffAccess(staff);
}

export function canViewTaskActivityLog(staff) {
  return isSuperAdmin(staff);
}

export function canManagePlatformSettings(staff) {
  return hasOperationalStaffAccess(staff);
}

export function canManageKitsCatalog(staff) {
  return hasOperationalStaffAccess(staff);
}

export function canManageZones(staff) {
  return hasOperationalStaffAccess(staff);
}
