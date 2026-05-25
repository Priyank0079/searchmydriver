import Booking from '../models/booking.model.js';
import { ApiError } from '../utils/apiError.js';
import { generateBookingNumber } from '../utils/orderNumber.util.js';
import { estimateFareService } from './pricing.service.js';
import {
  cancelPaymentTimeout,
  releaseDriverFromBooking,
} from './bookingPaymentTimeout.service.js';
import {
  loadCancellationPolicy,
  computeUserCancellation,
  computeDriverCancellation,
} from './bookingCancellation.service.js';
import {
  issueBookingRefundService,
  REFUND_INITIATED_BY,
} from './refund.service.js';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  PAYMENT_MODE,
  PAYMENT_MODE_LIST,
  BOOKING_PAYMENT_STATUS,
  BOOKING_TYPE,
  BOOKING_TYPE_LIST,
} from '../constants/bookingStatus.js';
import { SERVICE_TYPES, SERVICE_TYPE_LIST } from '../constants/serviceTypes.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToBooking,
  emitToAdmins,
  emitToDriver,
} from '../utils/socketEmitters.js';

/**
 * Business rules:
 *  - A user can have at most ONE active booking at a time. Trying to create a
 *    second one returns the existing booking instead of erroring (so the
 *    frontend can resume from wherever the user left off).
 *  - Fare is re-computed on the server. The client only sends inputs; the
 *    backend never trusts a client-supplied total.
 *  - Booking is created in `searching` status. Dispatch kicks off in the
 *    controller layer right after, not here, so the service stays pure.
 *  - `paymentMode` always becomes `pre_ride` the moment a driver accepts —
 *    `acceptBookingService` flips the booking into AWAITING_PAYMENT.
 */

/* ------------------------------------------------------------------ */
/* Fare snapshot mapping                                               */
/* ------------------------------------------------------------------ */

/**
 * Flattens the pricing-engine breakdown into the persisted `fareSnapshot`
 * shape. The pricing engine and the booking model use different field
 * names; this is the only place that knows about the mapping.
 *
 *   pricing engine field   →   fareSnapshot field
 *   ─────────────────────       ──────────────────
 *   packagePrice (hourly)   →   baseFare
 *   dailyRateTotal (outst.) →   baseFare
 *   subtotal − baseFare     →   extras  (everything else added before tax)
 *   serviceCharge           →   serviceCharge
 *   gstAmount               →   gst
 *   subscriptionDiscount    →   discount
 *   totalPayable            →   total
 */
