/**
 * Outstation (multi-day round-trip) cancellation policy.
 *
 * Pure module — no DB writes, no Mongoose imports. The booking-cancel
 * handlers in `booking.service.js` / `bookingTrip.service.js` call
 * these helpers to compute the deduction + refund + tier; the actual
 * side-effects (wallet credit, driver penalty, priority hit,
 * recent-events log) live in those callers.
 *
 * Why a separate module: the hourly flow is STATUS-driven
 * (driver_assigned → en_route → arrived → started). Outstation is
 * TIME-driven (hoursUntilPickup) because pickups are scheduled days
 * in advance. Trying to overload the hourly helpers blurred the rules
 * and made future policy tweaks risky.
 *
 *   ── Customer side (one calculation path per scenario) ──
 *     hoursUntilPickup > freeCancellationHoursBeforePickup
 *                                       → tier A. Fee from
 *                                         beforeWindowFee{Type,Amount}.
 *                                         Defaults to 0 → 100% refund.
 *     hoursUntilPickup ≤ free window AND driver not arrived
 *                                       → tier B. Fee from
 *                                         preArrivalFee{Type,Amount}.
 *     driver arrived (or trip started)  → tier C. Fee from
 *                                         arrivedFee{Type,Amount},
 *                                         floored at arrivedFeeMinDays
 *                                         × dailyRate.
 *
 *   ── Driver side ──
 *     hoursUntilPickup > driverFreeReassignHoursBeforePickup
 *                                       → tier A. No penalty.
 *     pickup ∈ (penaltyHours, freeReassignHours]
 *                                       → tier B. driverMidPenalty.
 *     hoursUntilPickup ≤ driverPenaltyHoursBeforePickup
 *                                       → tier C. driverPenalty +
 *                                         priority points debit.
 *     tripStarted                       → tier C (driver bailed mid-ride).
 *
 * Outstation has NO driver grace window — that's an hourly-only
 * concept and the daily `cancellationChances` counter is not touched
 * by this module.
 */

import { BOOKING_STATUS } from '../constants/bookingStatus.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));
const nonNeg = (n) => Math.max(0, Number(n) || 0);

export const OUTSTATION_USER_CANCEL_TIER = Object.freeze({
  BEFORE_FREE_WINDOW: 'outstation_before_free_window',
  WITHIN_FREE_WINDOW_PRE_ARRIVAL: 'outstation_within_free_window_pre_arrival',
  DRIVER_ARRIVED: 'outstation_driver_arrived',
});

export const OUTSTATION_DRIVER_CANCEL_TIER = Object.freeze({
  FREE_REASSIGN: 'outstation_driver_free_reassign',
  MID_TIER: 'outstation_driver_mid_tier',
  PENALTY_WINDOW: 'outstation_driver_within_penalty_window',
});

const FEE_TYPES = Object.freeze(['flat', 'percentage']);
const normaliseFeeType = (raw, fallback) =>
  FEE_TYPES.includes(raw) ? raw : fallback;

/** Schema defaults — kept in lockstep with `outstationCancellationSchema`. */
export const DEFAULT_OUTSTATION_POLICY = Object.freeze({
  freeCancellationHoursBeforePickup: 24,

  beforeWindowFeeType: 'percentage',
  beforeWindowFeeAmount: 0,

  preArrivalFeeType: 'percentage',
  preArrivalFeeAmount: 15,

  arrivedFeeType: 'percentage',
  arrivedFeeAmount: 50,
  arrivedFeeMinDays: 1,

  driverFreeReassignHoursBeforePickup: 24,
  driverPenaltyHoursBeforePickup: 6,

  driverMidPenaltyType: 'flat',
  driverMidPenaltyAmount: 100,

  driverPenaltyType: 'flat',
  driverPenaltyAmount: 200,
  driverPriorityPenaltyPoints: 10,
});

