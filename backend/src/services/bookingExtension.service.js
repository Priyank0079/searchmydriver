import Booking from '../models/booking.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  BOOKING_STATUS,
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
import {
  debitWalletService,
  releaseWalletHoldService,
} from './wallet.service.js';
import { WALLET_TXN_SOURCE } from '../models/walletTransaction.model.js';

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
 * Sum of all CONFIRMED extension fare deltas for a booking — i.e. only
 * rows the customer has actually verified-and-paid for (`accepted`).
 *
 * IMPORTANT: This intentionally skips `pending_otp` and
 * `pending_payment` rows. Including them was a latent bug:
 *
 *   - The customer's `effectiveTotal` would balloon the instant they
 *     tapped Extend, even though they hadn't agreed to or paid the
 *     fareDelta yet, making the trip page look like they were already
 *     charged.
 *   - Post-trip settlement (`amountDueForBooking`) would then try to
 *     collect that ghost amount on top of what was already paid.
 *   - If the customer abandoned the OTP step / driver dismissed it,
 *     the inflated total would linger for the whole OTP expiry
 *     window (5 min).
 *
 * The legacy `pending` status is also skipped here for the same
 * reason; the rare back-compat rows that were `accepted` will still
 * count via the explicit status check.
 */
export function extensionsFareDelta(booking) {
  const list = booking?.extensions || [];
  return list.reduce(
    (sum, ext) =>
      sum + (ext?.status === 'accepted' ? Number(ext.fareDelta) || 0 : 0),
    0,
  );
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
 *
 * Note: the waiting buffer is collected at booking creation and lives in
 * `payment.amountPaidRupees`. After settlement (`settleWaitingBuffer`),
 * `waiting.chargeRupees` is capped at `waiting.bufferRupees`, so the
 * effective total can never exceed what was already paid — meaning
 * `amountDue` stays at 0 for the waiting component, and any unused
 * buffer is refunded to the wallet (not surfaced here).
 */
export function amountDueForBooking(booking) {
  const effective = effectiveTotalForBooking(booking);
  const paid = booking?.payment?.amountPaidRupees || 0;
  return Math.max(0, round2(effective - paid));
}

/**
 * Release the soft-held waiting buffer back to spendable when a booking
 * is cancelled (or otherwise terminated) without ever reaching trip-end.
 * Idempotent — a second call is a no-op once the hold has been released
 * (we track that via `bufferRefundRupees` on the booking).
 *
 * Unlike `settleWaitingBuffer`, NO wallet debit happens here — the
 * buffer was never charged. The whole held amount just becomes
 * spendable again.
 *
 * Mutates `booking.waiting` in place; the caller is responsible for the
 * subsequent `booking.save()`.
 */
export async function releaseBookingBufferHold(booking) {
  if (!booking?.waiting) return;
  const buffered = Number(booking.waiting.bufferRupees) || 0;
  if (buffered <= 0) return;
  if (booking.waiting.bufferConsumedRupees > 0 || booking.waiting.bufferRefundRupees > 0) {
    return; // already released or settled
  }

  booking.waiting.bufferConsumedRupees = 0;
  booking.waiting.bufferRefundRupees = buffered;

  try {
    await releaseWalletHoldService({
      userId: booking.userId,
      amount: buffered,
    });
  } catch (err) {
    console.warn(
      '[booking] waiting buffer hold release on cancel failed for booking',
      String(booking._id),
      err?.message,
    );
  }
}

/**
 * Settle the soft-held waiting buffer at trip-end.
 *
 * The buffer was never debited — it sits in `wallet.heldRupees`. We:
 *   1. Cap `waiting.chargeRupees` at `bufferRupees` (belt-and-braces;
 *      the cadence validator already prevents overshoot).
 *   2. Debit the actual `chargeRupees` from the wallet (bypassing the
 *      hold-check since this is precisely the operation the hold was
 *      reserving for).
 *   3. Release the full `bufferRupees` from the hold so the rest of
 *      the held amount becomes spendable again.
 *
 * Idempotent: a second call is a no-op once `bufferConsumedRupees` is
 * already set.
 *
 * Mutates `booking.waiting` in place; the caller is responsible for the
 * subsequent `booking.save()`.
 */
export async function settleWaitingBuffer(booking) {
  if (!booking?.waiting) return;
  const buffered = Number(booking.waiting.bufferRupees) || 0;
  if (buffered <= 0) return; // legacy booking, nothing to settle.
  if (booking.waiting.bufferConsumedRupees > 0 || booking.waiting.bufferRefundRupees > 0) {
    return; // already settled
  }

  const charged = Number(booking.waiting.chargeRupees) || 0;
  const cappedCharge = round2(Math.min(charged, buffered));
  // `bufferRefundRupees` is no longer a wallet-credit number — it's
  // just "held but not consumed" for the audit row. The wallet field
  // it points to is now release-only (no transaction).
  const releaseRupees = round2(Math.max(0, buffered - cappedCharge));

  booking.waiting.chargeRupees = cappedCharge;
  booking.waiting.bufferConsumedRupees = cappedCharge;
  booking.waiting.bufferRefundRupees = releaseRupees;

  // Step 1: debit the actual waiting charge from the wallet. Use the
  // bypassHeld escape hatch — this debit is exactly what the held funds
  // were earmarked for.
  if (cappedCharge > 0) {
    try {
      const tx = await debitWalletService({
        userId: booking.userId,
        amount: cappedCharge,
        source: WALLET_TXN_SOURCE.WAITING_CHARGE,
        description: `Waiting charge \u2014 booking ${booking.bookingNumber || ''}`.trim(),
        refType: 'Booking',
        refId: String(booking._id),
        bypassHeld: true,
      });
      booking.waiting.bufferRefundTxId = tx._id;
    } catch (err) {
      console.warn(
        '[booking] waiting-charge debit failed for booking',
        String(booking._id),
        err?.message,
      );
      // Don't throw — completion must succeed. The hold release below
      // still runs so the user's wallet returns to a sane state.
    }
  }

  // Step 2: release the entire hold for this booking. Even if the debit
  // failed we release — the audit trail (bufferConsumedRupees /
  // bufferRefundRupees) records the intent and admins can reconcile.
  try {
    await releaseWalletHoldService({
      userId: booking.userId,
      amount: buffered,
    });
  } catch (err) {
    console.warn(
      '[booking] waiting buffer hold release failed for booking',
      String(booking._id),
      err?.message,
    );
  }
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

  // Driver's share of the extension. Mirrors the formula in
  // `pricing.service.js#applyPlatformLayers`:
  //   driverEarning   = subtotal − platformCommission
  //   platformCommission = subtotal × commissionPercent / 100
  // We carry both onto the extension row so `payExtensionService` can
  // bump `fareSnapshot.breakdown.driverEarning` and the driver's
  // earnings aggregation (driverTrips.service.js) picks the extra up
  // without any new code path.
  const platformCommissionPercent =
    Number(fareBreakdown?.platformCommissionPercent) ||
    Number(pricing?.platformCommissionPercent) ||
    0;
  const platformCommission = (subtotal * platformCommissionPercent) / 100;
  const driverEarning = Math.max(0, subtotal - platformCommission);

  return {
    fareDelta,
    breakdown: {
      additionalHours,
      ratePerHour: extraRate,
      subtotal: round2(subtotal),
      serviceCharge: round2(serviceCharge),
      serviceChargePercent,
      gst: round2(gst),
      gstPercent,
      platformCommission: round2(platformCommission),
      platformCommissionPercent,
      driverEarning: round2(driverEarning),
    },
  };
}

/**
 * Window (in minutes) the customer has to verify the OTP and pay before
 * the pending extension row auto-expires. Kept conservative so a stale
 * intent doesn't block the next attempt.
 */
const EXTENSION_OTP_WINDOW_MINUTES = 5;

/** 4-digit numeric OTP, zero-padded so "0042" is a valid code. */
function generateExtensionOtp() {
  const n = Math.floor(Math.random() * 10000);
  return String(n).padStart(4, '0');
}

/**
 * Sanitised view of an extension row for FE consumption — never includes
 * the raw OTP code (the customer types that, they shouldn't see it on
 * their own screen).
 */
function serialiseExtensionForCustomer(ext) {
  if (!ext) return null;
  const obj = ext.toObject ? ext.toObject() : { ...ext };
  if (obj.otp) {
    obj.otp = {
      generatedAt: obj.otp.generatedAt || null,
      verifiedAt: obj.otp.verifiedAt || null,
      expiresAt: obj.otp.expiresAt || null,
      attempts: obj.otp.attempts || 0,
    };
  }
  return obj;
}

/**
 * Same shape as `serialiseExtensionForCustomer` but includes the OTP
 * code so the driver app can show it to read aloud to the customer.
 * Only used on driver-targeted socket payloads.
 */
function serialiseExtensionForDriver(ext) {
  if (!ext) return null;
  const obj = ext.toObject ? ext.toObject() : { ...ext };
  return obj;
}

/**
 * Mark all `pending_otp` / `pending_payment` rows on the booking as
 * expired in-memory if their OTP window has lapsed. Called at the start
 * of every initiate/verify/pay so a stale intent can't block a new
 * attempt. Returns true if anything changed.
 */
function expireStaleExtensions(booking) {
  const now = Date.now();
  let changed = false;
  for (const ext of booking.extensions || []) {
    if (
      (ext.status === 'pending_otp' || ext.status === 'pending_payment') &&
      ext.otp?.expiresAt &&
      new Date(ext.otp.expiresAt).getTime() < now
    ) {
      ext.status = 'expired';
      changed = true;
    }
  }
  return changed;
}

/**
 * Locate the extension subdoc by id and return it; throws 404 if it's
 * gone (expired & cleaned up, or never existed).
 */
function getExtensionOrThrow(booking, extensionId) {
  const ext = booking.extensions?.id?.(extensionId);
  if (!ext) {
    throw new ApiError(404, 'Extension request not found or has expired');
  }
  return ext;
}

/* ------------------------------------------------------------------ */
/* Initiate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Phase 1: customer hits Extend.
 * Computes the fareDelta (locked in for the whole flow), generates a
 * 4-digit OTP and pushes a `pending_otp` row onto the booking. The OTP
 * is emitted to the driver's app via `BOOKING_EXTENSION_OTP` so they
 * can read it back to the customer (mirrors the ride-start OTP UX).
 *
 * Returns the customer-safe extension shape (no OTP code).
 */
export async function initiateExtensionService(userId, bookingId, body = {}) {
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

  expireStaleExtensions(booking);

  // Block stacking: if there's an open intent, the customer must finish
  // (verify+pay) or wait for it to expire. Avoids ambiguous OTP races.
  const openIntent = (booking.extensions || []).find(
    (ext) => ext.status === 'pending_otp' || ext.status === 'pending_payment',
  );
  if (openIntent) {
    throw new ApiError(
      409,
      'You already have a pending extension. Finish it or wait for it to expire.',
      { extensionId: String(openIntent._id) },
    );
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

  const otpCode = generateExtensionOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXTENSION_OTP_WINDOW_MINUTES * 60 * 1000);

  booking.extensions.push({
    requestedAt: now,
    additionalHours,
    fareDelta,
    breakdown,
    status: 'pending_otp',
    otp: {
      code: otpCode,
      generatedAt: now,
      verifiedAt: null,
      attempts: 0,
      expiresAt,
    },
    driverNotifiedAt: booking.driverId ? now : null,
  });

  await booking.save();

  const ext = booking.extensions[booking.extensions.length - 1];

  // Push the OTP to the driver so they can read it to the customer.
  // Customer NEVER sees the code on their own device — that's the
  // whole point of the handshake.
  if (booking.driverId) {
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_EXTENSION_OTP, {
      bookingId: String(booking._id),
      extensionId: String(ext._id),
      otp: otpCode,
      additionalHours,
      fareDelta,
      expiresAt,
      breakdown,
    });
  }
  // Admin audit trail (with the code so support can troubleshoot live).
  emitToAdmins(S2C_EVENTS.BOOKING_EXTENSION_OTP, {
    bookingId: String(booking._id),
    extensionId: String(ext._id),
    otp: otpCode,
    additionalHours,
    fareDelta,
    expiresAt,
  });

  return {
    booking: booking.toObject(),
    extension: serialiseExtensionForCustomer(ext),
    breakdown,
  };
}

