import {
  getIoOrNull,
  roomForUser,
  roomForDriver,
  roomForBooking,
  ADMIN_ROOM,
} from '../config/socket.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';

/**
 * Thin wrappers around `io.to(room).emit(...)` so feature code never imports
 * Socket.IO directly. Every helper is safe to call before the socket server
 * has booted (returns false silently); this lets unit tests and CLI scripts
 * use the same services without crashing.
 *
 * Callers should treat these as fire-and-forget. The return value is for
 * tests and observability only.
 */

function safeEmit(room, event, payload) {
  const io = getIoOrNull();
  if (!io) return false;
  io.to(room).emit(event, payload);
  return true;
}

/** Send to all sockets of a specific app user. */
export function emitToUser(userId, event, payload) {
  if (!userId) return false;
  return safeEmit(roomForUser(userId), event, payload);
}

/** Send to all sockets of a specific driver. */
export function emitToDriver(driverId, event, payload) {
  if (!driverId) return false;
  return safeEmit(roomForDriver(driverId), event, payload);
}

/** Send to everyone in a booking room (user + driver + admin observers). */
export function emitToBooking(bookingId, event, payload) {
  if (!bookingId) return false;
  return safeEmit(roomForBooking(bookingId), event, payload);
}

/** Broadcast to every staff dashboard. */
export function emitToAdmins(event, payload) {
  return safeEmit(ADMIN_ROOM, event, payload);
}

/** Broadcast to admins of a specific staff role only. */
export function emitToAdminRole(role, event, payload) {
  if (!role) return false;
  return safeEmit(`${ADMIN_ROOM}:role:${role}`, event, payload);
}

/* ------------------------------------------------------------------ */
/* Sugar for common payload shapes                                     */
/* ------------------------------------------------------------------ */

/**
 * In-app notification toast. `target` is one of:
 *   { userId: '...' }, { driverId: '...' }, { admin: true }, { adminRole: 'sub_admin' }
 *
 * @param {object} target
 * @param {{ title: string; body?: string; severity?: 'info'|'success'|'warn'|'error'; data?: object }} notification
 */
export function emitNotification(target, notification) {
  const payload = {
    title: notification.title,
    body: notification.body || '',
    severity: notification.severity || 'info',
    data: notification.data || {},
    sentAt: Date.now(),
  };
  if (target.userId) return emitToUser(target.userId, S2C_EVENTS.NOTIFICATION, payload);
  if (target.driverId) return emitToDriver(target.driverId, S2C_EVENTS.NOTIFICATION, payload);
  if (target.adminRole) return emitToAdminRole(target.adminRole, S2C_EVENTS.NOTIFICATION, payload);
  if (target.admin) return emitToAdmins(S2C_EVENTS.NOTIFICATION, payload);
  return false;
}

/**
 * Operational alert for admin dashboards (driver shortage, kit low, etc.).
 *
 * @param {{ kind: string; severity?: 'info'|'warn'|'critical'; message: string; data?: object }} alert
 */
export function emitAdminAlert(alert) {
  return emitToAdmins(S2C_EVENTS.ADMIN_ALERT, {
    kind: alert.kind,
    severity: alert.severity || 'info',
    message: alert.message,
    data: alert.data || {},
    occurredAt: Date.now(),
  });
}
