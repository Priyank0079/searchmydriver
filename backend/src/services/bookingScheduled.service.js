import Booking from '../models/booking.model.js';
import ServicePricing from '../models/servicePricing.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  BOOKING_STATUS,
  SCHEDULED_BOOKING,
} from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToBooking,
  emitToAdmins,
} from '../utils/socketEmitters.js';
import { dispatchNextDriverService } from './bookingDispatch.service.js';
import {
  enqueueScheduledBookingJobs,
  removeScheduledBookingJobs,
} from '../queues/scheduledBooking.queue.js';

/**
 * Scheduled-booking lifecycle service.
 *
 *   ┌─ createBookingService (booking.service.js) ──┐
 *   │  instant   → dispatch immediately            │
 *   │  scheduled → decideScheduleTier              │
 *   │              ├─ morning      → search now    │
 *   │              ├─ short_window → search now    │
 *   │              └─ long_lead    → PENDING_ASSIGNMENT
 *   │                                + enqueue assign+escalate+reminders
 *   └──────────────────────────────────────────────┘
 *
 *   ┌─ Worker (queues/scheduledBooking.worker.js) ─┐
 *   │  assign    → kickoffScheduledAssignment      │
 *   │  reminder  → sendScheduledReminder            │
 *   │  escalate  → escalateToEmergencyPool          │
 *   └──────────────────────────────────────────────┘
 *
 * All public helpers are best-effort: they log and resolve on failure so
 * a stuck queue never crashes the booking pipeline.
 */

/**
 * Merge the admin-tunable `ServicePricing.scheduledDispatch` overrides
 * onto the hard-coded defaults. Returns the same shape regardless of
 * whether pricing exists for the service yet.
 */
export async function loadScheduledDispatchConfig(serviceType) {
  if (!serviceType) return { ...SCHEDULED_BOOKING };
  try {
    const pricing = await ServicePricing.findOne({ serviceType })
      .select('scheduledDispatch')
      .lean();
    return { ...SCHEDULED_BOOKING, ...(pricing?.scheduledDispatch || {}) };
  } catch (err) {
    console.warn(
      '[bookingScheduled] failed to load pricing for',
      serviceType,
      err?.message,
    );
    return { ...SCHEDULED_BOOKING };
  }
}

/**
 * Pure decision: should this scheduled ride search for a driver
 * immediately, or sit in PENDING_ASSIGNMENT until the assign-job fires?
 *
 *   morning           → start hour ∈ [MORNING_START_HOUR, MORNING_END_HOUR)
 *                       AND pickup is TODAY/TOMORROW (calendar-day
 *                       diff ≤ 1)
 *                       → search immediately so drivers can plan their day.
 *   morning_lead      → morning ride scheduled for the day-after-tomorrow
 *                       or later → defer to LEAD_SCHEDULE_HOUR (default
 *                       6 PM) the EVENING BEFORE pickup so drivers see
 *                       morning gigs the night before.
 *   short_window      → hoursUntilStart ≤ SHORT_WINDOW_HOURS
 *                       → search immediately.
 *   long_lead         → otherwise; defer to (start − LONG_LEAD_HOURS).
 *
 * Returns `{ tier, immediate, assignAt, escalateAt }`.
 *
 * `assignAt` is `null` when `immediate` is true (the dispatcher runs at
 * booking-creation time). `escalateAt` is always populated so the
 * emergency-pool safety net runs even when the initial search fails.
 */
export function decideScheduleTier(scheduledStartAt, now, config) {
  const start = new Date(scheduledStartAt);
  const startMs = start.getTime();
  const nowDate = now instanceof Date ? now : new Date(Number(now) || Date.now());
  const nowMs = nowDate.getTime();
  const hoursUntilStart = (startMs - nowMs) / 3_600_000;
  const startHour = start.getHours();

  const cfg = { ...SCHEDULED_BOOKING, ...(config || {}) };
  const escalateAt = new Date(startMs - cfg.EMERGENCY_POOL_MINUTES * 60_000);

  // Whole-day diff between today and pickup day (local midnight buckets).
  // Same day = 0, tomorrow = 1, day-after-tomorrow = 2 …
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const nowMidnight = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const daysAhead = Math.round((startMidnight - nowMidnight) / 86_400_000);

  const isMorning =
    startHour >= cfg.MORNING_START_HOUR && startHour < cfg.MORNING_END_HOUR;

  if (isMorning) {
    // Morning ride for today or tomorrow → search now.
    if (daysAhead <= 1) {
      return { tier: 'morning', immediate: true, assignAt: null, escalateAt };
    }
    // Morning ride further out → fire the assign job at LEAD_SCHEDULE_HOUR
    // (e.g. 6 PM) on the calendar day BEFORE pickup. Clamp into the
    // future so a booking made past the deadline still gets a job.
    const dayBefore = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() - 1,
      cfg.LEAD_SCHEDULE_HOUR,
      0,
      0,
      0,
    );
    let assignAt = dayBefore;
    if (assignAt.getTime() <= nowMs) {
      // The configured lead-hour has already passed today (e.g. user
      // booked at 11 PM for a 7 AM pickup tomorrow morning, but
      // somehow daysAhead > 1 ⇒ rare clock skew). Fall back to
      // LONG_LEAD_HOURS as a safety net.
      assignAt = new Date(startMs - cfg.LONG_LEAD_HOURS * 3_600_000);
    }
    return { tier: 'morning_lead', immediate: false, assignAt, escalateAt };
  }

  if (hoursUntilStart <= cfg.SHORT_WINDOW_HOURS) {
    return { tier: 'short_window', immediate: true, assignAt: null, escalateAt };
  }
  const assignAt = new Date(startMs - cfg.LONG_LEAD_HOURS * 3_600_000);
  return { tier: 'long_lead', immediate: false, assignAt, escalateAt };
}