/* ------------------------------------------------------------------ */
/* Verify OTP                                                         */
/* ------------------------------------------------------------------ */

const MAX_OTP_ATTEMPTS = 5;

/**
 * Phase 2: customer enters the OTP they got from the driver.
 *
 * Verifies the code, increments attempts on mismatch, expires after
 * `MAX_OTP_ATTEMPTS`. On success the row transitions to
 * `pending_payment` and the customer's pay screen unlocks.
 */
export async function verifyExtensionOtpService(userId, bookingId, body = {}) {
  const extensionId = String(body?.extensionId || '').trim();
  const submittedRaw = String(body?.otp || '').trim();
  if (!extensionId) throw new ApiError(400, 'extensionId is required');
  if (!/^\d{4}$/.test(submittedRaw)) {
    throw new ApiError(400, 'Enter the 4-digit code from your driver');
  }

  const booking = await Booking.findOne({ _id: bookingId, userId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== BOOKING_STATUS.STARTED) {
    throw new ApiError(400, 'Ride must be in progress to verify');
  }

  expireStaleExtensions(booking);
  const ext = getExtensionOrThrow(booking, extensionId);

  if (ext.status === 'expired') {
    await booking.save();
    throw new ApiError(410, 'This extension request has expired. Please start again.');
  }
  if (ext.status === 'pending_payment') {
    return {
      booking: booking.toObject(),
      extension: serialiseExtensionForCustomer(ext),
      alreadyVerified: true,
    };
  }
  if (ext.status !== 'pending_otp') {
    throw new ApiError(400, 'This extension is not awaiting verification');
  }

  if (!ext.otp?.code) {
    throw new ApiError(400, 'Extension OTP not initialised');
  }

  if (ext.otp.code !== submittedRaw) {
    ext.otp.attempts = (ext.otp.attempts || 0) + 1;
    if (ext.otp.attempts >= MAX_OTP_ATTEMPTS) {
      ext.status = 'expired';
    }
    await booking.save();
    throw new ApiError(401, 'Incorrect code. Ask your driver to read it again.', {
      attemptsLeft: Math.max(0, MAX_OTP_ATTEMPTS - ext.otp.attempts),
      expired: ext.status === 'expired',
    });
  }

  ext.status = 'pending_payment';
  ext.otp.verifiedAt = new Date();
  // The pay window keeps the same expiresAt as the OTP window — this
  // is intentional: once verified, the customer must pay promptly or
  // the price needs to be re-quoted (the driver might not be willing
  // to wait around for an indefinite payment).
  await booking.save();

  // Driver hears that the OTP was accepted so their pending banner can
  // transition to "waiting for customer to pay".
  if (booking.driverId) {
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
      bookingId: String(booking._id),
      extensionId: String(ext._id),
      stage: 'otp_verified',
      additionalHours: ext.additionalHours,
      fareDelta: ext.fareDelta,
    });
  }

  return {
    booking: booking.toObject(),
    extension: serialiseExtensionForCustomer(ext),
  };
}

