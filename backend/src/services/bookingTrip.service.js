import Booking from '../models/booking.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import ServicePricing from '../models/servicePricing.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  schedulePromptTimer,
  cancelNoShowSchedule,
} from './bookingNoShowTimeout.service.js';
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
  evaluateDriverCancelChance,
  todayKey,
} from './bookingCancellation.service.js';
import {
  issueBookingRefundService,
  REFUND_INITIATED_BY,
} from './refund.service.js';
import { dispatchNextDriverService } from './bookingDispatch.service.js';
import {
  recordPlatformRevenue,
  PLATFORM_REVENUE_SOURCE,
} from './platformRevenue.service.js';

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
 * Maximum distance (metres) between the driver's reported location and
 * the booking pickup at which we accept an "I have arrived" tap. Keeps
 * drivers honest — they can't flip the booking to ARRIVED from across
 * town to harvest the post-arrival cancellation fee. Tuned generously
 * enough to swallow GPS jitter on phones with a fix.
 */
export const ARRIVAL_PROXIMITY_METERS = 100;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance in metres between two `{ lat, lng }` points. Lives
 * here to keep the trip service self-contained — the FE has its own
 * mirror in `utils/geo.js`.
 */
function haversineMeters(a, b) {
  if (
    !a ||
    !b ||
    typeof a.lat !== 'number' ||
    typeof a.lng !== 'number' ||
    typeof b.lat !== 'number' ||
    typeof b.lng !== 'number'
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * en_route → arrived
 *
 * Generates a fresh ride-start OTP at the same time and emits it to the user
 * only. The driver simultaneously receives `otpRequired: true` so their UI
 * swaps the Start CTA for an OTP input. Regenerating on every arrival means
 * a flaky network won't leave a stale code lying around.
 *
 * Proximity guard: the driver must report a location within
 * `ARRIVAL_PROXIMITY_METERS` of the pickup. The FE also disables the
 * CTA outside the radius; this is the server-side enforcement so a
 * scripted request can't bypass it.
 */
export async function markDriverArrivedService(driverId, bookingId, { driverCoords } = {}) {
  const booking = await loadDriverBooking(driverId, bookingId);
  assertStatus(booking, [BOOKING_STATUS.EN_ROUTE], 'mark arrival');

  const pickupCoords = (() => {
    const c = booking.pickup?.location?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;
    return { lat: c[1], lng: c[0] };
  })();

  if (!pickupCoords) {
    throw new ApiError(500, 'Pickup coordinates missing from booking');
  }
  if (
    !driverCoords ||
    typeof driverCoords.lat !== 'number' ||
    typeof driverCoords.lng !== 'number'
  ) {
    throw new ApiError(
      400,
      'Driver location is required to mark arrival — enable location and try again',
    );
  }

  const distance = haversineMeters(driverCoords, pickupCoords);
  if (distance > ARRIVAL_PROXIMITY_METERS) {
    throw new ApiError(
      409,
      `You're too far from the pickup (${Math.round(distance)} m). Move within ${ARRIVAL_PROXIMITY_METERS} m to mark arrival.`,
      { distanceMeters: Math.round(distance), maxDistanceMeters: ARRIVAL_PROXIMITY_METERS },
    );
  }

  const arrivedAt = new Date();
  booking.status = BOOKING_STATUS.ARRIVED;
  booking.timeline.arrivedAt = arrivedAt;
  booking.rideStartOtp = {
    code: generateRideOtp(),
    generatedAt: arrivedAt,
    verifiedAt: null,
    attempts: 0,
  };
  // Reset any prior no-show state — every fresh ARRIVED transition
  // starts a clean window. (Possible if the booking was bounced
  // back via re-dispatch.)
  booking.noShow = {
    promptSentAt: null,
    promptDeadlineAt: null,
    customerResponse: '',
    respondedAt: null,
    firedFor: 0,
  };
  // Snapshot the active waiting-charge policy so the live driver UI
  // can render a "free wait 15:00 → ₹2/min after" ticker without
  // having to fetch pricing separately. The actual `chargeRupees`
  // stays 0 until Start; these knobs just communicate the policy.
  try {
    const pricing = await ServicePricing.findOne({
      serviceType: booking.serviceType,
      isActive: true,
    })
      .select('waitingCharge')
      .lean();
    booking.waiting = booking.waiting || {};
    Object.assign(booking.waiting, {
      waitedMinutes: 0,
      billableMinutes: 0,
      chargeRupees: 0,
      freeMinutes: Math.max(
        0,
        Number(pricing?.waitingCharge?.freeWaitingMinutes) || 0,
      ),
      perMinuteRupees: Math.max(
        0,
        Number(pricing?.waitingCharge?.chargePerMinute) || 0,
      ),
      noShow: false,
    });
  } catch (err) {
    console.warn(
      '[bookingTrip] waiting policy snapshot on arrival failed:',
      err?.message,
    );
  }
  await booking.save();

  // Kick off the "are you coming?" prompt schedule. Failure here is
  // non-fatal — the arrival itself is fine, the customer just won't
  // get the gentle nudge after 30 min.
  schedulePromptTimer(booking._id, arrivedAt).catch((err) =>
    console.warn('[bookingTrip] no-show schedule failed:', err?.message),
  );

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

  const startedAt = new Date();
  booking.status = BOOKING_STATUS.STARTED;
  booking.timeline.startedAt = startedAt;
  booking.rideStartOtp.verifiedAt = startedAt;

  // Compute the waiting charge accrued between ARRIVED → STARTED so
  // completion has the final number to add to the customer's bill.
  // Best-effort: a missing pricing config just leaves waiting at 0.
  await applyWaitingChargeOnStart(booking, startedAt);

  // Once the trip has actually started, no-show flow is no longer
  // relevant. Clear any pending prompt deadline so the scheduler
  // doesn't auto-complete a ride that's now in progress.
  cancelNoShowSchedule(booking._id);
  if (booking.noShow) {
    booking.noShow.promptDeadlineAt = null;
  }

  await booking.save();

  broadcastUpdate(booking);
  return booking.toObject();
}

/**
 * Snapshot the waiting charge onto `booking.waiting` based on how long
 * the driver waited at pickup. Uses the admin-configured
 * `waitingCharge.{freeWaitingMinutes, chargePerMinute}` policy.
 *
 * The math:
 *   waitedMinutes   = (startedAt − arrivedAt) in minutes
 *   billableMinutes = max(0, waitedMinutes − freeWaitingMinutes)
 *   chargeRupees    = billableMinutes × chargePerMinute
 *
 * The function is async because it has to look up the pricing doc;
 * the result is stamped on the booking POJO. Callers should `save()`
 * the booking afterwards.
 *
 * `flags.noShow` lets the no-show auto-complete path mark the row so
 * the audit knows this wait was unilateral.
 */
async function applyWaitingChargeOnStart(booking, startedAt, flags = {}) {
  const arrivedAt = booking.timeline?.arrivedAt;
  if (!arrivedAt) {
    booking.waiting = booking.waiting || {};
    Object.assign(booking.waiting, {
      waitedMinutes: 0,
      billableMinutes: 0,
      chargeRupees: 0,
      freeMinutes: 0,
      perMinuteRupees: 0,
      noShow: !!flags.noShow,
    });
    return;
  }
  let freeMinutes = 0;
  let perMinute = 0;
  try {
    const pricing = await ServicePricing.findOne({
      serviceType: booking.serviceType,
      isActive: true,
    }).lean();
    freeMinutes = Math.max(
      0,
      Number(pricing?.waitingCharge?.freeWaitingMinutes) || 0,
    );
    perMinute = Math.max(
      0,
      Number(pricing?.waitingCharge?.chargePerMinute) || 0,
    );
  } catch (err) {
    console.warn('[bookingTrip] waiting-charge pricing lookup failed:', err?.message);
  }

  const waitedMs = Math.max(0, startedAt.getTime() - new Date(arrivedAt).getTime());
  const waitedMinutes = Math.ceil(waitedMs / 60000);
  const billableMinutes = Math.max(0, waitedMinutes - freeMinutes);
  const chargeRupees = Math.round(billableMinutes * perMinute * 100) / 100;

  booking.waiting = booking.waiting || {};
  Object.assign(booking.waiting, {
    waitedMinutes,
    billableMinutes,
    chargeRupees,
    freeMinutes,
    perMinuteRupees: perMinute,
    noShow: !!flags.noShow,
  });
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

  // Book the platform's commission as revenue. Same fareSnapshot the
  // booking was created with — guaranteed in lockstep with what the
  // customer paid. Best-effort: a failure here logs but never wedges
  // trip completion.
  const commission = Number(booking.fareSnapshot?.breakdown?.platformCommission) || 0;
  if (commission > 0) {
    recordPlatformRevenue({
      source: PLATFORM_REVENUE_SOURCE.COMMISSION,
      amountRupees: commission,
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber || '',
      serviceType: booking.serviceType || '',
      userId: booking.userId,
      driverId: booking.driverId || null,
      meta: {
        commissionPercent:
          Number(booking.fareSnapshot?.breakdown?.platformCommissionPercent) || 0,
        driverEarning:
          Number(booking.fareSnapshot?.breakdown?.driverEarning) || 0,
        totalPayable:
          Number(booking.fareSnapshot?.breakdown?.totalPayable) || 0,
      },
    }).catch((err) =>
      console.warn(
        '[bookingTrip] failed to log commission revenue:',
        err?.message,
      ),
    );
  }

  broadcastUpdate(booking);
  return booking.toObject();
}

/* ------------------------------------------------------------------ */
/* Driver-cancel helpers (re-dispatch vs. terminate)                    */
/* ------------------------------------------------------------------ */

/**
 * Debit the driver's wallet for a cancellation penalty AND book the
 * same rupee as platform revenue. The penalty + revenue write are
 * paired so the platform-revenue ledger always matches the sum of
 * driver-wallet deductions — easy reconciliation for accounting.
 *
 * Non-fatal — we log instead of throwing so the booking transition
 * itself never wedges on a wallet write.
 *
 * `booking` is required (not just `bookingId`) so we can tag the
 * revenue row with the bookingNumber + serviceType, matching the
 * shape `recordPlatformRevenue` uses for the other revenue sources.
 */
async function applyDriverPenalty(driverId, penaltyRupees, booking) {
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
  // The full penalty goes to the platform. Best-effort: a failed
  // revenue write just means the audit lags — the wallet was already
  // debited, so we never want this to throw.
  if (booking?._id) {
    recordPlatformRevenue({
      source: PLATFORM_REVENUE_SOURCE.DRIVER_PENALTY,
      amountRupees: penaltyRupees,
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber || '',
      serviceType: booking.serviceType || '',
      userId: booking.userId || null,
      driverId,
      meta: {
        reason: booking.cancellation?.reason || 'cancelled_by_driver',
        status: booking.status || '',
      },
    }).catch((err) =>
      console.warn(
        '[bookingTrip] failed to record driver-penalty revenue:',
        err?.message,
      ),
    );
  }
}

/**
 * Spend one cancellation chance for the driver, rolling the day-key
 * over if this is the first cancel of a new calendar day. Best-effort;
 * a failure here just means the audit counter lags — never blocks the
 * cancellation itself.
 */
async function spendDriverCancelChance(driverId, dateKey) {
  if (!driverId || !dateKey) return;
  try {
    const driver = await Driver.findById(driverId).select('cancellationChances').lean();
    const sameDay = driver?.cancellationChances?.dateKey === dateKey;
    if (sameDay) {
      await Driver.updateOne(
        { _id: driverId },
        { $inc: { 'cancellationChances.used': 1 } },
      );
    } else {
      await Driver.updateOne(
        { _id: driverId },
        { $set: { cancellationChances: { dateKey, used: 1 } } },
      );
    }
  } catch (err) {
    console.warn(
      '[bookingTrip] failed to record driver cancellation chance:',
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
async function redispatchAfterDriverCancel(booking, driverId, policy, chance) {
  const { driverPenalty } = computeDriverCancellation(booking, policy, chance);

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
  cancelNoShowSchedule(booking._id);

  await applyDriverPenalty(driverId, driverPenalty, booking);

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
  { reason, tripStarted, chance },
) {
  const {
    driverPenalty,
    refundAmount,
  } = computeDriverCancellation(booking, policy, chance);

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
  cancelNoShowSchedule(booking._id);
  await applyDriverPenalty(driverId, driverPenalty, booking);

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

  // Snapshot the driver's daily cancel budget BEFORE we mutate it so
  // the grace decision matches what the FE saw in its confirm prompt.
  const driverSnap = await Driver.findById(driverId)
    .select('cancellationChances')
    .lean();
  const chance = evaluateDriverCancelChance(driverSnap, booking, policy);

  let result;
  // Paid + pre-STARTED → re-dispatch so the customer's payment isn't
  // wasted on a driver who bailed. Mid-ride cancellations can't be
  // re-dispatched (the customer is in a car) so they terminate.
  if (wasPaid && !tripStarted) {
    result = await redispatchAfterDriverCancel(booking, driverId, policy, chance);
  } else {
    result = await terminateBookingByDriver(booking, driverId, policy, {
      reason,
      tripStarted,
      chance,
    });
  }

  // Always spend a chance — the counter tracks "I bailed on a job" and
  // is independent of whether the penalty was actually charged.
  await spendDriverCancelChance(driverId, chance.dateKey || todayKey());

  return result;
}
