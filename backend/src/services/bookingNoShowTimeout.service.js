import Booking from '../models/booking.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import ServicePricing from '../models/servicePricing.model.js';
import PlatformRevenue, {
  PLATFORM_REVENUE_SOURCE,
} from '../models/platformRevenue.model.js';
import { BOOKING_STATUS } from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToDriver,
  emitToBooking,
} from '../utils/socketEmitters.js';

/**
 * No-show timer service.
 *
 * Two-phase in-process scheduler:
 *
 *   PHASE A — "are you coming?" prompt
 *     Scheduled when the driver hits ARRIVED. Fires after
 *     `waitingCharge.noShowPromptMinutes` (default 30 min). On fire it
 *     stamps `booking.noShow.promptSentAt` and emits
 *     `BOOKING_NOSHOW_PROMPT` to the user. Same call schedules PHASE B.
 *
 *   PHASE B — auto-complete (no response)
 *     Scheduled when PHASE A fires. After
 *     `waitingCharge.noShowGraceMinutes` (default 5 min) without a
 *     "yes/no" from the customer (or after an explicit "not coming"),
 *     the ride is auto-completed: the driver gets paid in full + the
 *     full waiting charge accrued since arrival, and the booking
 *     transitions to COMPLETED with `waiting.noShow = true`.
 *
 * If the customer responds:
 *   - "on_my_way"  → cancel PHASE B and reschedule PHASE A from now
 *                    for another grace cycle.
 *   - "not_coming" → fire PHASE B immediately.
 *
 * Server restart drops timers — bookings stuck mid-prompt will resume
 * on the next request that touches them via `resumeNoShowSchedule()`
 * (called from the booking fetch helpers). This is the same
 * trade-off the payment-timeout service makes.
 */

/** bookingId → { phase, handle } */
const noShowTimers = new Map();

function key(id) {
  return String(id);
}

/** Stop any pending no-show timer for this booking. Safe to call twice. */
export function cancelNoShowSchedule(bookingId) {
  const k = key(bookingId);
  const entry = noShowTimers.get(k);
  if (entry?.handle) clearTimeout(entry.handle);
  noShowTimers.delete(k);
}

/**
 * Schedule PHASE A (the "are you coming?" prompt) for a booking that
 * just hit ARRIVED. Idempotent — replaces any pending timer.
 *
 * `arrivedAt` lets the caller pass the timestamp the booking actually
 * arrived (in case the schedule is being resumed mid-cycle), so we
 * fire at the right wall-clock instant rather than always 30 min
 * from "now".
 */
export async function schedulePromptTimer(bookingId, arrivedAt = new Date()) {
  cancelNoShowSchedule(bookingId);

  const booking = await Booking.findById(bookingId)
    .select('serviceType status')
    .lean();
  if (!booking) return;
  if (booking.status !== BOOKING_STATUS.ARRIVED) return;

  const policy = await loadWaitingPolicy(booking.serviceType);
  const promptMs = Math.max(0, policy.noShowPromptMinutes) * 60_000;
  const fireAt = new Date(arrivedAt).getTime() + promptMs;
  const delay = Math.max(0, fireAt - Date.now());

  const handle = setTimeout(
    () => firePrompt(bookingId).catch((err) =>
      console.warn('[noShow] prompt fire failed:', err?.message),
    ),
    delay,
  );
  noShowTimers.set(key(bookingId), { phase: 'prompt', handle });
}

/**
 * PHASE A fire — flag the booking, ping the customer, and queue
 * PHASE B for the auto-complete deadline.
 */
async function firePrompt(bookingId) {
  noShowTimers.delete(key(bookingId));

  const booking = await Booking.findById(bookingId);
  if (!booking) return;
  if (booking.status !== BOOKING_STATUS.ARRIVED) return;
  // If the customer already said they're on the way (manual response
  // before the timer fired), respect their decision and reschedule.
  if (booking.noShow?.customerResponse === 'on_my_way') {
    return schedulePromptTimer(bookingId, new Date());
  }

  const policy = await loadWaitingPolicy(booking.serviceType);
  const now = new Date();
  const deadline = new Date(now.getTime() + policy.noShowGraceMinutes * 60_000);
  const firedFor = Number(booking.noShow?.firedFor || 0) + 1;

  booking.noShow = {
    promptSentAt: now,
    promptDeadlineAt: deadline,
    customerResponse: '',
    respondedAt: null,
    firedFor,
  };
  await booking.save();

  const payload = {
    bookingId: String(booking._id),
    promptSentAt: now,
    promptDeadlineAt: deadline,
    graceMinutes: policy.noShowGraceMinutes,
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_NOSHOW_PROMPT, payload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_NOSHOW_PROMPT, payload);

  // Schedule PHASE B for the deadline.
  const handle = setTimeout(
    () =>
      autoCompleteForNoShow(bookingId).catch((err) =>
        console.warn('[noShow] auto-complete failed:', err?.message),
      ),
    Math.max(0, deadline.getTime() - Date.now()),
  );
  noShowTimers.set(key(bookingId), { phase: 'autoComplete', handle });
}

/**
 * Customer responded "Yes, on my way". Cancels PHASE B, marks the
 * response, and reschedules PHASE A from now so we get another
 * `noShowPromptMinutes` of patience before pinging again.
 */
export async function recordCustomerOnMyWay(bookingId) {
  cancelNoShowSchedule(bookingId);
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        'noShow.customerResponse': 'on_my_way',
        'noShow.respondedAt': new Date(),
        'noShow.promptDeadlineAt': null,
      },
    },
  );
  await schedulePromptTimer(bookingId, new Date());
}

/**
 * Customer responded "No, not coming" — auto-complete immediately so
 * the driver doesn't sit there for the grace window.
 */