/* ------------------------------------------------------------------ */
/* Pay                                                                */
/* ------------------------------------------------------------------ */

/**
 * Phase 3: customer pays the fareDelta from their wallet, the extension
 * row becomes `accepted`, and the booking's effective total + paid
 * counters tick up so the trip-end math is balanced.
 *
 * The user's wallet must cover `fareDelta` AFTER `wallet.heldRupees`
 * (we don't dip into the waiting buffer to fund extensions). If the
 * wallet is short we surface the standard 402 shape so the FE can deep-
 * link straight into TopupSheet.
 */
export async function payExtensionService(userId, bookingId, body = {}) {
  const extensionId = String(body?.extensionId || '').trim();
  if (!extensionId) throw new ApiError(400, 'extensionId is required');

  const booking = await Booking.findOne({ _id: bookingId, userId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.status !== BOOKING_STATUS.STARTED) {
    throw new ApiError(400, 'Ride must be in progress to pay for an extension');
  }

  expireStaleExtensions(booking);
  const ext = getExtensionOrThrow(booking, extensionId);

  if (ext.status === 'accepted') {
    return {
      booking: booking.toObject(),
      extension: serialiseExtensionForCustomer(ext),
      alreadyPaid: true,
    };
  }
  if (ext.status === 'expired' || ext.status === 'declined') {
    throw new ApiError(410, 'This extension request is no longer payable. Start again.');
  }
  if (ext.status !== 'pending_payment') {
    throw new ApiError(400, 'Please verify the OTP from your driver before paying');
  }

  const fareDelta = round2(ext.fareDelta || 0);
  if (fareDelta <= 0) {
    // Free extension (admin testing path) — just mark accepted.
    ext.status = 'accepted';
    ext.respondedAt = new Date();
    ext.paidAt = new Date();
  } else {
    const walletTx = await debitWalletService({
      userId,
      amount: fareDelta,
      source: WALLET_TXN_SOURCE.BOOKING_EXTENSION_PAYMENT,
      description: `Extension \u2014 booking ${booking.bookingNumber} (+${ext.additionalHours}h)`,
      refType: 'Booking',
      refId: String(booking._id),
    });

    ext.status = 'accepted';
    ext.respondedAt = new Date();
    ext.paidAt = new Date();
    ext.paymentTxId = walletTx._id;

    // The fareDelta has been collected; bump amountPaidRupees so the
    // settle-time math (effectiveTotal − amountPaid) stays at zero
    // owed for this extension and the booking can remain PAID.
    booking.payment = booking.payment || {};
    booking.payment.amountPaidRupees = round2(
      Number(booking.payment.amountPaidRupees || 0) + fareDelta,
    );

    // Credit the driver's share of the extension into the booking's
    // fareSnapshot.breakdown so the earnings aggregation in
    // `driverTrips.service.js` (which reads
    // `fareSnapshot.breakdown.driverEarning`) picks the extra up at
    // trip-completion time without a new code path. We also bump
    // `platformCommission` so the company-side ledger remains
    // balanced.
    //
    // We deliberately do NOT touch `fareSnapshot.total`, `subtotal`,
    // `serviceCharge` or `gst` — those stay as their original
    // snapshot values and the extra fare reaches the customer-facing
    // total through `effectiveTotalForBooking` (which adds accepted
    // extensions). Mutating those here would double-count.
    //
    // `breakdown` is a Mixed sub-doc, so Mongoose can't auto-detect
    // the deep mutation — `markModified` is mandatory.
    const extBd = ext.breakdown || {};
    const addDriverEarning = Number(extBd.driverEarning) || 0;
    const addPlatformCommission = Number(extBd.platformCommission) || 0;
    if (addDriverEarning > 0 || addPlatformCommission > 0) {
      booking.fareSnapshot = booking.fareSnapshot || {};
      booking.fareSnapshot.breakdown = booking.fareSnapshot.breakdown || {};
      const bd = booking.fareSnapshot.breakdown;
      bd.driverEarning = round2(
        (Number(bd.driverEarning) || 0) + addDriverEarning,
      );
      bd.platformCommission = round2(
        (Number(bd.platformCommission) || 0) + addPlatformCommission,
      );
      booking.markModified('fareSnapshot.breakdown');
    }
  }

  // Keep paymentStatus PAID — the delta was just collected. (Old flow
  // flipped this to PENDING because nothing was charged at extension
  // time; we don't need that now.)
  if (booking.paymentStatus !== BOOKING_PAYMENT_STATUS.PAID) {
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.PAID;
  }

  await booking.save();

  const extensionsForUi = booking.extensions.map((e) => serialiseExtensionForCustomer(e));
  const userPayload = {
    bookingId: String(booking._id),
    extension: serialiseExtensionForCustomer(ext),
    extensions: extensionsForUi,
    paymentStatus: booking.paymentStatus,
    effectiveTotal: effectiveTotalForBooking(booking),
    amountDue: amountDueForBooking(booking),
  };

  emitToUser(booking.userId, S2C_EVENTS.BOOKING_EXTENSION_PAID, userPayload);
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, userPayload);

  // Driver gets a richer payload so they can see the full extension
  // detail (with OTP code stripped — driver already used it).
  if (booking.driverId) {
    const driverPayload = {
      bookingId: String(booking._id),
      extension: serialiseExtensionForDriver(ext),
      extensions: booking.extensions.map((e) => serialiseExtensionForDriver(e)),
    };
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_EXTENSION_PAID, driverPayload);
    emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, driverPayload);
  }

  emitToAdmins(S2C_EVENTS.BOOKING_EXTENSION_PAID, userPayload);

  return {
    booking: booking.toObject(),
    extension: serialiseExtensionForCustomer(ext),
  };
}

