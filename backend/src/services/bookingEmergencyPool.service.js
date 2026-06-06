import mongoose from 'mongoose';
import Booking from '../models/booking.model.js';
import Car from '../models/user/car.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  BOOKING_STATUS,
  BOOKING_PAYMENT_STATUS,
  BOOKING_TYPE,
  DISPATCH_RESPONSE,
  SCHEDULED_BOOKING,
} from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToDriver,
  emitToBooking,
  emitToAdmins,
} from '../utils/socketEmitters.js';
import { withdrawCurrentOfferService } from './bookingDispatch.service.js';
import {
  cancelScheduledBookingJobs,
  enqueueRemindersAfterAssignment,
} from './bookingScheduled.service.js';
import { hasOperationalStaffAccess } from '../constants/staffPermissions.js';

/**
 * Emergency pool — the manual-assignment safety net for scheduled rides.
 *
 *   Worker fires `escalate` at `scheduledStartAt − EMERGENCY_POOL_MINUTES`.
 *     → if no driver yet, the booking moves to `IN_EMERGENCY_POOL`.
 *     → admin/sub-admin see every entry; team_member only sees rows
 *       whose `zoneIds` overlap their `assignedZones`.
 *     → admin picks a driver and calls `adminAssignDriverToEmergencyPool`,
 *       which mirrors the standard accept-booking transition (driver
 *       gets `isOnTrip = true`, status flips to DRIVER_ASSIGNED, full
 *       socket fan-out).
 *
 * The wave dispatcher is bypassed at assignment — this is a human picking
 * a specific driver, not an offer broadcast.
 */

/**
 * Lazily load the buffer-minutes resolver from `bookingDispatch`. Used
 * by the manual-assignment path so the lock decision uses the same
 * per-service buffer admins configure for the auto dispatcher.
 */
async function resolveBufferMinutesFor(serviceType) {
  try {
    const { loadScheduledDispatchConfig } = await import(
      './bookingScheduled.service.js'
    );
    const cfg = await loadScheduledDispatchConfig(serviceType);
    const value = Number(cfg?.RIDE_BUFFER_MINUTES);
    if (Number.isFinite(value) && value >= 0) return value;
  } catch {
    // fall through to default
  }
  return SCHEDULED_BOOKING.RIDE_BUFFER_MINUTES;
}

/**
 * Whether an emergency-pool assignment should immediately set
 * `Driver.isOnTrip = true`. Same logic as the dispatcher's accept
 * path — instant bookings always lock; scheduled bookings only lock
 * if pickup is within one buffer window of now.
 */
async function shouldImmediatelyLockOnEmergencyAssign(booking) {
  if (!booking) return true;
  if (booking.bookingType !== BOOKING_TYPE.SCHEDULED) return true;

  const scheduledAt = booking?.hourly?.scheduledStartAt;
  if (!scheduledAt) return true;
  const startMs = new Date(scheduledAt).getTime();
  if (!Number.isFinite(startMs)) return true;

  const bufferMinutes = await resolveBufferMinutesFor(booking.serviceType);
  const lockLeadMs = Math.max(0, Number(bufferMinutes) || 0) * 60_000;
  return startMs - Date.now() <= lockLeadMs;
}

/* ------------------------------------------------------------------ */
/* Escalation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Worker handler for the `escalate` job. Moves a scheduled booking into
 * the manual-assignment queue if the dispatcher still hasn't paired it
 * with a driver.
 *
 *   - PENDING_ASSIGNMENT / SEARCHING / NO_DRIVERS_FOUND → IN_EMERGENCY_POOL
 *   - any other status → no-op (booking already has a driver or is
 *     cancelled / completed; no action needed).
 *
 * Withdraws any in-flight offers so the wave dispatcher doesn't keep
 * paging drivers while the booking is parked in the pool.
 */
