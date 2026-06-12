import ServicePricing from '../models/servicePricing.model.js';
import { BOOKING_STATUS } from '../constants/bookingStatus.js';
import { SERVICE_TYPES } from '../constants/serviceTypes.js';
import {
  DEFAULT_OUTSTATION_POLICY,
  computeOutstationDriverCancellation,
  computeOutstationUserCancellation,
  normaliseOutstationPolicy,
} from './bookingOutstationCancellation.service.js';

/**
 * Cancellation-fee computation.
 *
 * The fee depends on how far the booking has progressed:
 *
 *   status                                  →  customer fee
 *   ──────                                     ───────────
 *   searching                                 0  (no driver mobilised yet)
 *   driver_assigned / awaiting_payment /
 *   en_route (driver heading to pickup)       flat ₹ `flatFeeAfterAssignment`
 *   arrived / started (driver at pickup +)    `arrivedFeeType` decides:
 *                                               'flat'       → ₹ `arrivedFeeAmount`
 *                                               'percentage' → `arrivedFeeAmount`% of paid
 *
 * Whatever the customer is charged is then split between the driver
 * who was mobilised and the platform per
 * `cancellation.driverSharePercent`:
 *
 *   driverShare  = feeCharged × driverSharePercent / 100   → driver wallet
 *   companyShare = feeCharged − driverShare                → platform revenue
 *
 * All knobs live on `ServicePricing.cancellation` and are tunable from
 * the admin pricing editor.
 *
 * Driver penalty is a flat ₹ amount (`driverCancellationPenalty`) and
 * is debited from `driver.wallet.balance` when a driver cancels.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/** Defaults that mirror the schema — used when no pricing doc exists yet. */
const DEFAULT_POLICY = Object.freeze({
  flatFeeAfterAssignment: 100,
  arrivedFeeType: 'flat',
  arrivedFeeAmount: 250,
  driverSharePercent: 0,
  driverCancellationPenalty: 50,
  driverGraceMinutes: 2,
  driverDailyFreeCancellations: 3,
  outstation: DEFAULT_OUTSTATION_POLICY,
});

/**
 * Statuses where the driver has been dispatched but hasn't physically
 * arrived at the pickup yet → flat mobilisation fee applies.
 */
const ASSIGNED_PRE_ARRIVAL_STATUSES = new Set([
  BOOKING_STATUS.DRIVER_ASSIGNED,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.EN_ROUTE,
]);

/**
 * Statuses where the driver has reached the pickup (or beyond) →
 * percentage-of-paid fee applies.
 */
const ARRIVED_OR_LATER_STATUSES = new Set([
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.STARTED,
]);

/**
 * Look up the cancellation knobs for the booking's service. Falls back to
 * the schema defaults if no `ServicePricing` doc is configured yet
 * (otherwise a missing config silently turns every cancel into "free").
 */
export async function loadCancellationPolicy(serviceType) {
  if (!serviceType) return { ...DEFAULT_POLICY };
  const pricing = await ServicePricing.findOne({
    serviceType,
    isActive: true,
  }).lean();
  const cfg = pricing?.cancellation || {};
  // Type of the arrived-stage fee. Falls back to the legacy
  // `arrivedFeePercent` knob (interpreting it as 'percentage' if
  // someone set it on an older doc), then to 'flat'.
  const arrivedFeeType =
    cfg.arrivedFeeType === 'percentage' || cfg.arrivedFeeType === 'flat'
      ? cfg.arrivedFeeType
      : Number(cfg.arrivedFeePercent) > 0
        ? 'percentage'
        : DEFAULT_POLICY.arrivedFeeType;
  // Amount of the arrived-stage fee. Prefers the new `arrivedFeeAmount`,
  // else legacy `flatFeeAfterArrival` (flat) / `arrivedFeePercent` (%).
  const arrivedFeeAmount =
    typeof cfg.arrivedFeeAmount === 'number'
      ? cfg.arrivedFeeAmount
      : arrivedFeeType === 'percentage'
        ? Number(cfg.arrivedFeePercent) || DEFAULT_POLICY.arrivedFeeAmount
        : Number(cfg.flatFeeAfterArrival) || DEFAULT_POLICY.arrivedFeeAmount;
  return {
    flatFeeAfterAssignment:
      typeof cfg.flatFeeAfterAssignment === 'number'
        ? cfg.flatFeeAfterAssignment
        : DEFAULT_POLICY.flatFeeAfterAssignment,
    arrivedFeeType,
    arrivedFeeAmount,
    driverSharePercent:
      typeof cfg.driverSharePercent === 'number'
        ? clampPct(cfg.driverSharePercent)
        : DEFAULT_POLICY.driverSharePercent,
    driverCancellationPenalty:
      typeof cfg.driverCancellationPenalty === 'number'
        ? cfg.driverCancellationPenalty
        : DEFAULT_POLICY.driverCancellationPenalty,
    driverGraceMinutes:
      typeof cfg.driverGraceMinutes === 'number'
        ? Math.max(0, cfg.driverGraceMinutes)
        : DEFAULT_POLICY.driverGraceMinutes,
    driverDailyFreeCancellations:
      typeof cfg.driverDailyFreeCancellations === 'number'
        ? Math.max(0, cfg.driverDailyFreeCancellations)
        : DEFAULT_POLICY.driverDailyFreeCancellations,
    // Outstation has its own TIME-driven policy. Always present (filled
    // with the schema defaults when the admin hasn't customised it) so
    // every downstream caller can read `policy.outstation.<knob>`
    // without a presence check.
    outstation: normaliseOutstationPolicy(cfg.outstation),
  };
}