/**
 * Cancel a pending extension. The user might:
 *   - close the modal mid-flow and never come back;
 *   - tap "Change hours" after the OTP is verified to start over with
 *     a different hour count;
 *   - simply abandon the intent before paying.
 *
 * In every case we mark the row `declined` so a fresh initiate can
 * succeed (the open-intent block in `initiateExtensionService` uses
 * `pending_otp | pending_payment` and skips terminal statuses). We
 * also signal the driver so their OTP banner can disappear cleanly.
 */
export async function cancelExtensionService(userId, bookingId, body = {}) {
  const extensionId = String(body?.extensionId || '').trim();
  if (!extensionId) throw new ApiError(400, 'extensionId is required');

  const booking = await Booking.findOne({ _id: bookingId, userId, isDeleted: false });
  if (!booking) throw new ApiError(404, 'Booking not found');

  expireStaleExtensions(booking);
  const ext = getExtensionOrThrow(booking, extensionId);

  if (ext.status === 'accepted') {
    throw new ApiError(409, 'This extension has already been paid for');
  }
  if (
    ext.status !== 'pending_otp' &&
    ext.status !== 'pending_payment'
  ) {
    // Already declined/expired — return idempotently so the FE's
    // "Change hours" button feels instant even on a stale row.
    return {
      booking: booking.toObject(),
      extension: serialiseExtensionForCustomer(ext),
      alreadyCancelled: true,
    };
  }

  ext.status = 'declined';
  ext.respondedAt = new Date();
  // Wipe the OTP code so a leaked socket payload can't be replayed
  // against this booking once the row is declined.
  if (ext.otp) ext.otp.code = '';

  await booking.save();

  // Driver-side OTP banner should fall away — we piggy-back on the
  // existing RESOLVED event with a `cancelled` stage so we don't have
  // to add another socket name on either side.
  if (booking.driverId) {
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
      bookingId: String(booking._id),
      extensionId: String(ext._id),
      stage: 'cancelled',
      additionalHours: ext.additionalHours,
      fareDelta: ext.fareDelta,
    });
  }
  emitToAdmins(S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
    bookingId: String(booking._id),
    extensionId: String(ext._id),
    stage: 'cancelled',
  });

  return {
    booking: booking.toObject(),
    extension: serialiseExtensionForCustomer(ext),
  };
}

