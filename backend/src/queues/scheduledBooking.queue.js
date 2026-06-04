import { getRedisConnection } from '../config/redis.js';
import { SCHEDULED_BOOKING } from '../constants/bookingStatus.js';

/**
 * BullMQ queue for the scheduled-ride flow.
 *
 * Three job kinds, all keyed off the booking's `scheduledStartAt`:
 *
 *   assign         (single, fires LONG_LEAD_HOURS before pickup)
 *     → flips PENDING_ASSIGNMENT → SEARCHING and kicks the wave dispatcher.
 *       Skipped (delay = 0) for morning + short-window tiers because they
 *       already searched immediately at booking creation.
 *
 *   reminder-{m}   (one per offset in REMINDER_OFFSETS_MINUTES)
 *     → emits a NOTIFICATION over socket so the user/driver app can toast
 *
 *   escalate       (single, fires EMERGENCY_POOL_MINUTES before pickup)
 *     → if no driver is assigned yet, moves the booking into the
 *       admin-managed emergency pool for manual assignment.
 *
 * Job IDs are deterministic (`assign-{bookingId}`, `escalate-{bookingId}`,
 * `reminder-{m}-{bookingId}`) so:
 *   - re-creating the same booking is idempotent (BullMQ rejects duplicates),
 *   - cancelling a booking can target & remove jobs by ID without scanning.
 *
 * Falls back to a no-op when Redis is not configured. Callers should treat
 * `enqueueScheduledBookingJobs` and `removeScheduledBookingJobs` as
 * fire-and-forget — they never throw on transport failure; they log and
 * return false so the booking-create path keeps moving.
 */

export const SCHEDULED_BOOKING_QUEUE_NAME = 'scheduled-booking';

export const SCHEDULED_JOB_NAMES = Object.freeze({
  ASSIGN: 'assign',
  REMINDER: 'reminder',
  ESCALATE: 'escalate',
});

let queueInstance = null;
let dynamicBullmq = null;

/**
 * Lazily build (and cache) the singleton Queue. Returns `null` when Redis
 * is not available, in which case the rest of the module degrades to no-ops.
 */
export async function getScheduledBookingQueue() {
  if (queueInstance) return queueInstance;
  const connection = await getRedisConnection();
  if (!connection) return null;
  try {
    if (!dynamicBullmq) {
      dynamicBullmq = await import('bullmq');
    }
    queueInstance = new dynamicBullmq.Queue(SCHEDULED_BOOKING_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        // Keep a tail of completed jobs for ops debugging without ballooning
        // Redis. Failures are kept longer so we can investigate them.
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
        // Worker handlers are idempotent — a couple of retries is fine.
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    });
    return queueInstance;
  } catch (err) {
    console.warn('[scheduledBooking] failed to create queue:', err?.message || err);
    return null;
  }
}

function jobIdFor(kind, bookingId, minutesAhead) {
  if (kind === SCHEDULED_JOB_NAMES.ASSIGN) return `assign-${String(bookingId)}`;
  if (kind === SCHEDULED_JOB_NAMES.ESCALATE) return `escalate-${String(bookingId)}`;
  return `reminder-${minutesAhead}-${String(bookingId)}`;
}

/**
 * Enqueue the assignment kickoff + escalation + reminder jobs for a
 * scheduled booking. Idempotent — re-calling for the same booking ID is
 * safe (BullMQ silently drops duplicate job IDs).
 *
 * Past-due jobs (e.g. user books only 45 min before pickup → the 60-min
 * reminder is already in the past) are skipped silently.
 *
 * @param {{ _id: any, serviceType: string, hourly?: { scheduledStartAt: Date|string|null } }} booking
 * @returns {Promise<boolean>} true if at least one job was enqueued
 */
