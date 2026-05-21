/** Keep in sync with backend/src/constants/socketEvents.js */

export const CONNECTION_EVENTS = Object.freeze({
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
});

/** Client → Server */
export const C2S_EVENTS = Object.freeze({
  PING: 'system:ping',

  DRIVER_LOCATION_UPDATE: 'driver:location:update',
  DRIVER_ONLINE: 'driver:online',
  DRIVER_OFFLINE: 'driver:offline',

  BOOKING_ACCEPT: 'booking:accept',
  BOOKING_REJECT: 'booking:reject',

  BOOKING_JOIN: 'booking:join',
  BOOKING_LEAVE: 'booking:leave',
});

/** Server → Client */
export const S2C_EVENTS = Object.freeze({
  AUTH_ERROR: 'system:auth:error',
  PONG: 'system:pong',
  CONNECTED: 'system:connected',

  DRIVER_STATUS_CHANGED: 'driver:status:changed',
  TRIP_LOCATION_UPDATED: 'trip:location:updated',

  BOOKING_OFFERED: 'booking:offered',
  BOOKING_UPDATED: 'booking:updated',

  NOTIFICATION: 'notification:new',
  ADMIN_ALERT: 'admin:alert',
});
