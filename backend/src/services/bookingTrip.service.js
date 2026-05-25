import Booking from '../models/booking.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  PAYMENT_MODE,
  BOOKING_PAYMENT_STATUS,
  PAYMENT_POLICY,
  DISPATCH,
  DISPATCH_RESPONSE,
} from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToBooking,
  emitToAdmins,
  emitToDriver,
} from '../utils/socketEmitters.js';
import { cancelPaymentTimeout } from './bookingPaymentTimeout.service.js';
import {
  loadCancellationPolicy,
  computeDriverCancellation,
  computeUserCancellation,
} from './bookingCancellation.service.js';
import {
  issueBookingRefundService,
  REFUND_INITIATED_BY,
} from './refund.service.js';
import { dispatchNextDriverService } from './bookingDispatch.service.js';

/**
 * Generate a numeric OTP of the configured length. We zero-pad so codes that
 * happen to start with a 0 still render as N digits on the client (e.g.
 * "0381" not "381" — important for a fixed-width PIN input).
 */
function generateRideOtp() {
  const len = PAYMENT_POLICY.RIDE_OTP_LENGTH;
  const max = 10 ** len;
  const n = Math.floor(Math.random() * max);
  return String(n).padStart(len, '0');
}

/**
 * Trip-execution state transitions.
 *
 * Owns every status change that happens AFTER the dispatcher has paired a
 * driver with a booking. Splitting this from `booking.service.js` keeps the
 * dispatching concerns (wave search, offer/accept/reject) cleanly apart from
 * the trip-lifecycle concerns (heading to pickup → arrived → started →
 * completed → cancelled-by-driver).
 *
 * State diagram (this file's responsibility):
 *
 *   driver_assigned ─┐
 *                    ├─► en_route ─► arrived ─► started ─► completed
 *   (after payment)  │                                          │
 *                    │                                          ▼
 *                    └─► cancelled_by_driver  (allowed until ARRIVED)
 *
 * Every successful transition broadcasts `BOOKING_UPDATED` on the user, the
 * booking room, the driver and admins — the same fan-out shape the rest of
 * the lifecycle uses, so frontend consumers don't need to special-case any
 * event.
 */

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const STATUSES_DRIVER_CAN_CANCEL = Object.freeze([
  BOOKING_STATUS.DRIVER_ASSIGNED,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ARRIVED,
  // STARTED is allowed too — the driver pays the admin-configured
  // penalty (see computeDriverCancellation) instead of being blocked.
  BOOKING_STATUS.STARTED,
]);

/**
 * Look up the booking that belongs to `driverId` and verify the driver is
 * authorised to act on it. The same guard is used by every transition below.
 */
async function loadDriverBooking(driverId, bookingId) {
  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!booking.driverId || String(booking.driverId) !== String(driverId)) {
    throw new ApiError(403, 'You are not assigned to this booking');
  }
  return booking;
}

/**
 * Build the patch we broadcast on every transition.
 *
 * We deliberately keep this payload narrow: a UI consumer only needs to
 * know "what changed" — the full booking can always be refetched. The
 * shape mirrors what `applyUpdate` in the user/driver active-booking
 * stores already merges, so no client-side changes are needed when we
 * add new transitions.
 *
 * A payload is requested per-audience:
 *   - 'user'    → includes the OTP code (the customer reads it out to the
 *                 driver).
 *   - 'driver'  → strips the OTP code and substitutes `otpRequired: true`.
 *                 We never trust the driver app with the code itself.
 *   - 'room'    → same as driver (admins watching the booking shouldn't
 *                 leak the OTP to anyone tailing the room).
 */
function buildUpdatePayload(booking, audience = 'room') {
  const base = {
    bookingId: String(booking._id),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMode: booking.paymentMode,
    driverId: booking.driverId ? String(booking.driverId) : null,
    timeline: booking.timeline ? booking.timeline.toObject?.() || booking.timeline : null,
    cancellation: booking.cancellation
      ? booking.cancellation.toObject?.() || booking.cancellation
      : null,
  };

  if (booking.rideStartOtp?.code) {
    if (audience === 'user') {
      base.rideStartOtp = {
        code: booking.rideStartOtp.code,
        generatedAt: booking.rideStartOtp.generatedAt,
        verifiedAt: booking.rideStartOtp.verifiedAt,
      };
    } else {
      base.otpRequired = !booking.rideStartOtp.verifiedAt;
    }
  }
  return base;
}

