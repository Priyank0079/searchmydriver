import Booking from '../models/booking.model.js';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
  SCHEDULED_BOOKING,
} from '../constants/bookingStatus.js';
import { estimateBookingWindow } from './driverConflict.service.js';

/**
 * Vehicle (car) scheduling-conflict helpers.
 *
 * Mirror of {@link ./driverConflict.service.js}, but keyed on
 * `booking.carId` instead of `driverId`. Used by the manual-assignment
 * pipeline (admin outstation queue) so a vehicle is never handed out
 * twice for overlapping windows — independently of which driver was
 * picked. Even though the user picks their own car at booking time
 * (`assertCarAvailableForWindow` already validates at creation), this
 * re-checks at assignment time to catch:
 *
 *   - A new booking created on the same car between booking creation
 *     and the admin actually flipping it to DRIVER_ASSIGNED.
 *   - Edge cases where a maintenance/admin block is added on the car
 *     in the same window.
 *
 * The shared buffer (`SCHEDULED_BOOKING.RIDE_BUFFER_MINUTES`, admin-
 * tunable via `ServicePricing.scheduledDispatch.RIDE_BUFFER_MINUTES`)
 * is applied symmetrically around BOTH the existing booking and the
 * new request so a car always has a cleaning / handover gap between
 * trips.
 */

/**
 * Returns every active booking whose buffered window overlaps `window`
 * for any of the supplied car IDs.
 *
 *   { [carId]: [{ _id, bookingNumber, bookingType, status, startMs, endMs }, ...] }
 *
 * Empty entries are omitted so callers can `Boolean(map[carId])`.
 */
export async function getVehicleConflictMap({
  carIds = [],
  window,
  excludeBookingId = null,
  bufferMinutes = SCHEDULED_BOOKING.RIDE_BUFFER_MINUTES,
} = {}) {
  const out = {};
  if (!carIds.length) return out;
  if (!window || !Number.isFinite(window.startMs) || !Number.isFinite(window.endMs)) {
    return out;
  }

  const carIdStrings = carIds.map(String);
  const query = {
    isDeleted: false,
    carId: { $in: carIdStrings },
    status: {
      $in: ACTIVE_BOOKING_STATUSES.filter(
        (status) =>
          // Same logic as driverConflict — exclude pre-driver / pool
          // states. PENDING_ASSIGNMENT can collide for vehicles because
          // multiple admins might be eyeing the same car; we DO include
          // those rows so the UI can warn the second admin.
          status !== BOOKING_STATUS.SEARCHING &&
          status !== BOOKING_STATUS.IN_EMERGENCY_POOL,
      ),
    },
  };
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const candidates = await Booking.find(query)
    .select(
      'bookingNumber bookingType carId hourly outstation timeline status serviceType driverId',
    )
    .lean();
  if (!candidates.length) return out;

  const bufferMs = Math.max(0, Number(bufferMinutes) || 0) * 60_000;
  const newStart = window.startMs;
  const newEnd = window.endMs;

  for (const candidate of candidates) {
    const baseWindow = estimateBookingWindow(candidate);
    if (!baseWindow) continue;
    const paddedStart = baseWindow.startMs - bufferMs;
    const paddedEnd = baseWindow.endMs + bufferMs;
    if (paddedStart <= newEnd && paddedEnd >= newStart) {
      const key = String(candidate.carId);
      if (!out[key]) out[key] = [];
      out[key].push({
        _id: String(candidate._id),
        bookingNumber: candidate.bookingNumber,
        bookingType: candidate.bookingType,
        serviceType: candidate.serviceType,
        status: candidate.status,
        startMs: baseWindow.startMs,
        endMs: baseWindow.endMs,
        driverId: candidate.driverId ? String(candidate.driverId) : null,
      });
    }
  }

  return out;
}

/**
 * Convenience wrapper: load the conflicts for a single car against the
 * given booking window. Returns `[]` when the car is clear.
 */
export async function getVehicleConflicts({
  carId,
  window,
  excludeBookingId = null,
  bufferMinutes,
} = {}) {
  if (!carId) return [];
  const map = await getVehicleConflictMap({
    carIds: [carId],
    window,
    excludeBookingId,
    bufferMinutes,
  });
  return map[String(carId)] || [];
}