export async function recordCustomerNotComing(bookingId) {
  cancelNoShowSchedule(bookingId);
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        'noShow.customerResponse': 'not_coming',
        'noShow.respondedAt': new Date(),
      },
    },
  );
  await autoCompleteForNoShow(bookingId);
}

/**
 * PHASE B fire — close the booking out as a no-show completion. The
 * driver gets paid in full (per the original fare snapshot) plus any
 * waiting charge accrued since arrival.
 *
 * We mirror `completeTripService`'s side-effects: free the driver's
 * `isOnTrip`, record platform commission, broadcast the update.
 * Imports are local to avoid the cyclic init between
 * bookingTrip.service and this file.
 */
async function autoCompleteForNoShow(bookingId) {
  noShowTimers.delete(key(bookingId));

  const booking = await Booking.findById(bookingId);
  if (!booking) return;
  // Race: if the trip already started (driver entered the OTP), let
  // the normal flow take over.
  if (booking.status !== BOOKING_STATUS.ARRIVED) return;
  // Race: customer just said yes between deadline and now.
  if (booking.noShow?.customerResponse === 'on_my_way') {
    return schedulePromptTimer(bookingId, new Date());
  }

  const now = new Date();
  const arrivedAt = booking.timeline?.arrivedAt
    ? new Date(booking.timeline.arrivedAt)
    : now;

  // Stamp the waiting charge based on the full wait window.
  const policy = await loadWaitingPolicy(booking.serviceType);
  const waitedMs = Math.max(0, now.getTime() - arrivedAt.getTime());
  const waitedMinutes = Math.ceil(waitedMs / 60_000);
  const billable = Math.max(0, waitedMinutes - policy.freeWaitingMinutes);
  const charge = Math.round(billable * policy.chargePerMinute * 100) / 100;
  booking.waiting = booking.waiting || {};
  Object.assign(booking.waiting, {
    waitedMinutes,
    billableMinutes: billable,
    chargeRupees: charge,
    freeMinutes: policy.freeWaitingMinutes,
    perMinuteRupees: policy.chargePerMinute,
    noShow: true,
  });

  booking.status = BOOKING_STATUS.COMPLETED;
  booking.timeline.completedAt = now;
  booking.timeline.startedAt = booking.timeline.startedAt || arrivedAt;
  await booking.save();

  // Free the driver for new dispatches.
  if (booking.driverId) {
    Driver.updateOne({ _id: booking.driverId }, { $set: { isOnTrip: false } }).catch(
      (err) =>
        console.warn(
          '[noShow] failed to clear driver.isOnTrip on auto-complete:',
          err?.message,
        ),
    );
  }

  // Mirror normal commission-on-complete revenue write.
  const commission = Number(booking.fareSnapshot?.breakdown?.platformCommission) || 0;
  if (commission > 0) {
    try {
      await PlatformRevenue.create({
        source: PLATFORM_REVENUE_SOURCE.COMMISSION,
        amountRupees: commission,
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber || '',
        serviceType: booking.serviceType || '',
        userId: booking.userId,
        driverId: booking.driverId || null,
        meta: {
          commissionPercent:
            booking.fareSnapshot?.breakdown?.platformCommissionPercent || 0,
          totalPayable: booking.fareSnapshot?.total || 0,
          driverEarning: booking.fareSnapshot?.breakdown?.driverEarning || 0,
          noShowAutoComplete: true,
        },
      });
    } catch (err) {
      console.warn('[noShow] revenue write failed:', err?.message);
    }
  }

  const payload = {
    bookingId: String(booking._id),
    status: booking.status,
    waiting: booking.waiting,
    reason: 'no_show_auto_complete',
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, payload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, payload);
  if (booking.driverId) {
    emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_UPDATED, payload);
  }
}

/**
 * Cold-start helper. Re-attach a timer for any ARRIVED booking that
 * had its in-process timer dropped by a restart. Called opportunistically
 * from booking fetch paths so we never need a cron.
 */
export async function resumeNoShowScheduleIfNeeded(booking) {
  if (!booking) return;
  if (booking.status !== BOOKING_STATUS.ARRIVED) return;
  if (noShowTimers.has(key(booking._id))) return;
  // If we already prompted and have a deadline, resume PHASE B.
  const deadline = booking.noShow?.promptDeadlineAt;
  if (deadline) {
    const remaining = Math.max(0, new Date(deadline).getTime() - Date.now());
    const handle = setTimeout(
      () =>
        autoCompleteForNoShow(booking._id).catch((err) =>
          console.warn('[noShow] resumed auto-complete failed:', err?.message),
        ),
      remaining,
    );
    noShowTimers.set(key(booking._id), { phase: 'autoComplete', handle });
    return;
  }
  // Otherwise, resume PHASE A using the original arrivedAt anchor.
  await schedulePromptTimer(
    booking._id,
    booking.timeline?.arrivedAt || new Date(),
  );
}

/**
 * Pull the waiting-charge policy for a service, falling back to safe
 * defaults if no pricing doc exists.
 */
async function loadWaitingPolicy(serviceType) {
  const pricing = await ServicePricing.findOne({
    serviceType,
    isActive: true,
  })
    .select('waitingCharge')
    .lean();
  const w = pricing?.waitingCharge || {};
  return {
    freeWaitingMinutes: Math.max(0, Number(w.freeWaitingMinutes ?? 15)),
    chargePerMinute: Math.max(0, Number(w.chargePerMinute ?? 2)),
    noShowPromptMinutes: Math.max(1, Number(w.noShowPromptMinutes ?? 30)),
    noShowGraceMinutes: Math.max(1, Number(w.noShowGraceMinutes ?? 5)),
  };
}