function broadcastUpdate(booking) {
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, buildUpdatePayload(booking, 'user'));
  if (booking.driverId) {
    emitToDriver(
      booking.driverId,
      S2C_EVENTS.BOOKING_UPDATED,
      buildUpdatePayload(booking, 'driver'),
    );
  }
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, buildUpdatePayload(booking, 'room'));
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, buildUpdatePayload(booking, 'room'));
}

/**
 * Enforce a small whitelist of allowed source statuses for a transition.
 * Throws a 409 (conflict) so the client knows this was a stale action
 * rather than a permission issue.
 */
function assertStatus(booking, allowed, label) {
  if (!allowed.includes(booking.status)) {
    throw new ApiError(
      409,
      `Cannot ${label} while booking is "${booking.status}"`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/**
 * driver_assigned → en_route
 *
 * Driver tells us "I've started heading to the pickup". We block this
 * transition while a pre-pay booking is still `awaiting_payment` — there's
 * no point driving to a pickup the customer hasn't paid for yet.
 */
export async function markDriverEnRouteService(driverId, bookingId) {
  const booking = await loadDriverBooking(driverId, bookingId);
  assertStatus(booking, [BOOKING_STATUS.DRIVER_ASSIGNED], 'start the trip');

  if (
    booking.paymentMode === PAYMENT_MODE.PRE_RIDE &&
    booking.paymentStatus !== BOOKING_PAYMENT_STATUS.PAID
  ) {
    throw new ApiError(
      409,
      'Customer has chosen Pay Now but has not paid yet — wait for confirmation',
    );
  }

  booking.status = BOOKING_STATUS.EN_ROUTE;
  booking.timeline.enRouteAt = new Date();
  await booking.save();

  broadcastUpdate(booking);
  return booking.toObject();
}

/**
 * en_route → arrived
 *
 * Generates a fresh ride-start OTP at the same time and emits it to the user
 * only. The driver simultaneously receives `otpRequired: true` so their UI
 * swaps the Start CTA for an OTP input. Regenerating on every arrival means
 * a flaky network won't leave a stale code lying around.
 */
export async function markDriverArrivedService(driverId, bookingId) {
  const booking = await loadDriverBooking(driverId, bookingId);
  assertStatus(booking, [BOOKING_STATUS.EN_ROUTE], 'mark arrival');

  booking.status = BOOKING_STATUS.ARRIVED;
  booking.timeline.arrivedAt = new Date();
  booking.rideStartOtp = {
    code: generateRideOtp(),
    generatedAt: new Date(),
    verifiedAt: null,
    attempts: 0,
  };
  await booking.save();

  broadcastUpdate(booking);
  return booking.toObject();
}

/**
 * arrived → started
 *
 * Customer reads out the OTP they were shown when the driver hit Arrived;
 * the driver types it back. We bail (without changing the status) if the
 * code doesn't match. After RIDE_OTP_MAX_ATTEMPTS we still allow further
 * attempts but flag the booking so admins can intervene — the booking
 * itself is never auto-cancelled by OTP failures.
 */
export async function startTripService(driverId, bookingId, { otp } = {}) {
  const booking = await loadDriverBooking(driverId, bookingId);
  assertStatus(booking, [BOOKING_STATUS.ARRIVED], 'start the ride');

  const expected = booking.rideStartOtp?.code;
  if (!expected) {
    throw new ApiError(
      409,
      'No start OTP has been generated yet — mark arrival first',
    );
  }

  const submitted = String(otp || '').trim();
  if (!submitted) {
    throw new ApiError(400, 'OTP is required to start the ride');
  }
  if (submitted !== String(expected)) {
    booking.rideStartOtp.attempts = (booking.rideStartOtp.attempts || 0) + 1;
    await booking.save();
    const tooMany =
      booking.rideStartOtp.attempts >= PAYMENT_POLICY.RIDE_OTP_MAX_ATTEMPTS;
    throw new ApiError(
      400,
      tooMany
        ? 'OTP entered incorrectly too many times — please confirm with the customer'
        : 'Incorrect OTP',
    );
  }

  booking.status = BOOKING_STATUS.STARTED;
  booking.timeline.startedAt = new Date();
  booking.rideStartOtp.verifiedAt = new Date();
  await booking.save();

  broadcastUpdate(booking);
  return booking.toObject();
}

/**
 * started → completed
 *
 * Ride is done. Also flips the driver's `isOnTrip` flag so the next
 * dispatch wave can offer them new work, and bumps a `pay-after-ride`
 * booking's payment status to `pending` so the user app knows to surface
 * the post-ride payment flow.
 */
export async function completeTripService(driverId, bookingId) {
  const booking = await loadDriverBooking(driverId, bookingId);
  assertStatus(booking, [BOOKING_STATUS.STARTED], 'complete the ride');

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.timeline.completedAt = new Date();

  // Post-pay bookings move from `not_due_yet` → `pending` so the user app
  // knows to surface a "pay now" screen. Pre-pay bookings were already
  // paid before EN_ROUTE.
  if (
    booking.paymentMode === PAYMENT_MODE.POST_RIDE &&
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.NOT_DUE_YET
  ) {
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.PENDING;
  }

  await booking.save();

  // Free the driver up for new offers. Failure here is non-fatal — admins
  // can clear stale isOnTrip flags from the admin panel if needed.
  if (booking.driverId) {
    Driver.updateOne({ _id: booking.driverId }, { $set: { isOnTrip: false } }).catch((err) =>
      console.warn('[bookingTrip] failed to clear driver.isOnTrip:', err?.message),
    );
  }

  broadcastUpdate(booking);
  return booking.toObject();
}

/* ------------------------------------------------------------------ */
/* Driver-cancel helpers (re-dispatch vs. terminate)                    */
/* ------------------------------------------------------------------ */

/**
 * Debit the driver's wallet for a cancellation penalty. Non-fatal — we
 * log instead of throwing so the booking transition itself never wedges
 * on a wallet write.
 */
async function applyDriverPenalty(driverId, penaltyRupees) {
  if (!penaltyRupees || penaltyRupees <= 0) return;
  try {
    await Driver.updateOne(
      { _id: driverId },
      { $inc: { 'wallet.balance': -penaltyRupees } },
    );
  } catch (err) {
    console.warn(
      '[bookingTrip] failed to debit driver wallet on cancel:',
      err?.message,
    );
  }
}

/**
 * Re-dispatch path: the driver bailed on a paid pre-STARTED booking. We
 * keep the payment intact and put the booking back on the dispatcher
 * (SEARCHING) so the next available driver picks it up without the
 * customer having to repay. Driver penalty is applied here too.
 *
 * If the dispatcher can't find anyone in the next wave,
 * `dispatchNextDriverService` will eventually call
 * `adminMarkNoDriversFoundService`, which fires the refund.
 */
async function redispatchAfterDriverCancel(booking, driverId, policy) {
  const { driverPenalty } = computeDriverCancellation(booking, policy);

  // Stamp this driver's cancellation onto the dispatch history so the
  // admin/dispatch audit shows why we're searching again. We reuse the
  // existing offers schema (response = CANCELLED on the driver row).
  if (booking.dispatch) {
    const offer = booking.dispatch.offers?.find(
      (o) => String(o.driverId) === String(driverId),
    );
    if (offer) {
      offer.response = DISPATCH_RESPONSE.CANCELLED;
      offer.respondedAt = new Date();
    }
    booking.dispatch.pendingOfferIds = [];
    booking.dispatch.currentExpiresAt = null;
    // Reset radius / attempts so the new search starts fresh from the
    // configured starting radius — the customer shouldn't inherit an
    // already-fully-expanded wave from the cancelling driver's offer.
    booking.dispatch.currentRadiusMeters = DISPATCH.SEARCH_RADIUS_START_METERS;
    booking.dispatch.attemptsCount = 0;
  }

  booking.status = BOOKING_STATUS.SEARCHING;
  booking.driverId = null;
  booking.timeline.driverAssignedAt = null;
  booking.timeline.paymentDeadlineAt = null;
  // Record the previous driver's cancellation. We don't terminate the
  // booking so `cancellation` stays for the FE to surface a popup; it
  // gets cleared the moment a new driver accepts.
  booking.cancellation = {
    reason: 'driver_cancelled_reassigning',
    cancelledBy: 'driver',
    feeCharged: driverPenalty,
    refundAmount: 0,
  };

  await booking.save();

  // Kill the Pay Now timer (irrelevant now — booking is back in
  // SEARCHING and the payment is already locked in).
  cancelPaymentTimeout(booking._id);

  await applyDriverPenalty(driverId, driverPenalty);

  // Free the cancelling driver so the dispatcher can hand them their
  // next offer, then start a fresh dispatch wave.
  Driver.updateOne({ _id: driverId }, { $set: { isOnTrip: false } }).catch((err) =>
    console.warn(
      '[bookingTrip] failed to clear driver.isOnTrip on re-dispatch:',
      err?.message,
    ),
  );

  // Tell the user app to surface the "driver cancelled — searching
  // again" popup, and broadcast the new SEARCHING state to everyone.
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_DRIVER_REASSIGNING, {
    bookingId: String(booking._id),
    reason: 'driver_cancelled',
  });
  broadcastUpdate(booking);

  // Kick off a fresh dispatch wave. Errors here are non-fatal — the
  // dispatch service has its own retry path and ultimately calls
  // adminMarkNoDriversFoundService (which issues a refund).
  dispatchNextDriverService(booking._id).catch((err) =>
    console.warn(
      '[bookingTrip] redispatch failed for booking',
      String(booking._id),
      ':',
      err?.message,
    ),
  );

  return booking.toObject();
}

/**
 * Terminal cancellation: the booking is fully closed (status =
 * CANCELLED). Issues a refund (minus retained service charge) if the
 * user had already paid, debits the driver penalty, and broadcasts the
 * cancellation patch.
 */
async function terminateBookingByDriver(
  booking,
  driverId,
  policy,
  { reason, tripStarted },
) {
  const {
    driverPenalty,
    refundAmount,
  } = computeDriverCancellation(booking, policy);

  // Re-use the user-side breakdown for the refund ledger so the
  // cancellation fee field on the Refund document matches the customer
  // copy on the FE.
  const userBreakdown = computeUserCancellation(booking, policy);

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancellation = {
    reason:
      reason ||
      (tripStarted ? 'cancelled_by_driver_after_start' : 'cancelled_by_driver'),
    cancelledBy: 'driver',
    feeCharged: driverPenalty,
    refundAmount,
  };
  booking.timeline.cancelledAt = new Date();
  if (booking.dispatch) {
    booking.dispatch.pendingOfferIds = [];
    booking.dispatch.currentExpiresAt = null;
  }
  await booking.save();

  cancelPaymentTimeout(booking._id);
  await applyDriverPenalty(driverId, driverPenalty);

  Driver.updateOne({ _id: driverId }, { $set: { isOnTrip: false } }).catch((err) =>
    console.warn(
      '[bookingTrip] failed to clear driver.isOnTrip on cancel:',
      err?.message,
    ),
  );

  // Record the refund request for whatever the user had paid. Status
  // stays `pending` until the admin processes it manually on Razorpay.
  let refundRecord = null;
  const wasPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;
  if (wasPaid && refundAmount > 0) {
    refundRecord = await issueBookingRefundService(booking, {
      initiatedBy: REFUND_INITIATED_BY.DRIVER,
      reason: booking.cancellation.reason,
      breakdown: {
        amountRupees: refundAmount,
        cancellationFeeRupees: userBreakdown.feeCharged,
        grossPaidRupees: Number(booking.payment?.amountPaidRupees) || 0,
      },
    });
  }

  const payload = {
    ...buildUpdatePayload(booking, 'user'),
    paymentStatus: booking.paymentStatus,
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
  if (booking.driverId) {
    emitToDriver(
      booking.driverId,
      S2C_EVENTS.BOOKING_UPDATED,
      buildUpdatePayload(booking, 'driver'),
    );
  }
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, payload);

  return booking.toObject();
}

/**
 * * → cancelled  (driver-initiated)
 *
 * Mirror of `cancelBookingByUserService` for the driver — but with a
 * twist when the user has already paid:
 *
 *   - PAID + pre-STARTED → re-dispatch the booking to another driver
 *                          (the customer doesn't have to repay).
 *                          Driver penalty is still applied.
 *   - PAID + STARTED     → terminate the booking. Refund =
 *                          paid − serviceCharge. Driver penalty applied.
 *   - UNPAID + any state → terminate. No refund (nothing was charged).
 *                          Driver penalty applied per policy.
 */
export async function cancelBookingByDriverService(driverId, bookingId, reason = '') {
  const booking = await loadDriverBooking(driverId, bookingId);

  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    throw new ApiError(400, 'This booking is no longer cancellable');
  }
  if (!STATUSES_DRIVER_CAN_CANCEL.includes(booking.status)) {
    throw new ApiError(
      400,
      'Trip is already in progress — please contact support to cancel',
    );
  }

  const policy = await loadCancellationPolicy(booking.serviceType);
  const tripStarted = booking.status === BOOKING_STATUS.STARTED;
  const wasPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;

  // Paid + pre-STARTED → re-dispatch so the customer's payment isn't
  // wasted on a driver who bailed. Mid-ride cancellations can't be
  // re-dispatched (the customer is in a car) so they terminate.
  if (wasPaid && !tripStarted) {
    return redispatchAfterDriverCancel(booking, driverId, policy);
  }

  return terminateBookingByDriver(booking, driverId, policy, {
    reason,
    tripStarted,
  });
}