/**
 * Normalise whatever the admin saved on `ServicePricing.cancellation.outstation`
 * to a frozen-shape object with sensible defaults. Safe to call with
 * `undefined`/`null`.
 *
 * Also maps a small set of legacy fields (`preArrivalFeePercent`,
 * `arrivedFeePercent`, `driverMidTierPenaltyAmount`) from prior
 * revisions so saved docs keep loading without a migration.
 */
export function normaliseOutstationPolicy(raw) {
  const merged = { ...DEFAULT_OUTSTATION_POLICY };
  if (!raw || typeof raw !== 'object') return merged;

  const numericKeys = [
    'freeCancellationHoursBeforePickup',
    'beforeWindowFeeAmount',
    'preArrivalFeeAmount',
    'arrivedFeeAmount',
    'arrivedFeeMinDays',
    'driverFreeReassignHoursBeforePickup',
    'driverPenaltyHoursBeforePickup',
    'driverMidPenaltyAmount',
    'driverPenaltyAmount',
    'driverPriorityPenaltyPoints',
  ];
  for (const key of numericKeys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      merged[key] = value;
    }
  }

  merged.beforeWindowFeeType = normaliseFeeType(
    raw.beforeWindowFeeType,
    merged.beforeWindowFeeType,
  );
  merged.preArrivalFeeType = normaliseFeeType(
    raw.preArrivalFeeType,
    merged.preArrivalFeeType,
  );
  merged.arrivedFeeType = normaliseFeeType(
    raw.arrivedFeeType,
    merged.arrivedFeeType,
  );
  merged.driverMidPenaltyType = normaliseFeeType(
    raw.driverMidPenaltyType,
    merged.driverMidPenaltyType,
  );
  merged.driverPenaltyType = normaliseFeeType(
    raw.driverPenaltyType,
    merged.driverPenaltyType,
  );

  // ── Legacy field mapping (only used when the modern key is absent on
  // the saved doc, so admin edits via the new shape always win). ──
  if (raw.preArrivalFeeAmount == null && typeof raw.preArrivalFeePercent === 'number') {
    merged.preArrivalFeeType = 'percentage';
    merged.preArrivalFeeAmount = nonNeg(raw.preArrivalFeePercent);
  }
  if (raw.arrivedFeeAmount == null && typeof raw.arrivedFeePercent === 'number') {
    merged.arrivedFeeType = 'percentage';
    merged.arrivedFeeAmount = nonNeg(raw.arrivedFeePercent);
  }
  if (
    raw.driverMidPenaltyAmount == null &&
    typeof raw.driverMidTierPenaltyAmount === 'number'
  ) {
    merged.driverMidPenaltyType = 'flat';
    merged.driverMidPenaltyAmount = nonNeg(raw.driverMidTierPenaltyAmount);
  }

  if (merged.beforeWindowFeeType === 'percentage') {
    merged.beforeWindowFeeAmount = clampPct(merged.beforeWindowFeeAmount);
  }
  if (merged.preArrivalFeeType === 'percentage') {
    merged.preArrivalFeeAmount = clampPct(merged.preArrivalFeeAmount);
  }
  if (merged.arrivedFeeType === 'percentage') {
    merged.arrivedFeeAmount = clampPct(merged.arrivedFeeAmount);
  }
  if (merged.driverMidPenaltyType === 'percentage') {
    merged.driverMidPenaltyAmount = clampPct(merged.driverMidPenaltyAmount);
  }
  if (merged.driverPenaltyType === 'percentage') {
    merged.driverPenaltyAmount = clampPct(merged.driverPenaltyAmount);
  }
  return merged;
}

/**
 * Resolve a fee `{ type, amount }` pair into an absolute rupee figure
 * against the given `basis`. Flat returns the amount as-is, percentage
 * clamps the amount to [0, 100] and applies it to `basis`. Caller is
 * responsible for the upstream cap (fee ≤ paid).
 */
function resolveFee(type, amount, basis) {
  const value = nonNeg(amount);
  if (type === 'percentage') {
    return (nonNeg(basis) * clampPct(value)) / 100;
  }
  return value;
}

