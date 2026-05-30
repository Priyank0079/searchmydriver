import Booking, { BOOKING_PAYMENT_METHOD } from '../models/booking.model.js';
import { ApiError } from '../utils/apiError.js';
import { generateBookingNumber } from '../utils/orderNumber.util.js';
import { estimateFareService } from './pricing.service.js';
import {
  cancelPaymentTimeout,
  releaseDriverFromBooking,
} from './bookingPaymentTimeout.service.js';
import {
  cancelNoShowSchedule,
  resumeNoShowScheduleIfNeeded,
} from './bookingNoShowTimeout.service.js';
import {
  loadCancellationPolicy,
  computeUserCancellation,
  computeDriverCancellation,
  evaluateDriverCancelChance,
} from './bookingCancellation.service.js';
import {
  issueBookingRefundService,
  REFUND_INITIATED_BY,
} from './refund.service.js';
import {
  debitWalletService,
  creditWalletService,
} from './wallet.service.js';
import { WALLET_TXN_SOURCE } from '../models/walletTransaction.model.js';
import {
  recordPlatformRevenue,
  PLATFORM_REVENUE_SOURCE,
} from './platformRevenue.service.js';
import { Driver } from '../models/driverModels/driver.model.js';
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
 * Compute the amount the driver will receive for a booking, from a
 * persisted `fareSnapshot`. We prefer the breakdown value (which was
 * derived at booking-creation time so it matches what the customer paid)
 * and fall back to `total − total × commission%` if the breakdown is
 * missing (older bookings created before the breakdown was retained).
 */
export function driverEarningFromFareSnapshot(fareSnapshot) {
  if (!fareSnapshot) return 0;
  const bd = fareSnapshot.breakdown || {};
  if (typeof bd.driverEarning === 'number') return round2(bd.driverEarning);
  const total = Number(fareSnapshot.total) || 0;
  const commissionPct = Number(bd.platformCommissionPercent) || 0;
  if (commissionPct > 0 && total > 0) {
    return round2(total - (total * commissionPct) / 100);
  }
  return round2(total);
}

/**
 * Strip fields the driver is not allowed to see and rewrite the fare
 * block so the driver only ever sees their own earning — never the
 * customer's gross total or the commission cut. The mutation is on a
 * `.lean()` POJO so it's safe and cheap.
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
  // running balance — those are user-side concerns.
  if ('paymentMode' in obj) delete obj.paymentMode;
  if ('paymentStatus' in obj) delete obj.paymentStatus;
  if ('payment' in obj) delete obj.payment;
  if ('razorpay' in obj) delete obj.razorpay;

  // Replace the customer-facing fare snapshot with a driver-safe view
  // that only shows the driver's earning (= total − platform commission).
  if (obj.fareSnapshot) {
    const driverEarning = driverEarningFromFareSnapshot(obj.fareSnapshot);
    obj.fareSnapshot = {
      pricingId: obj.fareSnapshot.pricingId || null,
      driverEarning,
      currency: 'INR',
    };
  }
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
async function attachCancellationPreview(booking, side, { driverId } = {}) {
  if (!booking) return booking;
  try {
    const policy = await loadCancellationPolicy(booking.serviceType);
    if (side === 'driver') {
      // Surface the live grace+chance snapshot so the FE confirm dialog
      // can say "Free cancel — 2 chances left today" (or warn the
      // driver before they commit). Best-effort: a missing driver
      // record falls back to a chance-empty preview which the FE renders
      // as the full-penalty case.
      let chance = null;
      if (driverId) {
        const driverSnap = await Driver.findById(driverId)
          .select('cancellationChances')
          .lean();
        chance = evaluateDriverCancelChance(driverSnap, booking, policy);
      }
      booking.cancellationPreview = {
        side: 'driver',
        ...computeDriverCancellation(booking, policy, chance),
        chance,
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

/**
 * Fields the user-side views need on the assigned driver: identity,
 * rating, contact, and the "should I be reassured?" facts (experience
 * + vehicle expertise). Centralised so every populate call agrees.
 */
const DRIVER_USER_FIELDS = [
  'name',
  'phone_no',
  'rating',
  'profilePicture',
  'experienceYears',
  'vehicleExperience',
  'carTypeExperience',
].join(' ');

const DRIVER_USER_FIELDS_WITH_LOC = `${DRIVER_USER_FIELDS} location`;

/** Fields the driver-side views need on the customer. */
const CUSTOMER_DRIVER_FIELDS = 'name phone_no profilePicture';

export async function getActiveBookingForUserService(userId) {
  if (!userId) return null;
  const booking = await Booking.findOne({
    userId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    isDeleted: false,
  })
    .populate('driverId', DRIVER_USER_FIELDS)
    .lean();
  // Cold-start safety: if the server restarted while a booking was
  // sitting at ARRIVED, the in-process no-show timer got dropped.
  // Re-attach it here so the prompt + auto-complete cycle never goes
  // missing for an active customer fetch.
  resumeNoShowScheduleIfNeeded(booking).catch(() => {});
  return attachCancellationPreview(booking, 'user');
}