export async function escalateToEmergencyPool(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { ok: false, reason: 'not_found' };

  const escalatable = new Set([
    BOOKING_STATUS.PENDING_ASSIGNMENT,
    BOOKING_STATUS.SEARCHING,
    BOOKING_STATUS.NO_DRIVERS_FOUND,
  ]);
  if (booking.driverId || !escalatable.has(booking.status)) {
    return { ok: false, reason: 'not_escalatable', status: booking.status };
  }

  // Best-effort: withdraw the current wave so we don't keep paging
  // drivers about a booking that an admin is about to assign manually.
  try {
    await withdrawCurrentOfferService(booking._id, 'moved_to_emergency_pool');
  } catch (err) {
    console.warn(
      '[emergencyPool] failed to withdraw offers for',
      String(booking._id),
      err?.message,
    );
  }

  booking.status = BOOKING_STATUS.IN_EMERGENCY_POOL;
  booking.scheduled = {
    ...(booking.scheduled?.toObject?.() || booking.scheduled || {}),
    escalatedAt: new Date(),
    emergencyPool: {
      ...(booking.scheduled?.emergencyPool?.toObject?.() ||
        booking.scheduled?.emergencyPool ||
        {}),
      enteredAt: new Date(),
    },
  };
  await booking.save();

  const payload = {
    bookingId: String(booking._id),
    status: booking.status,
    scheduledStartAt: booking.hourly?.scheduledStartAt || null,
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, payload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, payload);
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, payload);
  emitToAdmins(S2C_EVENTS.ADMIN_ALERT, {
    kind: 'emergency_pool_entered',
    severity: 'warn',
    message: `Booking ${booking.bookingNumber} needs manual driver assignment`,
    data: {
      bookingId: String(booking._id),
      scheduledStartAt: booking.hourly?.scheduledStartAt || null,
      zoneIds: (booking.zoneIds || []).map(String),
    },
  });

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Listing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve which zones a staff account is allowed to see in the emergency
 * pool. `null` means "all zones" (admin / sub_admin); an array of
 * ObjectIds means "filter to these zones".
 */
function zoneScopeForStaff(staff) {
  if (!staff) return [];
  if (hasOperationalStaffAccess(staff)) return null;
  const ids = (staff.assignedZones || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return ids;
}

/**
 * List bookings sitting in the emergency pool, scoped by the caller's
 * role:
 *
 *   admin / sub_admin → every row
 *   team_member       → rows whose `zoneIds` overlap `assignedZones`
 *                       (returns [] when the staff has no zones)
 *
 * Ordered by `hourly.scheduledStartAt` ASC so the most urgent pickups
 * surface first. Returns the standard `{ bookings, total, page, pages }`
 * pagination envelope used by other admin list endpoints.
 */
export async function listEmergencyPoolBookingsService({ staff, query = {} }) {
  const { page = 1, limit = 20, search } = query;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const filter = {
    status: BOOKING_STATUS.IN_EMERGENCY_POOL,
    isDeleted: false,
  };

  const scope = zoneScopeForStaff(staff);
  if (scope !== null) {
    if (!scope.length) {
      return { bookings: [], total: 0, page: parseInt(page, 10), pages: 0 };
    }
    filter.zoneIds = { $in: scope };
  }

  if (search) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(search);
    filter.$or = [
      { bookingNumber: { $regex: search, $options: 'i' } },
      ...(isObjectId ? [{ _id: search }] : []),
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('userId', 'name phone_no')
      .populate('zoneIds', 'name code city')
      .sort({ 'hourly.scheduledStartAt': 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / Math.max(1, parseInt(limit, 10))),
  };
}

/* ------------------------------------------------------------------ */
/* Manual assignment                                                   */
/* ------------------------------------------------------------------ */

/**
 * Admin picks a specific driver for a booking sitting in the emergency
 * pool. Mirrors the success path of `acceptBookingService` (driver
 * stamped, on-trip flag set, sockets fanned out) but skips the wave
 * machinery entirely — there is no offer, no timeout, no withdrawal.
 *
 * Pre-payment is not retriggered: scheduled bookings are wallet-paid at
 * creation time, so the driver gets a fully-paid booking they can start
 * immediately (matching the `alreadyPaid` branch in
 * `acceptBookingService`).
 *
 * @param {string} bookingId
 * @param {string} driverId
 * @param {{ staffId?: string, notes?: string }} opts
 */
export async function adminAssignDriverToEmergencyPoolService(
  bookingId,
  driverId,
  { staffId, notes = '' } = {},
) {
  if (!bookingId || !driverId) {
    throw new ApiError(400, 'bookingId and driverId are required');
  }

  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== BOOKING_STATUS.IN_EMERGENCY_POOL) {
    throw new ApiError(
      409,
      `Booking is not in the emergency pool (status: ${booking.status})`,
    );
  }

  const driver = await Driver.findOne({
    _id: driverId,
    isDeleted: { $ne: true },
    approvalStatus: 'approved',
  });
  if (!driver) throw new ApiError(404, 'Driver not found or not approved');
  if (driver.isOnTrip) {
    throw new ApiError(409, 'Driver is already on another trip');
  }

  // Cancel any pending scheduled-jobs so the worker doesn't fire the
  // already-assigned booking back into reminders / escalation cycles.
  cancelScheduledBookingJobs(booking._id).catch(() => {});

  const now = new Date();
  booking.driverId = driver._id;
  booking.timeline = booking.timeline || {};
  booking.timeline.driverAssignedAt = now;
  booking.status = BOOKING_STATUS.DRIVER_ASSIGNED;
  booking.scheduled = {
    ...(booking.scheduled?.toObject?.() || booking.scheduled || {}),
    emergencyPool: {
      ...(booking.scheduled?.emergencyPool?.toObject?.() ||
        booking.scheduled?.emergencyPool ||
        {}),
      assignedBy: staffId || null,
      assignedAt: now,
      notes: notes || '',
    },
  };

  if (booking.dispatch) {
    // Record this as an admin-side assignment in the offers history for
    // the audit trail (matches the dispatch row shape used for accepts).
    booking.dispatch.offers = booking.dispatch.offers || [];
    booking.dispatch.offers.push({
      driverId: driver._id,
      offeredAt: now,
      respondedAt: now,
      response: DISPATCH_RESPONSE.ACCEPTED,
      distanceMeters: null,
    });
    booking.dispatch.pendingOfferIds = [];
    booking.dispatch.currentExpiresAt = null;
  }

  await booking.save();

  // Mirror the dispatcher's "only lock immediately if pickup is close"
  // rule so admins can still hand drivers a far-future scheduled
  // booking without taking them off the dispatch radar for the
  // intervening hours. `markDriverEnRouteService` flips the flag for
  // sure once the driver actually starts heading to pickup.
  const lockNow = await shouldImmediatelyLockOnEmergencyAssign(booking);
  if (lockNow) {
    await Driver.updateOne({ _id: driver._id }, { $set: { isOnTrip: true } });
  }

  // Now that the booking has a driver, queue the pre-pickup reminders.
  // Fire-and-forget — the queue degrades to no-op when Redis is down,
  // and stamping `remindersEnqueuedAt` keeps repeats out of Redis on
  // re-saves.
  enqueueRemindersAfterAssignment(booking).catch((err) =>
    console.warn(
      '[emergencyPool] reminder enqueue failed for',
      String(booking._id),
      err?.message,
    ),
  );

  // Hydrate the driver-side payload exactly like the dispatcher does so
  // the driver app can route straight to the active-trip screen.
  const userPayload = {
    bookingId: String(booking._id),
    status: booking.status,
    paymentMode: booking.paymentMode,
    paymentStatus: booking.paymentStatus,
    driverId: String(driver._id),
    timeline: booking.timeline?.toObject?.() || booking.timeline,
  };
  const driverPayload = {
    bookingId: String(booking._id),
    status: booking.status,
    driverId: String(driver._id),
    timeline: booking.timeline?.toObject?.() || booking.timeline,
  };

  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, userPayload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, driverPayload);
  emitToDriver(driver._id, S2C_EVENTS.BOOKING_UPDATED, driverPayload);
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, userPayload);

  // Bubble out the gross fare so the driver app's earnings card can
  // render the same number the user sees on their receipt — we don't
  // wait for the next refresh.
  emitToDriver(driver._id, S2C_EVENTS.NOTIFICATION, {
    title: 'New assignment',
    body: `Admin assigned booking ${booking.bookingNumber} to you.`,
    severity: 'info',
    data: {
      bookingId: String(booking._id),
      scheduledStartAt: booking.hourly?.scheduledStartAt || null,
    },
  });

  return {
    booking: await Booking.findById(booking._id)
      .populate('driverId', 'name phone_no')
      .populate('userId', 'name phone_no')
      .lean(),
    paid: booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID,
  };
}

