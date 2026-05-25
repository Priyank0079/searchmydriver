import { Driver } from '../models/driverModels/driver.model.js';
import { getRtdb, isFirebaseReady } from '../config/firebase.js';
import { emitToAdmins } from '../utils/socketEmitters.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';

/**
 * Live-location pipeline for drivers.
 *
 * Storage split:
 *   - Firebase Realtime DB → /drivers/{driverId}/location  ← every emit (5s)
 *     Authoritative source for "where is this driver right now". User apps
 *     and the admin live map subscribe here.
 *   - MongoDB → Driver.location + Driver.lastLocationAt    ← throttled (>=60s)
 *     Used for `$nearSphere` matching during booking. Drivers don't teleport
 *     so a 60s-stale snapshot is fine for dispatch.
 *
 * Anything in this file silently no-ops when Firebase isn't configured so
 * Phase 2 deployments keep working until the env is filled in.
 */

const MONGO_SNAPSHOT_MIN_INTERVAL_MS = 60_000;

/** In-memory map of driverId → last Mongo write timestamp (per process). */
const lastMongoWriteAt = new Map();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function validateCoords({ lat, lng }) {
  return isFiniteNum(lat) && isFiniteNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function driverPath(driverId) {
  return `drivers/${driverId}`;
}

function nowMs() {
  return Date.now();
}

/* ------------------------------------------------------------------ */
/* Firebase writes                                                     */
/* ------------------------------------------------------------------ */

async function writeFirebaseLocation(driverId, payload) {
  const rtdb = getRtdb();
  if (!rtdb) return false;
  try {
    await rtdb.ref(`${driverPath(driverId)}/location`).set(payload);
    return true;
  } catch (err) {
    console.warn('[driverLocation] Firebase write failed:', err.message);
    return false;
  }
}

async function writeFirebaseStatus(driverId, status) {
  const rtdb = getRtdb();
  if (!rtdb) return false;
  try {
    await rtdb.ref(`${driverPath(driverId)}/status`).set(status);
    return true;
  } catch (err) {
    console.warn('[driverLocation] Firebase status write failed:', err.message);
    return false;
  }
}

async function clearFirebaseDriver(driverId) {
  const rtdb = getRtdb();
  if (!rtdb) return false;
  try {
    await rtdb.ref(driverPath(driverId)).remove();
    return true;
  } catch (err) {
    console.warn('[driverLocation] Firebase clear failed:', err.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Mongo writes                                                        */
/* ------------------------------------------------------------------ */

async function snapshotMongoLocation(driverId, { lat, lng }) {
  await Driver.updateOne(
    { _id: driverId },
    {
      $set: {
        location: { type: 'Point', coordinates: [lng, lat] },
        lastLocationAt: new Date(),
      },
    },
  );
  lastMongoWriteAt.set(String(driverId), nowMs());
}

/* ------------------------------------------------------------------ */
/* Public service API                                                  */
/* ------------------------------------------------------------------ */

/**
 * Persist a driver's current GPS position.
 *
 * Behavior:
 *   - Always writes to Firebase (cheap, broadcast).
 *   - Writes to Mongo at most once every `MONGO_SNAPSHOT_MIN_INTERVAL_MS`.
 *
 * @param {string} driverId
 * @param {{ lat:number; lng:number; accuracy?:number; heading?:number; speed?:number }} coords
 * @returns {{ accepted: boolean; firebase: boolean; mongoSnapshot: boolean; reason?: string }}
 */
export async function recordDriverLocation(driverId, coords) {
  if (!driverId) return { accepted: false, firebase: false, mongoSnapshot: false, reason: 'no driverId' };
  if (!validateCoords(coords)) {
    return { accepted: false, firebase: false, mongoSnapshot: false, reason: 'invalid coordinates' };
  }

  const { lat, lng, accuracy, heading, speed } = coords;
  const now = nowMs();

  const fbPayload = {
    lat,
    lng,
    accuracy: isFiniteNum(accuracy) ? accuracy : null,
    heading: isFiniteNum(heading) ? heading : null,
    speed: isFiniteNum(speed) ? speed : null,
    updatedAt: now,
  };

  const firebaseOk = await writeFirebaseLocation(driverId, fbPayload);

  let mongoSnapshot = false;
  const lastMongoAt = lastMongoWriteAt.get(String(driverId)) || 0;
  if (now - lastMongoAt >= MONGO_SNAPSHOT_MIN_INTERVAL_MS) {
    try {
      await snapshotMongoLocation(driverId, { lat, lng });
      mongoSnapshot = true;
    } catch (err) {
      console.warn('[driverLocation] Mongo snapshot failed:', err.message);
    }
  }

  return { accepted: true, firebase: firebaseOk, mongoSnapshot };
}

/**
 * Mark a driver as available in Firebase. Called when the REST online toggle
 * flips on, AND when the driver's socket reconnects after going online.
 */
export async function markDriverOnlineLive(driverId) {
  if (!driverId) return;
  await writeFirebaseStatus(driverId, {
    isOnline: true,
    isOnTrip: false,
    since: nowMs(),
  });
  emitToAdmins(S2C_EVENTS.DRIVER_STATUS_CHANGED, {
    driverId: String(driverId),
    isOnline: true,
    at: nowMs(),
  });
}

/**
 * Tear down a driver's live presence. Called when:
 *   - REST online toggle flips off
 *   - Their socket disconnects (with a small grace period to absorb reloads)
 */
export async function markDriverOfflineLive(driverId) {
  if (!driverId) return;
  await clearFirebaseDriver(driverId);
  lastMongoWriteAt.delete(String(driverId));
  emitToAdmins(S2C_EVENTS.DRIVER_STATUS_CHANGED, {
    driverId: String(driverId),
    isOnline: false,
    at: nowMs(),
  });
}

/**
 * Snapshot of all currently-online drivers from Mongo. Used by the admin
 * live-map page to seed initial markers before the Firebase subscription
 * starts streaming updates.
 *
 * For radius-bound / distance-aware queries, see `driverFinder.service.js`.
 */
export async function listOnlineDriversSnapshot() {
  return Driver.find({
    isOnline: true,
    approvalStatus: 'approved',
    isDeleted: false,
  })
    .select('_id name phone rating location lastLocationAt isOnTrip')
    .lean();
}

/**
 * Returns true when the live pipeline is fully usable (Firebase initialized).
 * Routes can use this to surface a friendly "feature disabled" message instead
 * of failing silently.
 */
export function isLiveLocationReady() {
  return isFirebaseReady();
}
