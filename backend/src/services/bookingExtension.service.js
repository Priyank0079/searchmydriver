import Booking from '../models/booking.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  BOOKING_STATUS,
  PAYMENT_MODE,
  BOOKING_PAYMENT_STATUS,
} from '../constants/bookingStatus.js';
import { SERVICE_TYPES } from '../constants/serviceTypes.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToBooking,
  emitToAdmins,
  emitToDriver,
} from '../utils/socketEmitters.js';
import { getServicePricingByTypeService } from './pricing.service.js';

/**
 * In-ride extension handling.
 *
 * When the user accepts the "your booked time is ending — extend the ride?"
 * prompt, we land here. The service:
 *
 *   1. Validates the booking is currently started and the user owns it.
 *   2. Computes the incremental fare as
 *        delta = additionalHours × pricing.extraHourCharge
 *      then layers on the same service charge + GST factors the original
 *      fare used (we re-derive them from the snapshot rather than re-querying
 *      pricing to keep behaviour deterministic during the trip).
 *   3. Appends an entry to `booking.extensions[]` with the agreed fareDelta.
 *
 * The persisted `fareSnapshot.total` is intentionally NOT mutated. The
 * payment service computes the chargeable amount via
 * `amountDueForBooking(booking)`, which sums `fareSnapshot.total` and every
 * extension's `fareDelta` and subtracts the running payment ledger.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const MIN_EXTENSION_HOURS = 0.5;
const MAX_EXTENSION_HOURS_DEFAULT = 12;

/**
 * Sum of all confirmed extension fare deltas for a booking. Pulled into its
 * own helper so the payment service can re-use it without depending on the
 * extension lifecycle.
 */
export function extensionsFareDelta(booking) {
  const list = booking?.extensions || [];
  return list.reduce((sum, ext) => sum + (ext?.fareDelta || 0), 0);
}

/**
 * fareSnapshot.total + sum(extensions).
 *
 * This is the "true cost" of the booking and the only number the user
 * ever needs to see. The user pays this upfront; if they later extend,
 * the delta is settled at trip-end.
 */
export function effectiveTotalForBooking(booking) {
  const base = booking?.fareSnapshot?.total || 0;
  const waiting = Number(booking?.waiting?.chargeRupees) || 0;
  return round2(base + extensionsFareDelta(booking) + waiting);
}

/**
 * What's still owed on this booking, accounting for the running payment
 * ledger. Returns a non-negative rupee amount.
 */
export function amountDueForBooking(booking) {
  const effective = effectiveTotalForBooking(booking);
  const paid = booking?.payment?.amountPaidRupees || 0;
  return Math.max(0, round2(effective - paid));
}

/* ------------------------------------------------------------------ */
/* Create extension                                                    */
/* ------------------------------------------------------------------ */

/**
 * Re-derive the service-charge and GST factors that were applied to the
 * original fare snapshot so the extension uses the same percentages — even
 * if the admin later edits the pricing config mid-ride.
 */
function inferRates(fareBreakdown) {
  return {
    serviceChargePercent: fareBreakdown?.serviceChargePercent || 0,
    gstPercent: fareBreakdown?.gstPercent || 0,
  };
}

function computeExtensionDelta(pricing, fareBreakdown, additionalHours) {
  const extraRate = pricing?.extraHourCharge || 0;
  if (!extraRate || extraRate <= 0) {
    throw new ApiError(400, 'Extra-hour pricing is not configured for this service');
  }
  const subtotal = additionalHours * extraRate;
  const { serviceChargePercent, gstPercent } = inferRates(fareBreakdown);
  const serviceCharge = (subtotal * serviceChargePercent) / 100;
  const gst = ((subtotal + serviceCharge) * gstPercent) / 100;
  const fareDelta = round2(subtotal + serviceCharge + gst);
  return {
    fareDelta,
    breakdown: {
      additionalHours,
      ratePerHour: extraRate,
      subtotal: round2(subtotal),
      serviceCharge: round2(serviceCharge),
      gst: round2(gst),
    },
  };
}

export async function createExtensionService(userId, bookingId, body = {}) {
  const additionalHours = Number(body?.additionalHours);
  if (!Number.isFinite(additionalHours) || additionalHours < MIN_EXTENSION_HOURS) {
    throw new ApiError(400, `additionalHours must be at least ${MIN_EXTENSION_HOURS}`);
  }
  if (additionalHours > MAX_EXTENSION_HOURS_DEFAULT) {
    throw new ApiError(400, `additionalHours cannot exceed ${MAX_EXTENSION_HOURS_DEFAULT}`);
  }

  const booking = await Booking.findOne({ _id: bookingId, userId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== BOOKING_STATUS.STARTED) {
    throw new ApiError(400, 'Ride must be in progress to extend');
  }
  if (booking.serviceType !== SERVICE_TYPES.HOURLY) {
    throw new ApiError(400, 'Only hourly bookings can be extended');
  }

  const pricing = await getServicePricingByTypeService(booking.serviceType);
  if (!pricing || !pricing.isActive) {
    throw new ApiError(400, 'Pricing for this service is not configured');
  }
  const fareBreakdown = booking.fareSnapshot?.breakdown || {};
  const { fareDelta, breakdown } = computeExtensionDelta(
    pricing,
    fareBreakdown,
    additionalHours,
  );

  booking.extensions.push({
    requestedAt: new Date(),
    additionalHours,
    fareDelta,
    status: 'accepted',
    respondedAt: new Date(),
  });

  // Post-pay bookings need to surface a "you'll be charged X extra" prompt
  // at trip-end, but no immediate Razorpay flow. Pre-paid bookings keep
  // their PAID status until the post-ride flow picks up the delta —
  // ledger math takes care of charging only the extra.
  if (
    booking.paymentMode === PAYMENT_MODE.PRE_RIDE &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID
  ) {
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.PENDING;
  }

  await booking.save();

  // Driver doesn't see the payment side of an extension, just that the
  // booking now runs longer. We broadcast a compact patch carrying the
  // updated extensions list so every UI can rerender its remaining-time
  // indicator.
  const userPayload = {
    bookingId: String(booking._id),
    extensions: booking.extensions.map((ext) => ext.toObject?.() || ext),
    paymentStatus: booking.paymentStatus,
    effectiveTotal: effectiveTotalForBooking(booking),
    amountDue: amountDueForBooking(booking),
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, userPayload);
  const roomPayload = {
    bookingId: String(booking._id),
    extensions: userPayload.extensions,
  };
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, roomPayload);
  if (booking.driverId) {
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_UPDATED, roomPayload);
  }
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, { ...userPayload, breakdown });

  return booking.toObject();
}
