import {
  getIoOrNull,
  roomForUser,
  roomForDriver,
  roomForBooking,
  ADMIN_ROOM,
} from '../config/socket.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import { Notification } from '../models/notification.model.js';
import User from '../models/user.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { sendFcmNotification } from '../config/firebase.js';

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

/**
 * Normalize the id argument to a plain string so callers can hand us
 * either a raw ObjectId, a string, or a populated Mongoose document.
 * Without this guard `${populatedDoc}` interpolates to `[object Object]`
 * and the emit lands in a phantom room (no one receives it).
 */
function toRoomId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

/** Send to all sockets of a specific app user. */
export function emitToUser(userId, event, payload) {
  const id = toRoomId(userId);
  if (!id) return false;
  return safeEmit(roomForUser(id), event, payload);
}

/** Send to all sockets of a specific driver. */
export function emitToDriver(driverId, event, payload) {
  const id = toRoomId(driverId);
  if (!id) return false;
  return safeEmit(roomForDriver(id), event, payload);
}

/** Send to everyone in a booking room (user + driver + admin observers). */
export function emitToBooking(bookingId, event, payload) {
  const id = toRoomId(bookingId);
  if (!id) return false;
  return safeEmit(roomForBooking(id), event, payload);
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
export async function emitNotification(target, notification) {
  const payload = {
    title: notification.title,
    body: notification.body || '',
    severity: notification.severity || 'info',
    data: notification.data || {},
    isRead: false,
    createdAt: new Date(),
  };

  try {
    let recipientModel = null;
    let recipientId = null;

    if (target.userId) {
      recipientModel = 'User';
      recipientId = target.userId;
    } else if (target.driverId) {
      recipientModel = 'Driver';
      recipientId = target.driverId;
    } else if (target.admin || target.adminRole) {
      recipientModel = 'Admin';
    }

    if (recipientModel) {
      const doc = await Notification.create({
        recipientId,
        recipientModel,
        title: payload.title,
        body: payload.body,
        severity: payload.severity,
        data: payload.data,
      });
      payload._id = doc._id;

      // Fetch user/driver fcmToken to send push notification
      let fcmToken = '';
      if (recipientModel === 'User') {
        const user = await User.findById(recipientId).select('fcmToken').lean();
        fcmToken = user?.fcmToken;
      } else if (recipientModel === 'Driver') {
        const driver = await Driver.findById(recipientId).select('fcmToken').lean();
        fcmToken = driver?.fcmToken;
      }

      if (fcmToken) {
        sendFcmNotification(fcmToken, {
          title: payload.title,
          body: payload.body,
          data: payload.data,
        }).catch(err => console.error('[FCM] Async send failed:', err));
      }
    }
  } catch (err) {
    console.error('[Notification] Failed to save to DB:', err);
  }

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