export async function getBookingByIdService(bookingId, { userId, driverId } = {}) {
  const filter = { _id: bookingId, isDeleted: false };
  if (userId) filter.userId = userId;
  if (driverId) filter.driverId = driverId;
  const booking = await Booking.findOne(filter)
    .populate('driverId', DRIVER_USER_FIELDS_WITH_LOC)
    .populate('userId', CUSTOMER_DRIVER_FIELDS)
    .lean();
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (driverId) {
    return attachCancellationPreview(
      sanitizeBookingForDriver(booking),
      'driver',
      { driverId },
    );
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
    .populate('userId', CUSTOMER_DRIVER_FIELDS)
    .lean();
  resumeNoShowScheduleIfNeeded(booking).catch(() => {});
  return attachCancellationPreview(
    sanitizeBookingForDriver(booking),
    'driver',
    { driverId },
  );
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
  // Hourly bookings can now opt out of food / accommodation when their
  // duration crosses the configured threshold (see pricing.service.js).
  const estimate = await estimateFareService({
    serviceType,
    userId,
    slabId: hourly?.slabId || undefined,
    bookedHours: hourly?.durationHours,
    scheduledAt: hourly?.scheduledStartAt || outstation?.startDate,
    days: outstation?.days,
    actualKm: outstation?.estimatedKm || 0,
    stayProvided:
      serviceType === SERVICE_TYPES.OUTSTATION
        ? (outstation?.needsStay ?? true)
        : (hourly?.stayProvided ?? true),
    foodProvided:
      serviceType === SERVICE_TYPES.OUTSTATION
        ? (outstation?.needsFood ?? true)
        : (hourly?.foodProvided ?? true),
  });
  const fareSnapshot = buildFareSnapshot(estimate);
  if (!fareSnapshot.total || fareSnapshot.total <= 0) {
    throw new ApiError(500, 'Fare engine returned a zero total. Check pricing configuration.');
  }

  const bookingNumber = generateBookingNumber();

  // Pay-then-search: atomically debit the wallet BEFORE creating the
  // booking. If the user is short the helper throws ApiError(402, ...)
  // with `{ requiredAmount, walletBalance, shortBy }` in `err.data` so
  // the FE can deep-link the user to the right top-up amount.
  const walletTx = await debitWalletService({
    userId,
    amount: fareSnapshot.total,
    source: WALLET_TXN_SOURCE.BOOKING_PAYMENT,
    description: `Booking ${bookingNumber} \u2014 ${serviceType}`,
    refType: 'Booking',
    refId: bookingNumber, // _id isn't known yet; we patch refId below.
  });

  let booking;
  try {
    booking = await Booking.create({
      bookingNumber,
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
      // Booking is already paid up-front via the wallet. Skip the
      // legacy AWAITING_PAYMENT detour entirely — the dispatcher's
      // `alreadyPaid` branch in acceptBookingService keeps the new
      // driver on a clean DRIVER_ASSIGNED transition.
      paymentMode: PAYMENT_MODE.PRE_RIDE,
      paymentMethod: BOOKING_PAYMENT_METHOD.WALLET,
      paymentStatus: BOOKING_PAYMENT_STATUS.PAID,
      payment: {
        amountPaidRupees: fareSnapshot.total,
        attempts: 0,
        walletTxId: walletTx._id,
      },
      timeline: {
        createdAt: new Date(),
        paymentReceivedAt: new Date(),
      },
      status: BOOKING_STATUS.SEARCHING,
    });
  } catch (err) {
    // Compensating credit if booking creation fails after we've already
    // debited the wallet — we never want money silently stuck in the
    // ledger without a booking to back it up.
    try {
      await creditWalletService({
        userId,
        amount: fareSnapshot.total,
        source: WALLET_TXN_SOURCE.BOOKING_REFUND,
        description: `Refund \u2014 booking ${bookingNumber} failed to create`,
        refType: 'Booking',
        refId: bookingNumber,
      });
    } catch (refundErr) {
      console.error(
        '[booking] CRITICAL: failed to credit wallet after booking-create rollback:',
        refundErr,
      );
    }
    throw err;
  }

  // Backfill the refId on the wallet txn now that we know the booking id.
  try {
    walletTx.refId = String(booking._id);
    await walletTx.save();
  } catch (linkErr) {
    console.warn('[booking] failed to link wallet txn to booking:', linkErr?.message);
  }

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
  // Cancellation fee = admin-configured (flat ₹ or % of paid). The fee
  // is then split into a driver share + company share per the
  // `driverSharePercent` knob on the same policy.
  const policy = await loadCancellationPolicy(booking.serviceType);
  const {
    feeCharged,
    refundAmount,
    driverShare,
    companyShare,
    tripStarted,
  } = computeUserCancellation(booking, policy);

  const previouslyAssignedDriver = booking.driverId;
  const wasPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;
  const paidViaWallet = booking.paymentMethod === BOOKING_PAYMENT_METHOD.WALLET;

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancellation = {
    reason:
      reason ||
      (tripStarted ? 'cancelled_by_user_after_start' : 'cancelled_by_user'),
    cancelledBy: 'user',
    feeCharged,
    refundAmount,
    driverShare,
    companyShare,
  };
  booking.timeline.cancelledAt = new Date();
  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;

  // Wallet-paid bookings refund instantly into the wallet — no admin
  // intervention needed. Razorpay-paid (legacy) bookings continue to
  // write a Refund ledger entry for the admin to process by hand.
  if (wasPaid && paidViaWallet && refundAmount > 0) {
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.REFUNDED;
  }
  await booking.save();

  // Stop any pay-deadline timer and release the assigned driver so the
  // dispatcher can hand them a new offer immediately. Post-STARTED
  // cancels also free the driver — they're done with this trip even
  // though they collected a (penalised) fare share elsewhere.
  cancelPaymentTimeout(bookingId);
  cancelNoShowSchedule(bookingId);
  await releaseDriverFromBooking(previouslyAssignedDriver);

  let refundRecord = null;
  if (wasPaid && refundAmount > 0) {
    if (paidViaWallet) {
      // Credit the wallet right now (atomic + ledgered).
      try {
        await creditWalletService({
          userId: booking.userId,
          amount: refundAmount,
          source: WALLET_TXN_SOURCE.BOOKING_REFUND,
          description: `Refund \u2014 booking ${booking.bookingNumber} cancelled (fee \u20B9${feeCharged})`,
          refType: 'Booking',
          refId: String(booking._id),
        });
      } catch (refundErr) {
        console.error(
          '[booking] failed to credit wallet refund for booking',
          String(booking._id),
          refundErr?.message,
        );
      }
    } else {
      // Legacy Razorpay path — admin processes manually.
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
  }

  // Distribute the cancellation fee: the driver who was mobilised gets
  // `driverShare` straight into their wallet, the platform books
  // `companyShare` as revenue. Both writes are best-effort — a failure
  // here logs but does not roll back the cancellation itself.
  if (feeCharged > 0) {
    if (previouslyAssignedDriver && driverShare > 0) {
      try {
        await Driver.updateOne(
          { _id: previouslyAssignedDriver },
          {
            $inc: {
              'wallet.balance': driverShare,
              'wallet.totalEarnings': driverShare,
            },
          },
        );
      } catch (driverCreditErr) {
        console.error(
          '[booking] failed to credit driver wallet for cancellation share',
          String(booking._id),
          driverCreditErr?.message,
        );
      }
    }
    if (companyShare > 0) {
      try {
        await recordPlatformRevenue({
          source: PLATFORM_REVENUE_SOURCE.CANCELLATION_FEE,
          amountRupees: companyShare,
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber || '',
          serviceType: booking.serviceType || '',
          userId: booking.userId,
          driverId: previouslyAssignedDriver || null,
          meta: {
            feeCharged,
            driverShare,
            companyShare,
            arrivedFeeType: policy?.arrivedFeeType || 'flat',
            arrivedFeeAmount: policy?.arrivedFeeAmount || 0,
            driverSharePercent: policy?.driverSharePercent || 0,
            cancelledAtStatus: booking.cancellation?.reason || '',
          },
        });
      } catch (revenueErr) {
        console.error(
          '[booking] failed to log platform revenue for cancellation',
          String(booking._id),
          revenueErr?.message,
        );
      }
    }
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
  const paidViaWallet = booking.paymentMethod === BOOKING_PAYMENT_METHOD.WALLET;

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
  if (wasPaid && paidViaWallet && refundAmount > 0) {
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.REFUNDED;
  }
  await booking.save();

  if (wasPaid && refundAmount > 0) {
    if (paidViaWallet) {
      try {
        await creditWalletService({
          userId: booking.userId,
          amount: refundAmount,
          source: WALLET_TXN_SOURCE.BOOKING_NO_DRIVERS_REFUND,
          description: `Refund \u2014 no drivers available for ${booking.bookingNumber}`,
          refType: 'Booking',
          refId: String(booking._id),
        });
      } catch (refundErr) {
        console.error(
          '[booking] failed to credit wallet for no-drivers refund',
          String(booking._id),
          refundErr?.message,
        );
      }
    } else {
      // Legacy Razorpay refund — recorded for admin to process by hand.
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