/**
 * Split a customer-charged cancellation fee into the driver's share
 * (credited to the assigned driver's wallet) and the platform's share
 * (logged on the PlatformRevenue ledger). Pure — no DB side-effects.
 *
 * Sum is preserved exactly: `driverShare + companyShare === feeCharged`
 * regardless of rounding.
 */
export function splitCancellationFee(feeCharged, policy) {
  const fee = round2(Math.max(0, Number(feeCharged) || 0));
  if (fee <= 0) return { driverShare: 0, companyShare: 0 };
  const pct = clampPct(policy?.driverSharePercent);
  const driverShare = round2((fee * pct) / 100);
  const companyShare = round2(Math.max(0, fee - driverShare));
  return { driverShare, companyShare };
}

/**
 * Compute the user-side cancellation breakdown.
 *
 *   status pre-DRIVER_ASSIGNED  → fee = 0, refund = paid
 *   driver assigned/en-route    → fee = flatFeeAfterAssignment (₹)
 *   arrived/started             → fee = `arrivedFeeType` controlled
 *
 * Fees are clamped to the paid amount so unpaid bookings always settle
 * at fee = 0, refund = 0.
 *
 * `tripStarted` and `driverArrived` are reported alongside so the UI
 * copy can branch (e.g. "the driver has reached pickup — cancelling
 * now will retain ₹X").
 *
 * `driverShare` and `companyShare` are returned for callers that need
 * to wire the wallet credit + platform-revenue ledger entries (the
 * cancellation handler in `booking.service.js` does this). They sum
 * exactly to `feeCharged`.
 */
export function computeUserCancellation(booking, policy) {
  // Outstation runs on a TIME-driven policy that's wildly different
  // from the hourly STATUS-driven one. We branch here so the existing
  // hourly call-sites keep working untouched.
  if (booking?.serviceType === SERVICE_TYPES.OUTSTATION) {
    const outstation = computeOutstationUserCancellation(
      booking,
      policy?.outstation,
    );
    const { driverShare, companyShare } = splitCancellationFee(
      outstation.feeCharged,
      policy,
    );
    return {
      ...outstation,
      driverShare,
      companyShare,
    };
  }

  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);
  const status = booking?.status;
  const tripStarted = status === BOOKING_STATUS.STARTED;
  const driverArrived =
    status === BOOKING_STATUS.ARRIVED || status === BOOKING_STATUS.STARTED;

  if (paid <= 0) {
    return {
      feeCharged: 0,
      refundAmount: 0,
      driverShare: 0,
      companyShare: 0,
      tripStarted,
      driverArrived,
    };
  }

  let rawFee = 0;
  if (ARRIVED_OR_LATER_STATUSES.has(status)) {
    const amount = Math.max(0, Number(policy?.arrivedFeeAmount) || 0);
    if (policy?.arrivedFeeType === 'percentage') {
      rawFee = (paid * clampPct(amount)) / 100;
    } else {
      rawFee = amount;
    }
  } else if (ASSIGNED_PRE_ARRIVAL_STATUSES.has(status)) {
    rawFee = Math.max(0, Number(policy?.flatFeeAfterAssignment) || 0);
  }
  // SEARCHING (or anything before driver assignment) → no fee.

  const fee = round2(Math.min(round2(rawFee), paid));
  const { driverShare, companyShare } = splitCancellationFee(fee, policy);
  return {
    feeCharged: fee,
    refundAmount: round2(Math.max(0, paid - fee)),
    driverShare,
    companyShare,
    tripStarted,
    driverArrived,
  };
}

/**
 * Local-day key (server TZ) used to roll the driver's daily cancellation
 * counter. Format: `YYYY-MM-DD`. Server time is sufficient — the
 * dashboard already uses the same anchor for `todaySummary.dateKey`.
 */