/**
 * Pull the relevant amounts from a persisted booking.
 *
 *   paid       what the customer actually paid (basis for the deduction)
 *   fareTotal  full quoted fare (== paid for the wallet-paid flow)
 *   dailyRate  per-day base from the fare snapshot — used as the floor
 *              for the arrived-stage fee
 */
function readBookingAmounts(booking) {
  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);
  const fareTotal = round2(Number(booking?.fareSnapshot?.total) || 0);
  const dailyRate = round2(
    Number(booking?.fareSnapshot?.breakdown?.dailyRate) || 0,
  );
  return { paid, fareTotal, dailyRate };
}

/**
 * Hours from `now` until the outstation pickup. Returns `Infinity`
 * when the booking has no `pickupAt` (defensive — never blocks).
 */
export function hoursUntilOutstationPickup(booking, now = new Date()) {
  const pickupAt =
    booking?.outstation?.pickupAt || booking?.outstation?.startDate;
  if (!pickupAt) return Infinity;
  const ms = new Date(pickupAt).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return Infinity;
  return ms / (60 * 60 * 1000);
}

/**
 * Pick the matching customer tier given the booking + policy + clock.
 * Pure helper — used by both the empty-paid early-out and the main
 * fee-resolution path so the tier label always agrees with the formula.
 */
function resolveUserTier({ driverArrived, hoursUntilPickup, policy }) {
  if (driverArrived) return OUTSTATION_USER_CANCEL_TIER.DRIVER_ARRIVED;
  if (hoursUntilPickup > policy.freeCancellationHoursBeforePickup) {
    return OUTSTATION_USER_CANCEL_TIER.BEFORE_FREE_WINDOW;
  }
  return OUTSTATION_USER_CANCEL_TIER.WITHIN_FREE_WINDOW_PRE_ARRIVAL;
}

/**
 * Compute the customer-side outstation cancellation breakdown.
 *
 * Returns:
 *   { feeCharged, refundAmount, tier, hoursUntilPickup,
 *     driverArrived, tripStarted, basis }
 *
 * Validation guarantees:
 *   - feeCharged ≤ paid (never over-charge)
 *   - refundAmount ≥ 0 (never negative)
 *   - The daily-rate floor (`arrivedFeeMinDays × dailyRate`) applies
 *     ONLY when the driver has arrived (tier C).
 */
export function computeOutstationUserCancellation(
  booking,
  policy,
  now = new Date(),
) {
  const cfg = normaliseOutstationPolicy(policy);
  const status = booking?.status;
  const tripStarted = status === BOOKING_STATUS.STARTED;
  // STARTED rolls into the driver-arrived tier — the car is at/past
  // the pickup so we apply the same arrived-stage fee. Single path.
  const driverArrived =
    status === BOOKING_STATUS.ARRIVED || tripStarted;
  const hoursUntilPickup = hoursUntilOutstationPickup(booking, now);
  const { paid, fareTotal, dailyRate } = readBookingAmounts(booking);

  const tier = resolveUserTier({ driverArrived, hoursUntilPickup, policy: cfg });

  if (paid <= 0) {
    return {
      feeCharged: 0,
      refundAmount: 0,
      tier,
      hoursUntilPickup: Number.isFinite(hoursUntilPickup)
        ? round2(hoursUntilPickup)
        : null,
      driverArrived,
      tripStarted,
      basis: { paid, fareTotal, dailyRate, policy: cfg },
    };
  }

  let rawFee = 0;
  if (tier === OUTSTATION_USER_CANCEL_TIER.DRIVER_ARRIVED) {
    const baseFee = resolveFee(cfg.arrivedFeeType, cfg.arrivedFeeAmount, paid);
    // Daily-rate floor applies ONLY at the arrived tier per the policy
    // spec. The floor is intentionally NOT clamped by `paid` here —
    // the upstream Math.min(rawFee, paid) does that.
    const minDaysPart = nonNeg(cfg.arrivedFeeMinDays) * dailyRate;
    rawFee = Math.max(baseFee, minDaysPart);
  } else if (tier === OUTSTATION_USER_CANCEL_TIER.WITHIN_FREE_WINDOW_PRE_ARRIVAL) {
    rawFee = resolveFee(cfg.preArrivalFeeType, cfg.preArrivalFeeAmount, paid);
  } else {
    rawFee = resolveFee(cfg.beforeWindowFeeType, cfg.beforeWindowFeeAmount, paid);
  }

  const feeCharged = round2(Math.min(round2(rawFee), paid));
  const refundAmount = round2(Math.max(0, paid - feeCharged));

  return {
    feeCharged,
    refundAmount,
    tier,
    hoursUntilPickup: Number.isFinite(hoursUntilPickup)
      ? round2(hoursUntilPickup)
      : null,
    driverArrived,
    tripStarted,
    basis: { paid, fareTotal, dailyRate, policy: cfg },
  };
}

