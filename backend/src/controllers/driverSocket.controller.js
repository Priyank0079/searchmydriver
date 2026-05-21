import {
  recordDriverLocation,
  markDriverOnlineLive,
  markDriverOfflineLive,
} from '../services/driverLocation.service.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { C2S_EVENTS, S2C_EVENTS } from '../constants/socketEvents.js';

/**
 * Socket-side handlers for driver-specific events.
 *
 * Registration happens in `config/socket.js` on every authenticated driver
 * connection. Non-driver principals never reach this module.
 */

/** Hard per-driver rate limit (one location every ~1.5s, allowing for jitter). */
const MIN_LOCATION_INTERVAL_MS = 1_500;

/** Grace period before marking a disconnected driver offline (handles tab reloads). */
const OFFLINE_GRACE_MS = 8_000;

/** driverId → last accepted location timestamp. */
const lastEventAt = new Map();

/** driverId → pending offline timeout handle. */
const offlineTimers = new Map();

function clearOfflineTimer(driverId) {
  const h = offlineTimers.get(driverId);
  if (h) {
    clearTimeout(h);
    offlineTimers.delete(driverId);
  }
}

function isThrottled(driverId) {
  const now = Date.now();
  const last = lastEventAt.get(driverId) || 0;
  if (now - last < MIN_LOCATION_INTERVAL_MS) return true;
  lastEventAt.set(driverId, now);
  return false;
}

/* ------------------------------------------------------------------ */
/* Public: register handlers on an authenticated driver socket         */
/* ------------------------------------------------------------------ */

export function attachDriverSocketHandlers(socket) {
  const { principal } = socket.data;
  if (principal?.type !== 'driver') return;
  const driverId = String(principal.id);

  // Any reconnect = cancel a pending offline sweep
  clearOfflineTimer(driverId);

  socket.on(C2S_EVENTS.DRIVER_LOCATION_UPDATE, async (payload, ack) => {
    try {
      if (isThrottled(driverId)) {
        if (typeof ack === 'function') ack({ ok: false, reason: 'throttled' });
        return;
      }

      const { lat, lng, accuracy, heading, speed } = payload || {};
      const result = await recordDriverLocation(driverId, { lat, lng, accuracy, heading, speed });

      if (!result.accepted) {
        if (typeof ack === 'function') ack({ ok: false, reason: result.reason });
        return;
      }
      if (typeof ack === 'function') {
        ack({ ok: true, mongoSnapshot: result.mongoSnapshot, firebase: result.firebase });
      }
    } catch (err) {
      console.error('[driverSocket] location update failed:', err);
      if (typeof ack === 'function') ack({ ok: false, reason: 'server_error' });
    }
  });

  socket.on(C2S_EVENTS.DRIVER_ONLINE, async (_payload, ack) => {
    try {
      // Trust the REST endpoint as source of truth for the Mongo `isOnline`
      // flag (it runs kit-eligibility checks). We only mirror to Firebase here.
      const driver = await Driver.findById(driverId).select('isOnline approvalStatus');
      if (!driver || !driver.isOnline) {
        if (typeof ack === 'function') ack({ ok: false, reason: 'not_online_in_db' });
        return;
      }
      await markDriverOnlineLive(driverId);
      socket.emit(S2C_EVENTS.DRIVER_STATUS_CHANGED, { isOnline: true });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('[driverSocket] online mirror failed:', err);
      if (typeof ack === 'function') ack({ ok: false, reason: 'server_error' });
    }
  });

  socket.on(C2S_EVENTS.DRIVER_OFFLINE, async (_payload, ack) => {
    try {
      await markDriverOfflineLive(driverId);
      socket.emit(S2C_EVENTS.DRIVER_STATUS_CHANGED, { isOnline: false });
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('[driverSocket] offline mirror failed:', err);
      if (typeof ack === 'function') ack({ ok: false, reason: 'server_error' });
    }
  });

  // When the socket drops, schedule a delayed offline write. A quick reload
  // or transient network blip won't be enough to wipe the driver's presence.
  socket.on('disconnect', () => {
    clearOfflineTimer(driverId);
    const handle = setTimeout(async () => {
      offlineTimers.delete(driverId);
      try {
        const driver = await Driver.findById(driverId).select('isOnline');
        // Only clear Firebase if the DB also says they're not online (a
        // toggle-off racing the reconnect would have updated the DB).
        if (!driver?.isOnline) {
          await markDriverOfflineLive(driverId);
        }
      } catch (err) {
        console.warn('[driverSocket] post-disconnect offline check failed:', err.message);
      }
    }, OFFLINE_GRACE_MS);
    offlineTimers.set(driverId, handle);
  });
}