/**
 * Driver-side counterpart to `cancelExtensionService`. The driver can
 * tap "Dismiss" on the OTP banner to say "I don't want to accept this
 * extension" — for example if the customer changed their mind verbally
 * but didn't update the app, or the driver simply can't continue.
 *
 * Side effects mirror the customer cancel but flip
 * `dismissedByDriver = true` so the customer's UI can show a clear
 * "Driver dismissed — please try again" message and offer a retry.
 *
 *   body: { extensionId }
 */
export async function dismissExtensionByDriverService(driverId, bookingId, body = {}) {
  const extensionId = String(body?.extensionId || '').trim();
  if (!extensionId) throw new ApiError(400, 'extensionId is required');

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId,
    isDeleted: false,
  });
  if (!booking) throw new ApiError(404, 'Booking not found');

  expireStaleExtensions(booking);
  const ext = getExtensionOrThrow(booking, extensionId);

  if (ext.status === 'accepted') {
    throw new ApiError(409, 'This extension has already been paid for');
  }
  if (
    ext.status !== 'pending_otp' &&
    ext.status !== 'pending_payment'
  ) {
    // Already gone — return idempotently so a double-tap on the
    // Dismiss button doesn't surface an error.
    return {
      booking: booking.toObject(),
      extension: serialiseExtensionForCustomer(ext),
      alreadyResolved: true,
    };
  }

  ext.status = 'declined';
  ext.dismissedByDriver = true;
  ext.respondedAt = new Date();
  if (ext.otp) ext.otp.code = '';

  await booking.save();

  // Customer-facing: tell their app the driver dismissed this so it
  // can switch the modal/banner to a retry CTA. We piggy-back on the
  // existing RESOLVED event family with a new stage so the FE only
  // has one listener to wire up.
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
    bookingId: String(booking._id),
    extensionId: String(ext._id),
    stage: 'dismissed_by_driver',
    additionalHours: ext.additionalHours,
    fareDelta: ext.fareDelta,
  });
  // Update channel so any other open user surfaces (Activity etc.)
  // see the booking patch.
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, {
    bookingId: String(booking._id),
    extensions: booking.extensions.map(serialiseExtensionForCustomer),
  });

  // Echo back to the driver's other devices so the banner clears
  // everywhere, not just where the tap happened.
  emitToDriver(driverId, S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
    bookingId: String(booking._id),
    extensionId: String(ext._id),
    stage: 'dismissed_by_driver',
  });
  emitToAdmins(S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
    bookingId: String(booking._id),
    extensionId: String(ext._id),
    stage: 'dismissed_by_driver',
  });

  return {
    booking: booking.toObject(),
    extension: serialiseExtensionForCustomer(ext),
  };
}