/**
 * Driver-side outstation cancellation breakdown.
 *
 * Returns:
 *   { driverPenalty, fullPenalty, penaltyWaived, tier,
 *     hoursUntilPickup, priorityPenaltyPoints, shouldReassign,
 *     trackRepeated, tripStarted, policy }
 *
 * `shouldReassign` is true when the booking should be re-queued for
 * another driver (free-reassign + mid-tier + penalty-window paths).
 * Only `tripStarted` (driver bailed mid-ride) terminates the booking.
 *
 * Driver penalty is computed against the booking's fare total when
 * type is 'percentage' (using the full quoted fare as the basis is
 * cleaner than the paid amount, which can change after extensions).
 */
export function computeOutstationDriverCancellation(
  booking,
  policy,
  now = new Date(),
) {
  const cfg = normaliseOutstationPolicy(policy);
  const hoursUntilPickup = hoursUntilOutstationPickup(booking, now);
  const tripStarted = booking?.status === BOOKING_STATUS.STARTED;
  const { fareTotal } = readBookingAmounts(booking);
  const fullPenalty = round2(
    resolveFee(cfg.driverPenaltyType, cfg.driverPenaltyAmount, fareTotal),
  );
  const midPenalty = round2(
    resolveFee(cfg.driverMidPenaltyType, cfg.driverMidPenaltyAmount, fareTotal),
  );
  const priorityPoints = nonNeg(cfg.driverPriorityPenaltyPoints);

  let tier;
  let driverPenalty;
  let shouldReassign;
  let trackRepeated;
  let priorityPenaltyPoints;

  if (tripStarted) {
    // Mid-ride driver cancel — always punitive, no reassignment.
    tier = OUTSTATION_DRIVER_CANCEL_TIER.PENALTY_WINDOW;
    driverPenalty = fullPenalty;
    shouldReassign = false;
    trackRepeated = true;
    priorityPenaltyPoints = priorityPoints;
  } else if (hoursUntilPickup > cfg.driverFreeReassignHoursBeforePickup) {
    tier = OUTSTATION_DRIVER_CANCEL_TIER.FREE_REASSIGN;
    driverPenalty = 0;
    shouldReassign = true;
    trackRepeated = false;
    priorityPenaltyPoints = 0;
  } else if (hoursUntilPickup > cfg.driverPenaltyHoursBeforePickup) {
    tier = OUTSTATION_DRIVER_CANCEL_TIER.MID_TIER;
    driverPenalty = midPenalty;
    shouldReassign = true;
    trackRepeated = false;
    priorityPenaltyPoints = 0;
  } else {
    tier = OUTSTATION_DRIVER_CANCEL_TIER.PENALTY_WINDOW;
    driverPenalty = fullPenalty;
    shouldReassign = true;
    trackRepeated = true;
    priorityPenaltyPoints = priorityPoints;
  }

  return {
    driverPenalty: round2(driverPenalty),
    fullPenalty,
    penaltyWaived: driverPenalty === 0 && fullPenalty > 0,
    tier,
    hoursUntilPickup: Number.isFinite(hoursUntilPickup)
      ? round2(hoursUntilPickup)
      : null,
    priorityPenaltyPoints,
    shouldReassign,
    trackRepeated,
    tripStarted,
    policy: cfg,
  };
}
