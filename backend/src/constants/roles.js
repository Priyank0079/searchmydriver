/** App roles stored on User documents */
export const USER_ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  TEAM_MEMBER: 'team_member',
  DRIVER: 'driver',
});

/** Roles allowed to access the admin/staff API surface */
export const STAFF_ROLES = Object.freeze([USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER]);

/** JWT: principal stored in User collection */
export const ACCOUNT_USER = 'user';

/** JWT: principal stored in Driver collection */
export const ACCOUNT_DRIVER = 'driver';