/**
 * Force-cancel any open extension intents on a booking — used by trip
 * completion, driver cancel, and user cancel paths. If the customer
 * left an extension mid-handshake (OTP unverified or unpaid) when the
 * trip ends, we need to:
 *
 *   1. Mark the row `expired` so it never appears as "pending" on
 *      future booking views.
 *   2. Wipe the OTP code so it can't be replayed.
 *   3. Tell the driver's app to clear the OTP banner — the
 *      `BOOKING_EXTENSION_RESOLVED` event with stage='cancelled'
 *      already does that on the FE.
 *
 * Mutates `booking.extensions` in place; the caller is responsible
 * for `booking.save()`. Idempotent: re-running on an already-cleaned
 * booking is a no-op.
 */
export async function clearPendingExtensionsOnTerminate(booking, reason = 'trip_ended') {
  if (!booking?.extensions?.length) return;
  const openExts = booking.extensions.filter(
    (e) => e.status === 'pending_otp' || e.status === 'pending_payment',
  );
  if (!openExts.length) return;

  for (const ext of openExts) {
    ext.status = 'expired';
    ext.respondedAt = new Date();
    if (ext.otp) ext.otp.code = '';
  }

  // Best-effort socket cleanup. We don't await rejections — these are
  // fire-and-forget UI nudges and shouldn't block trip completion.
  try {
    if (booking.driverId) {
      for (const ext of openExts) {
        emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
          bookingId: String(booking._id),
          extensionId: String(ext._id),
          stage: 'cancelled',
          reason,
          additionalHours: ext.additionalHours,
          fareDelta: ext.fareDelta,
        });
      }
    }
    for (const ext of openExts) {
      emitToAdmins(S2C_EVENTS.BOOKING_EXTENSION_RESOLVED, {
        bookingId: String(booking._id),
        extensionId: String(ext._id),
        stage: 'cancelled',
        reason,
      });
    }
  } catch (err) {
    console.warn(
      '[booking] failed to notify of extension cleanup on terminate:',
      err?.message,
    );
  }
}

/**
 * @deprecated The single-shot extension flow is replaced by the
 * initiate → verify → pay handshake. Existing callers should switch.
 * Kept as a thin wrapper that mirrors the old behaviour when a payment
 * has already been settled out-of-band, so legacy admin tooling keeps
 * working. New code MUST NOT use this.
 */
export async function createExtensionService(userId, bookingId, body = {}) {
  throw new ApiError(
    410,
    'Extensions now require driver-OTP confirmation. Use initiate → verifyOtp → pay.',
  );
}