/**
 * Helper for the admin "assign driver" picker — returns the approved,
 * non-on-trip, online-ish drivers ordered by experience. Pure query;
 * the picker can fan out a more sophisticated geo search later.
 */
export async function listAvailableDriversForAssignmentService({
  carTypeId,
  limit = 50,
} = {}) {
  const match = {
    approvalStatus: 'approved',
    isDeleted: { $ne: true },
    isOnTrip: false,
  };
  if (carTypeId) {
    try {
      match.carTypeExperience = new mongoose.Types.ObjectId(String(carTypeId));
    } catch {
      // ignore — bad id just means no car-type filter
    }
  }
  const drivers = await Driver.find(match)
    .select('name phone_no rating experienceYears isOnline location lastLocationAt')
    .sort({ isOnline: -1, rating: -1, experienceYears: -1 })
    .limit(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200))
    .lean();
  return drivers;
}

/**
 * Look up the user's car so the admin "assign driver" picker can scope
 * to drivers who actually can drive it.
 */
export async function getBookingCarTypeIdService(bookingId) {
  const booking = await Booking.findById(bookingId).select('carId').lean();
  if (!booking?.carId) return null;
  const car = await Car.findById(booking.carId).select('carTypeId').lean();
  return car?.carTypeId ? String(car.carTypeId) : null;
}