export async function enqueueScheduledBookingJobs(booking) {
  const queue = await getScheduledBookingQueue();
  if (!queue) return false;
  const bookingId = String(booking?._id || '');
  const start = booking?.hourly?.scheduledStartAt
    ? new Date(booking.hourly.scheduledStartAt).getTime()
    : 0;
  if (!bookingId || !start) return false;
  const now = Date.now();

  // Load the admin-configurable tiered dispatch knobs for this service type.
  let config = SCHEDULED_BOOKING;
  if (booking.serviceType) {
    try {
      const { default: ServicePricing } = await import('../models/servicePricing.model.js');
      const pricing = await ServicePricing.findOne({ serviceType: booking.serviceType })
        .select('scheduledDispatch')
        .lean();
      if (pricing?.scheduledDispatch) {
        config = { ...SCHEDULED_BOOKING, ...pricing.scheduledDispatch };
      }
    } catch (err) {
      console.warn(
        '[scheduledBooking] failed to fetch pricing for dispatch config, using defaults:',
        err?.message,
      );
    }
  }

  const tasks = [];

  // Three-tier assignment delay (mirrors decideScheduleTier).
  const hoursUntilStart = (start - now) / 3_600_000;
  const startHour = new Date(start).getHours();
  const isMorning =
    startHour >= config.MORNING_START_HOUR && startHour < config.MORNING_END_HOUR;

  let assignDelay = 0;
  if (!isMorning && hoursUntilStart > config.SHORT_WINDOW_HOURS) {
    const assignAt = start - config.LONG_LEAD_HOURS * 3_600_000;
    assignDelay = Math.max(0, assignAt - now);
  }

  tasks.push(
    queue.add(
      SCHEDULED_JOB_NAMES.ASSIGN,
      { bookingId, scheduledStartAt: new Date(start).toISOString() },
      {
        jobId: jobIdFor(SCHEDULED_JOB_NAMES.ASSIGN, bookingId),
        delay: assignDelay,
      },
    ),
  );

  // Escalate to emergency pool (no-op for past-due, e.g. user books
  // within the emergency window — escalate immediately in that case).
  const escalateAt = start - config.EMERGENCY_POOL_MINUTES * 60_000;
  const escalateDelay = Math.max(0, escalateAt - now);
  tasks.push(
    queue.add(
      SCHEDULED_JOB_NAMES.ESCALATE,
      { bookingId, scheduledStartAt: new Date(start).toISOString() },
      {
        jobId: jobIdFor(SCHEDULED_JOB_NAMES.ESCALATE, bookingId),
        delay: escalateDelay,
      },
    ),
  );

  for (const minutesAhead of SCHEDULED_BOOKING.REMINDER_OFFSETS_MINUTES) {
    const fireAt = start - minutesAhead * 60_000;
    if (fireAt <= now) continue;
    tasks.push(
      queue.add(
        SCHEDULED_JOB_NAMES.REMINDER,
        {
          bookingId,
          minutesAhead,
          scheduledStartAt: new Date(start).toISOString(),
        },
        {
          jobId: jobIdFor(SCHEDULED_JOB_NAMES.REMINDER, bookingId, minutesAhead),
          delay: fireAt - now,
        },
      ),
    );
  }

  try {
    await Promise.all(tasks);
    return true;
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to enqueue jobs for booking',
      bookingId,
      err?.message || err,
    );
    return false;
  }
}

/**
 * Remove every queued job for a booking. Called from every cancellation
 * path so a cancelled booking never wakes back up. Best-effort.
 */
export async function removeScheduledBookingJobs(bookingId) {
  const queue = await getScheduledBookingQueue();
  if (!queue || !bookingId) return false;
  const ids = [
    jobIdFor(SCHEDULED_JOB_NAMES.ASSIGN, bookingId),
    jobIdFor(SCHEDULED_JOB_NAMES.ESCALATE, bookingId),
    ...SCHEDULED_BOOKING.REMINDER_OFFSETS_MINUTES.map((m) =>
      jobIdFor(SCHEDULED_JOB_NAMES.REMINDER, bookingId, m),
    ),
  ];
  try {
    await Promise.all(
      ids.map(async (id) => {
        const job = await queue.getJob(id);
        if (job) await job.remove();
      }),
    );
    return true;
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to remove jobs for booking',
      String(bookingId),
      err?.message || err,
    );
    return false;
  }
}