export function todayKey(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Decide whether a driver's cancellation falls inside the no-penalty
 * grace window. Pure — does not mutate any documents.
 *
 *   inGrace     true when `(now − acceptedAt) ≤ graceMinutes`
 *   chancesLeft today's remaining free cancellations BEFORE this one
 *   penaltyWaived  true only if BOTH `inGrace` AND `chancesLeft > 0`
 *
 * `acceptedAt` is the timestamp the dispatcher stamped on
 * `timeline.driverAssignedAt`; we treat that as "the driver picked up
 * this booking" for grace-window purposes.
 */
export function evaluateDriverCancelChance(driver, booking, policy, now = new Date()) {
  const graceMinutes = Math.max(0, Number(policy?.driverGraceMinutes) || 0);
  const dailyLimit = Math.max(0, Number(policy?.driverDailyFreeCancellations) || 0);
  const key = todayKey(now);

  const sameDay = driver?.cancellationChances?.dateKey === key;
  const usedToday = sameDay ? Math.max(0, Number(driver?.cancellationChances?.used) || 0) : 0;
  const chancesLeft = Math.max(0, dailyLimit - usedToday);

  const acceptedAt = booking?.timeline?.driverAssignedAt;
  const elapsedMs = acceptedAt ? Math.max(0, now.getTime() - new Date(acceptedAt).getTime()) : 0;
  const elapsedMinutes = elapsedMs / 60000;

  const inGrace = graceMinutes > 0 && elapsedMinutes <= graceMinutes;
  const penaltyWaived = inGrace && chancesLeft > 0;

  return {
    inGrace,
    chancesLeft,
    dailyLimit,
    usedToday,
    elapsedMinutes: round2(elapsedMinutes),
    graceMinutes,
    penaltyWaived,
    dateKey: key,
  };
}

/**
 * Compute the driver-side cancellation breakdown.
 *
 *   inGrace + chancesLeft > 0  → driverPenalty = 0 (still subtract a chance)
 *   otherwise                  → driverPenalty = policy.driverCancellationPenalty
 *
 *   Paid:   user refund mirrors `computeUserCancellation` (paid − fee).
 *   Unpaid: refund = 0 (nothing was paid).
 *
 * Caller is expected to pass `chance` (the result of
 * `evaluateDriverCancelChance`). For backwards compatibility, if `chance`
 * is omitted we apply the full penalty — no waiver — and let the caller
 * audit the decision.
 */
export function computeDriverCancellation(booking, policy, chance = null) {
  // Outstation: hours-until-pickup tiered policy, independent of the
  // hourly grace/chance model. We still surface `refundAmount` (mirror
  // of the user-side preview) so the FE shows what the customer gets.
  if (booking?.serviceType === SERVICE_TYPES.OUTSTATION) {
    const outstation = computeOutstationDriverCancellation(
      booking,
      policy?.outstation,
    );
    const userBreakdown = computeUserCancellation(booking, policy);
    return {
      ...outstation,
      refundAmount: userBreakdown.refundAmount,
    };
  }

  const paid = round2(Number(booking?.payment?.amountPaidRupees) || 0);
  const tripStarted = booking?.status === BOOKING_STATUS.STARTED;
  const fullPenalty = round2(Number(policy?.driverCancellationPenalty) || 0);
  const penaltyWaived = !!chance?.penaltyWaived;
  // Once the ride has started, the grace window no longer protects the
  // driver — there's a customer in the car. We always charge the penalty
  // in that case regardless of chances/grace.
  const driverPenalty = penaltyWaived && !tripStarted ? 0 : fullPenalty;

  if (paid <= 0) {
    return {
      driverPenalty,
      fullPenalty,
      penaltyWaived: driverPenalty === 0 && fullPenalty > 0,
      refundAmount: 0,
      tripStarted,
    };
  }
  const userBreakdown = computeUserCancellation(booking, policy);
  return {
    driverPenalty,
    fullPenalty,
    penaltyWaived: driverPenalty === 0 && fullPenalty > 0,
    refundAmount: userBreakdown.refundAmount,
    tripStarted,
  };
}

/**
 * Lightweight quote endpoint helper — what the FE shows in its
 * confirm-dialog "you'll be charged ₹X" warning. Pure read; no side
 * effects on the booking.
 *
 * Driver quote also includes the live `chance` snapshot so the FE can
 * render copy like "Free cancel — 2 chances left today" before the
 * driver taps Confirm. Pass the loaded driver document so the chance
 * counter is honoured; without it we treat chances as exhausted.
 */
export async function quoteCancellation(booking, side /* 'user' | 'driver' */, { driver } = {}) {
  if (!booking) return null;
  const policy = await loadCancellationPolicy(booking.serviceType);
  if (side === 'driver') {
    const chance = evaluateDriverCancelChance(driver, booking, policy);
    return {
      side,
      policy,
      chance,
      ...computeDriverCancellation(booking, policy, chance),
    };
  }
  return {
    side: 'user',
    policy,
    ...computeUserCancellation(booking, policy),
  };
}