/**
 * Called from `createBookingService` once the booking row exists.
 *
 *   - Persists the decision (`scheduled.tier`, `assignAt`, `escalateAt`).
 *   - Enqueues the assign + escalate + reminder jobs (best-effort).
 *   - If we're inside the "search now" tier, the caller still kicks off
 *     dispatch directly — this helper does NOT call the dispatcher.
 *     That keeps the create flow consistent across instant + scheduled.
 *
 * Returns the merged `decision` object so the caller can react.
 */
export async function setupScheduledBooking(booking) {
  if (!booking?.hourly?.scheduledStartAt) {
    throw new ApiError(400, 'Scheduled booking requires hourly.scheduledStartAt');
  }
  const config = await loadScheduledDispatchConfig(booking.serviceType);
  const decision = decideScheduleTier(
    booking.hourly.scheduledStartAt,
    new Date(),
    config,
  );

  booking.scheduled = {
    ...(booking.scheduled?.toObject?.() || booking.scheduled || {}),
    tier: decision.tier,
    assignAt: decision.assignAt,
    escalateAt: decision.escalateAt,
  };
  if (!decision.immediate) {
    booking.status = BOOKING_STATUS.PENDING_ASSIGNMENT;
  }
  await booking.save();

  // Fire-and-forget — queue may be a no-op when Redis isn't configured.
  enqueueScheduledBookingJobs(booking).catch((err) => {
    console.warn(
      '[bookingScheduled] enqueue failed for',
      String(booking._id),
      err?.message,
    );
  });

  return decision;
}

/**
 * Worker handler for the `assign` job. Flips PENDING_ASSIGNMENT →
 * SEARCHING and hands the booking to the standard wave dispatcher.
 *
 * Idempotent — re-running for a booking that has already moved past
 * PENDING_ASSIGNMENT is a no-op (so duplicate job firings are safe).
 */
export async function kickoffScheduledAssignment(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { ok: false, reason: 'not_found' };
  if (booking.status !== BOOKING_STATUS.PENDING_ASSIGNMENT) {
    return { ok: false, reason: 'not_pending_assignment', status: booking.status };
  }

  booking.status = BOOKING_STATUS.SEARCHING;
  booking.scheduled = {
    ...(booking.scheduled?.toObject?.() || booking.scheduled || {}),
    assignmentStartedAt: new Date(),
  };
  await booking.save();

  const updatePayload = {
    bookingId: String(booking._id),
    status: booking.status,
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, updatePayload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, updatePayload);
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, updatePayload);

  try {
    await dispatchNextDriverService(booking._id);
  } catch (err) {
    console.warn(
      '[bookingScheduled] initial dispatch failed for',
      String(booking._id),
      err?.message,
    );
  }
  return { ok: true };
}

/**
 * Worker handler for the `reminder-{m}` jobs. Pushes an in-app toast to
 * the user (and, once a driver is on the booking, to the driver too).
 *
 * Reminders are skipped silently for bookings that have already
 * terminated (cancelled / completed / no-drivers-found).
 */
export async function sendScheduledReminder(bookingId, minutesAhead) {
  const booking = await Booking.findById(bookingId).select(
    'status userId driverId hourly bookingNumber',
  );
  if (!booking) return { ok: false, reason: 'not_found' };
  if (
    [
      BOOKING_STATUS.CANCELLED,
      BOOKING_STATUS.COMPLETED,
      BOOKING_STATUS.NO_DRIVERS_FOUND,
    ].includes(booking.status)
  ) {
    return { ok: false, reason: 'terminal_status' };
  }

  const payload = {
    bookingId: String(booking._id),
    bookingNumber: booking.bookingNumber,
    minutesAhead: Number(minutesAhead) || 0,
    scheduledStartAt: booking.hourly?.scheduledStartAt || null,
  };
  emitToUser(booking.userId, S2C_EVENTS.NOTIFICATION, {
    title: 'Scheduled ride reminder',
    body: `Your ride starts in ${payload.minutesAhead} minutes.`,
    severity: 'info',
    data: payload,
  });
  if (booking.driverId) {
    emitToBooking(booking._id, S2C_EVENTS.NOTIFICATION, {
      title: 'Upcoming pickup',
      body: `Pickup in ${payload.minutesAhead} minutes.`,
      severity: 'info',
      data: payload,
    });
  }
  return { ok: true };
}

/**
 * Cancel every queued job for a booking. Re-exported here so callers
 * outside the queue module don't need to know about BullMQ.
 */
export async function cancelScheduledBookingJobs(bookingId) {
  if (!bookingId) return false;
  return removeScheduledBookingJobs(bookingId);
}
