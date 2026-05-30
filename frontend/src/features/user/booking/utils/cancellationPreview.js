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
 *   status                            →  fee
 *   ──────                               ───
 *   searching                            0
 *   driver_assigned / awaiting_payment   flatFeeAfterAssignment (₹)
 *   en_route                             flatFeeAfterAssignment (₹)
 *   arrived / started                    arrivedFeeType picks:
 *                                          'flat'       → arrivedFeeAmount (₹)
 *                                          'percentage' → arrivedFeeAmount % of paid
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const ASSIGNED_PRE_ARRIVAL_STATUSES = new Set([
  BOOKING_STATUS.DRIVER_ASSIGNED,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.EN_ROUTE,
]);

const ARRIVED_OR_LATER_STATUSES = new Set([
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.STARTED,
]);

function readPolicy(booking) {
  return booking?.cancellationPreview?.policy || {};
}

/**
 * Returns `{ feeCharged, refundAmount, tripStarted, driverArrived }`
 * for a user-side cancellation. Mirrors `computeUserCancellation` on
 * the backend.
 */
export function previewUserCancellation(booking) {
  if (!booking) {
    return {
      feeCharged: 0,
      refundAmount: 0,
      tripStarted: false,
      driverArrived: false,
    };
  }
  const status = booking.status;
  const tripStarted = status === BOOKING_STATUS.STARTED;
  const driverArrived =
    status === BOOKING_STATUS.ARRIVED || status === BOOKING_STATUS.STARTED;
  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);

  if (paid <= 0) {
    return { feeCharged: 0, refundAmount: 0, tripStarted, driverArrived };
  }

  const policy = readPolicy(booking);
  let rawFee = 0;
  if (ARRIVED_OR_LATER_STATUSES.has(status)) {
    const amount = Math.max(0, Number(policy.arrivedFeeAmount) || 0);
    if (policy.arrivedFeeType === 'percentage') {
      const pct = Math.max(0, Math.min(100, amount));
      rawFee = (paid * pct) / 100;
    } else {
      // Falls back to legacy `flatFeeAfterArrival` if the new amount is
      // unset on an older policy snapshot.
      rawFee =
        amount ||
        Math.max(0, Number(policy.flatFeeAfterArrival) || 0);
    }
  } else if (ASSIGNED_PRE_ARRIVAL_STATUSES.has(status)) {
    rawFee = Math.max(0, Number(policy.flatFeeAfterAssignment) || 0);
  }

  const fee = Math.min(round2(rawFee), paid);
  return {
    feeCharged: round2(fee),
    refundAmount: round2(Math.max(0, paid - fee)),
    tripStarted,
    driverArrived,
  };
}

/**
 * Returns `{ driverPenalty, refundAmount, tripStarted, chance, fullPenalty, penaltyWaived }`
 * for a driver-side cancellation. Mirrors `computeDriverCancellation` on
 * the backend.
 *
 * IMPORTANT: the server stamps `cancellationPreview.chance` at fetch
 * time, but the grace window shrinks every second. If the driver opens
 * the cancel dialog at 1:55 we'd happily say "no penalty" — only to
 * have the backend at 2:05 actually charge them. To avoid that drift
 * we recompute `inGrace` here using the live wall-clock vs.
 * `timeline.driverAssignedAt`, and **only treat the cancel as waived
 * when BOTH the server snapshot AND the live clock agree it's still
 * inside the window AND chances remain**. The server stays the source
 * of truth for `chancesLeft` (we can't know that on the client).
 */
export function previewDriverCancellation(booking) {
  if (!booking) {
    return {
      driverPenalty: 0,
      fullPenalty: 0,
      penaltyWaived: false,
      refundAmount: 0,
      tripStarted: false,
      chance: null,
    };
  }
  const tripStarted = booking.status === BOOKING_STATUS.STARTED;
  const policy = readPolicy(booking);
  const fullPenalty = round2(Number(policy.driverCancellationPenalty) || 0);
  const previewBlock = booking?.cancellationPreview || {};
  const serverChance = previewBlock.chance || null;

  // Live-clock recompute of the grace window. Keeps the dialog honest
  // even when the booking payload was fetched minutes ago.
  const graceMinutes = Math.max(
    0,
    Number(serverChance?.graceMinutes ?? policy.driverGraceMinutes) || 0,
  );
  const acceptedAt = booking?.timeline?.driverAssignedAt;
  const elapsedMs = acceptedAt
    ? Math.max(0, Date.now() - new Date(acceptedAt).getTime())
    : 0;
  const elapsedMinutes = elapsedMs / 60000;
  const liveInGrace = graceMinutes > 0 && elapsedMinutes <= graceMinutes;
  const chancesLeft = Math.max(0, Number(serverChance?.chancesLeft) || 0);

  // Waiver applies only when (a) BOTH server and live clock agree we're
  // still inside the grace window, (b) the driver still has chances
  // left today, and (c) we're not mid-trip (started rides never waive).
  const penaltyWaived =
    !tripStarted && liveInGrace && chancesLeft > 0;
  const driverPenalty = penaltyWaived ? 0 : fullPenalty;

  // Live chance snapshot — we keep the server-supplied `dailyLimit` /
  // `usedToday` / `chancesLeft` but override the time-sensitive bits
  // with our wall-clock recompute so dialog copy stays accurate.
  const chance = serverChance
    ? {
        ...serverChance,
        graceMinutes,
        elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
        inGrace: liveInGrace,
        penaltyWaived,
        // Minutes left in the grace window (negative once expired).
        // Used by the FE to render a live countdown.
        remainingMinutes: graceMinutes - elapsedMinutes,
      }
    : null;

  const userPreview = previewUserCancellation(booking);
  return {
    driverPenalty,
    fullPenalty,
    penaltyWaived,
    refundAmount: userPreview.refundAmount,
    tripStarted,
    chance,
  };
}
