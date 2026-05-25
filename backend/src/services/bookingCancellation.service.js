import ServicePricing from '../models/servicePricing.model.js';
import { BOOKING_STATUS } from '../constants/bookingStatus.js';

/**
 * Cancellation-fee computation.
 *
 * Single admin-configured percentage drives every user refund:
 *
 *   cancellationFee = paid × ServicePricing.cancellation.userCancellationFeePercent / 100
 *   refund          = paid − cancellationFee
 *
 * The same percentage applies pre- and post-STARTED — admins tune it
 * from the pricing editor.
 *
 * Driver penalty is a flat ₹ amount (`driverCancellationPenalty`) and
 * is debited from `driver.wallet.balance` when a driver cancels. The
 * customer's refund is computed using the same formula above, so a
 * driver-cancel triggers both a debit on the driver side AND a refund
 * record for the user (which the admin manually processes via Razorpay).
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Defaults that mirror the schema — used when no pricing doc exists yet. */
const DEFAULT_POLICY = Object.freeze({
  userCancellationFeePercent: 15,
  driverCancellationPenalty: 50,
  freeCancellationMinutes: 2,
});

/**
 * Look up the cancellation knobs for the booking's service. Falls back to
 * the schema defaults if no `ServicePricing` doc is configured yet
 * (otherwise a missing config silently turns every cancel into "free").
 */
export async function loadCancellationPolicy(serviceType) {
  if (!serviceType) return DEFAULT_POLICY;
  const pricing = await ServicePricing.findOne({
    serviceType,
    isActive: true,
  }).lean();
  const cfg = pricing?.cancellation || {};
  return {
    userCancellationFeePercent:
      typeof cfg.userCancellationFeePercent === 'number'
        ? cfg.userCancellationFeePercent
        : DEFAULT_POLICY.userCancellationFeePercent,
    driverCancellationPenalty:
      typeof cfg.driverCancellationPenalty === 'number'
        ? cfg.driverCancellationPenalty
        : DEFAULT_POLICY.driverCancellationPenalty,
    freeCancellationMinutes:
      typeof cfg.freeCancellationMinutes === 'number'
        ? cfg.freeCancellationMinutes
        : DEFAULT_POLICY.freeCancellationMinutes,
  };
}

/**
 * Compute the user-side cancellation breakdown.
 *
 *   Paid:    fee    = paid × userCancellationFeePercent / 100
 *            refund = paid − fee
 *   Unpaid:  fee = 0, refund = 0
 *
 * `tripStarted` is still reported so UI copy can branch (e.g. "this
 * trip is already in progress — cancelling will charge ₹X"). The
 * numerical fee, however, is identical pre- and post-STARTED.
 */
export function computeUserCancellation(booking, policy) {
  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);
  const tripStarted = booking?.status === BOOKING_STATUS.STARTED;

  if (paid <= 0) {
    return {
      feeCharged: 0,
      refundAmount: 0,
      tripStarted,
    };
  }

  const feePercent = Math.max(
    0,
    Math.min(100, Number(policy?.userCancellationFeePercent) || 0),
  );
  const rawFee = (paid * feePercent) / 100;
  const fee = Math.min(round2(rawFee), paid);
  return {
    feeCharged: round2(fee),
    refundAmount: round2(Math.max(0, paid - fee)),
    tripStarted,
  };
}

/**
 * Compute the driver-side cancellation breakdown.
 *
 *   Paid:    driverPenalty (flat ₹) is debited regardless of phase. The
 *            user refund mirrors `computeUserCancellation` (paid − fee).
 *   Unpaid:  driverPenalty still applies; refund = 0 (nothing was paid).
 *
 * Driver penalty is a flat ₹ amount; admin-configured per service via
 * `ServicePricing.cancellation.driverCancellationPenalty`.
 */
export function computeDriverCancellation(booking, policy) {
  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);
  const tripStarted = booking?.status === BOOKING_STATUS.STARTED;
  const driverPenalty = round2(Number(policy?.driverCancellationPenalty) || 0);

  if (paid <= 0) {
    return {
      driverPenalty,
      refundAmount: 0,
      tripStarted,
    };
  }
  const userBreakdown = computeUserCancellation(booking, policy);
  return {
    driverPenalty,
    refundAmount: userBreakdown.refundAmount,
    tripStarted,
  };
}

/**
 * Lightweight quote endpoint helper — what the FE shows in its
 * confirm-dialog "you'll be charged ₹X" warning. Pure read; no side
 * effects on the booking.
 */
export async function quoteCancellation(booking, side /* 'user' | 'driver' */) {
  if (!booking) return null;
  const policy = await loadCancellationPolicy(booking.serviceType);
  if (side === 'driver') {
    return {
      side,
      policy,
      ...computeDriverCancellation(booking, policy),
    };
  }
  return {
    side: 'user',
    policy,
    ...computeUserCancellation(booking, policy),
  };
}