function buildFareSnapshot(estimate) {
  const bd = estimate?.fareBreakdown || {};
  const baseFare = bd.packagePrice ?? bd.dailyRateTotal ?? 0;
  const subtotal = bd.subtotal ?? 0;
  const extras = Math.max(0, Number(subtotal) - Number(baseFare));
  return {
    pricingId: estimate?.pricingId || null,
    baseFare: round2(baseFare),
    extras: round2(extras),
    serviceCharge: round2(bd.serviceCharge || 0),
    gst: round2(bd.gstAmount || 0),
    discount: round2(bd.subscriptionDiscount || 0),
    total: round2(bd.totalPayable || 0),
    breakdown: bd,
    subscriptionId: estimate?.subscription?._id || null,
  };
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ------------------------------------------------------------------ */
/* Find existing active booking                                        */
/* ------------------------------------------------------------------ */

/**
 * Strip fields the driver is not allowed to see (the actual OTP code, plus
 * any "is the customer paying now or later" hints — drivers don't need to
 * know the payment timing). The mutation is on a `.lean()` POJO so it's
 * safe and cheap.
 *
 * `otpRequired` is preserved so the driver UI knows when to render the
 * OTP-entry sheet.
 */
export function sanitizeBookingForDriver(booking) {
  if (!booking) return booking;
  const obj = booking;
  if (obj.rideStartOtp) {
    obj.otpRequired = !obj.rideStartOtp.verifiedAt;
    obj.rideStartOtp = {
      generatedAt: obj.rideStartOtp.generatedAt || null,
      verifiedAt: obj.rideStartOtp.verifiedAt || null,
    };
  } else {
    obj.otpRequired = false;
  }
  // Driver doesn't need to see the customer's chosen payment timing or
  // running balance — those are user-side concerns. We still expose the
  // fare snapshot so the driver can see what the trip is worth.
  if ('paymentMode' in obj) delete obj.paymentMode;
  if ('paymentStatus' in obj) delete obj.paymentStatus;
  if ('payment' in obj) delete obj.payment;
  if ('razorpay' in obj) delete obj.razorpay;
  return obj;
}

/**
 * Attach a `cancellationPreview` block onto the booking POJO so the FE
 * can render the confirm-dialog warning without an extra round-trip. The
 * preview is computed from the live admin policy + current booking state
 * (so it shrinks/grows correctly as the booking moves through statuses).
 *
 *   side === 'user'   → `{ feeCharged, refundAmount, tripStarted, ... }`
 *   side === 'driver' → `{ driverPenalty, refundAmount, tripStarted, ... }`
 *
 * The booking object is mutated in place and returned for chainability.
 */
async function attachCancellationPreview(booking, side) {
  if (!booking) return booking;
  try {
    const policy = await loadCancellationPolicy(booking.serviceType);
    if (side === 'driver') {
      booking.cancellationPreview = {
        side: 'driver',
        ...computeDriverCancellation(booking, policy),
        policy,
      };
    } else {
      booking.cancellationPreview = {
        side: 'user',
        ...computeUserCancellation(booking, policy),
        policy,
      };
    }
  } catch (err) {
    // Pricing lookup is best-effort — if the pricing config is missing
    // we just omit the preview rather than failing the whole fetch.
    console.warn('[booking] cancellationPreview hydration failed:', err?.message);
  }
  return booking;
}

export async function getActiveBookingForUserService(userId) {
  if (!userId) return null;
  const booking = await Booking.findOne({
    userId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    isDeleted: false,
  })
    .populate('driverId', 'name phone rating profilePicture')
    .lean();
  return attachCancellationPreview(booking, 'user');
}

export async function getBookingByIdService(bookingId, { userId, driverId } = {}) {
  const filter = { _id: bookingId, isDeleted: false };
  if (userId) filter.userId = userId;
  if (driverId) filter.driverId = driverId;
  const booking = await Booking.findOne(filter)
    .populate('driverId', 'name phone rating profilePicture location')
    .lean();
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (driverId) {
    return attachCancellationPreview(sanitizeBookingForDriver(booking), 'driver');
  }
  return attachCancellationPreview(booking, 'user');
}

export async function getActiveBookingForDriverService(driverId) {
  if (!driverId) return null;
  const booking = await Booking.findOne({
    driverId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    isDeleted: false,
  })
    .populate('userId', 'name phone profilePicture')
    .lean();
  return attachCancellationPreview(sanitizeBookingForDriver(booking), 'driver');
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

function validatePlace(label, place) {
  if (!place?.address?.trim()) throw new ApiError(400, `${label} address is required`);
  const lng = place?.location?.coordinates?.[0];
  const lat = place?.location?.coordinates?.[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new ApiError(400, `${label} coordinates are required ([lng, lat])`);
  }
}

function validateCreateInput(body) {
  const {
    serviceType,
    bookingType,
    paymentMode,
    carId,
    pickup,
    dropoff,
    hourly,
    outstation,
  } = body || {};

  if (!SERVICE_TYPE_LIST.includes(serviceType)) {
    throw new ApiError(400, 'serviceType must be one of: ' + SERVICE_TYPE_LIST.join(', '));
  }
  if (!BOOKING_TYPE_LIST.includes(bookingType)) {
    throw new ApiError(400, 'bookingType must be one of: ' + BOOKING_TYPE_LIST.join(', '));
  }
  // paymentMode is optional on create — defaults to post_ride. If supplied,
  // it must still be in the enum.
  if (paymentMode != null && !PAYMENT_MODE_LIST.includes(paymentMode)) {
    throw new ApiError(400, 'paymentMode must be pre_ride or post_ride');
  }
  if (!carId) throw new ApiError(400, 'carId is required');
  validatePlace('Pickup', pickup);
  if (dropoff) validatePlace('Drop', dropoff);

  if (serviceType === SERVICE_TYPES.HOURLY) {
    if (!hourly?.scheduledStartAt) throw new ApiError(400, 'Hourly: scheduledStartAt is required');
    if (!hourly?.durationHours || hourly.durationHours < 1) {
      throw new ApiError(400, 'Hourly: durationHours must be ≥ 1');
    }
    // A booking is either slab-based or custom — never both, never neither.
    if (!hourly.slabId && !hourly.isCustomDuration) {
      throw new ApiError(400, 'Hourly: pick a slab or enable custom duration');
    }
    if (hourly.slabId && hourly.isCustomDuration) {
      throw new ApiError(400, 'Hourly: slabId and isCustomDuration cannot both be set');
    }
  }
  if (serviceType === SERVICE_TYPES.OUTSTATION) {
    if (!outstation?.destinationAddress?.trim()) {
      throw new ApiError(400, 'Outstation: destinationAddress is required');
    }
    if (!outstation?.startDate || !outstation?.endDate) {
      throw new ApiError(400, 'Outstation: startDate and endDate are required');
    }
    if (!outstation?.days || outstation.days < 1) {
      throw new ApiError(400, 'Outstation: days must be ≥ 1');
    }
  }
}

function shapePlace(place) {
  return {
    address: place.address.trim(),
    city: place.city?.trim() || '',
    location: {
      type: 'Point',
      coordinates: [place.location.coordinates[0], place.location.coordinates[1]],
    },
  };
}

export async function createBookingService(userId, body) {
  validateCreateInput(body);

  // Bail out early — one active booking per user at a time.
  const existing = await getActiveBookingForUserService(userId);
  if (existing) return { booking: existing, reused: true };

  const { serviceType, bookingType, carId, pickup, dropoff, hourly, outstation } = body;

  // Re-compute fare server-side. Client-supplied totals are never trusted.
  const estimate = await estimateFareService({
    serviceType,
    userId,
    slabId: hourly?.slabId || undefined,
    bookedHours: hourly?.durationHours,
    scheduledAt: hourly?.scheduledStartAt || outstation?.startDate,
    days: outstation?.days,
    actualKm: outstation?.estimatedKm || 0,
    stayProvided: outstation?.needsStay ?? true,
    foodProvided: outstation?.needsFood ?? true,
  });
  const fareSnapshot = buildFareSnapshot(estimate);
  if (!fareSnapshot.total || fareSnapshot.total <= 0) {
    throw new ApiError(500, 'Fare engine returned a zero total. Check pricing configuration.');
  }

  const booking = await Booking.create({
    bookingNumber: generateBookingNumber(),
    userId,
    carId,
    serviceType,
    bookingType,
    pickup: shapePlace(pickup),
    dropoff: dropoff ? shapePlace(dropoff) : null,
    hourly:
      serviceType === SERVICE_TYPES.HOURLY
        ? {
            scheduledStartAt: new Date(hourly.scheduledStartAt),
            durationHours: hourly.durationHours,
            slabId: estimate.selectedSlab?._id || null,
            isCustomDuration: !!hourly.isCustomDuration,
          }
        : null,
    outstation:
      serviceType === SERVICE_TYPES.OUTSTATION
        ? {
            destinationAddress: outstation.destinationAddress.trim(),
            startDate: new Date(outstation.startDate),
            endDate: new Date(outstation.endDate),
            days: outstation.days,
            nights: outstation.nights || Math.max(0, outstation.days - 1),
            needsStay: outstation.needsStay ?? true,
            needsFood: outstation.needsFood ?? true,
            estimatedKm: outstation.estimatedKm || 0,
          }
        : null,
    fareSnapshot,
    // Default payment-mode is post_ride until a driver accepts; the
    // dispatch service then flips it to pre_ride + AWAITING_PAYMENT.
    paymentMode: PAYMENT_MODE.POST_RIDE,
    paymentStatus: BOOKING_PAYMENT_STATUS.NOT_DUE_YET,
    status: BOOKING_STATUS.SEARCHING,
  });

  return { booking: booking.toObject(), reused: false };
}

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

export async function cancelBookingByUserService(userId, bookingId, reason = '') {
  const booking = await Booking.findOne({ _id: bookingId, userId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    throw new ApiError(400, 'This booking is no longer cancellable');
  }
  // Cancellation fee = admin-configured percentage of whatever was paid.
  // Same formula applies pre- and post-STARTED — the `tripStarted` flag
  // here is only used for the UI copy ("trip in progress" wording).
  const policy = await loadCancellationPolicy(booking.serviceType);
  const { feeCharged, refundAmount, tripStarted } = computeUserCancellation(
    booking,
    policy,
  );

  const previouslyAssignedDriver = booking.driverId;
  const wasPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancellation = {
    reason:
      reason ||
      (tripStarted ? 'cancelled_by_user_after_start' : 'cancelled_by_user'),
    cancelledBy: 'user',
    feeCharged,
    refundAmount,
  };
  booking.timeline.cancelledAt = new Date();
  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;
  await booking.save();

  // Stop any pay-deadline timer and release the assigned driver so the
  // dispatcher can hand them a new offer immediately. Post-STARTED
  // cancels also free the driver — they're done with this trip even
  // though they collected a (penalised) fare share elsewhere.
  cancelPaymentTimeout(bookingId);
  await releaseDriverFromBooking(previouslyAssignedDriver);

  // Record the refund request if the user actually paid. The Razorpay
  // refund itself is moved manually by an admin — we only persist the
  // ledger entry here so it shows up on the admin Refunds page.
  // `paymentStatus` stays `PAID` until the admin confirms the refund;
  // we don't fake a `REFUNDED` state when the money hasn't moved yet.
  let refundRecord = null;
  if (wasPaid && refundAmount > 0) {
    refundRecord = await issueBookingRefundService(booking, {
      initiatedBy: REFUND_INITIATED_BY.USER,
      reason: booking.cancellation.reason,
      breakdown: {
        amountRupees: refundAmount,
        cancellationFeeRupees: feeCharged,
        grossPaidRupees: Number(booking.payment?.amountPaidRupees) || 0,
      },
    });
  }

  // Broadcast so the driver page can clear itself in real-time and the
  // admin dashboard sees the cancellation immediately.
  const payload = {
    bookingId: String(booking._id),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    cancellation: booking.cancellation?.toObject?.() || booking.cancellation,
    timeline: booking.timeline?.toObject?.() || booking.timeline,
    refund: refundRecord
      ? {
          status: refundRecord.status,
          amountRupees: refundRecord.amountRupees,
          cancellationFeeRupees: refundRecord.cancellationFeeRupees,
        }
      : null,
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, payload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, payload);
  if (previouslyAssignedDriver) {
    emitToDriver(previouslyAssignedDriver, S2C_EVENTS.BOOKING_UPDATED, payload);
  }
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, payload);

  return booking.toObject();
}

export async function adminMarkNoDriversFoundService(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const wasPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;

  // When no driver was found (typical after a driver bailed mid-flight),
  // we don't apply a cancellation fee — the customer didn't choose to
  // cancel. Full refund of whatever they paid.
  const refundAmount = wasPaid
    ? Math.max(0, Math.round((Number(booking.payment?.amountPaidRupees) || 0) * 100) / 100)
    : 0;

  booking.status = BOOKING_STATUS.NO_DRIVERS_FOUND;
  booking.timeline.cancelledAt = new Date();
  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;
  booking.cancellation = {
    reason: 'no_drivers_available',
    cancelledBy: 'system',
    feeCharged: 0,
    refundAmount,
  };
  await booking.save();

  // Record a refund request for the admin to process manually on
  // Razorpay. No cancellation fee — the customer didn't bail.
  if (wasPaid && refundAmount > 0) {
    await issueBookingRefundService(booking, {
      initiatedBy: REFUND_INITIATED_BY.SYSTEM,
      reason: 'no_drivers_available',
      breakdown: {
        amountRupees: refundAmount,
        cancellationFeeRupees: 0,
        grossPaidRupees: refundAmount,
      },
    });
  }

  return booking.toObject();
}

/* ------------------------------------------------------------------ */
/* (Legacy payment-mode + abort-prepay flows removed)                  */
/*                                                                     */
/* The booking now flips to AWAITING_PAYMENT directly in               */
/* `acceptBookingService`. There is no pay-later option and no         */
/* prepay-discount window; the user pays the full fare upfront via the */
/* /pay endpoint or cancels.                                           */
/* ------------------------------------------------------------------ */
