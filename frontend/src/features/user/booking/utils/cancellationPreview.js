import { BOOKING_STATUS } from '../../../../constants/bookingStatus';

/**
 * Client-side mirror of `bookingCancellation.service.js`.
 *
 * Why we recompute on the FE: the backend stamps an initial
 * `cancellationPreview` onto the booking when it's fetched, but the
 * preview shifts as the booking moves through statuses and we don't
 * want to fire an extra round-trip on every transition.
 *
 * The values here MUST stay in lockstep with the backend `compute…`
 * helpers. If you change the formulas there, mirror them here.
 *
 * Refund formula (paid):
 *
 *   cancellationFee = paid × userCancellationFeePercent / 100
 *   refund          = paid − cancellationFee
 *
 * Same percentage applies pre- and post-STARTED — tuned from the admin
 * pricing editor.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function readPolicy(booking) {
  return booking?.cancellationPreview?.policy || {};
}

/**
 * Returns `{ feeCharged, refundAmount, tripStarted }` for a user-side
 * cancellation. Mirrors `computeUserCancellation` on the backend.
 */
export function previewUserCancellation(booking) {
  if (!booking) {
    return { feeCharged: 0, refundAmount: 0, tripStarted: false };
  }
  const tripStarted = booking.status === BOOKING_STATUS.STARTED;
  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);

  if (paid <= 0) {
    return { feeCharged: 0, refundAmount: 0, tripStarted };
  }

  const policy = readPolicy(booking);
  const feePercent = Math.max(
    0,
    Math.min(100, Number(policy.userCancellationFeePercent) || 0),
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
 * Returns `{ driverPenalty, refundAmount, tripStarted }` for a
 * driver-side cancellation. Mirrors `computeDriverCancellation` on
 * the backend.
 */
export function previewDriverCancellation(booking) {
  if (!booking) {
    return { driverPenalty: 0, refundAmount: 0, tripStarted: false };
  }
  const tripStarted = booking.status === BOOKING_STATUS.STARTED;
  const policy = readPolicy(booking);
  const driverPenalty = round2(Number(policy.driverCancellationPenalty) || 0);
  const userPreview = previewUserCancellation(booking);
  return {
    driverPenalty,
    refundAmount: userPreview.refundAmount,
    tripStarted,
  };
}
