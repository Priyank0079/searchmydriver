import { getRedisConnection } from '../config/redis.js';
import { SCHEDULED_BOOKING } from '../constants/bookingStatus.js';

/**
 * BullMQ queue for the scheduled-ride flow.
 *
 * Four job kinds, all keyed off the booking's `scheduledStartAt`:
 *
 *   assign         (single, fires LONG_LEAD_HOURS / LEAD_SCHEDULE_HOUR
 *                  before pickup — see `decideScheduleTier`)
 *     → flips PENDING_ASSIGNMENT → SEARCHING and kicks the wave dispatcher.
 *       Skipped (delay = 0) for morning + short-window tiers because they
 *       already searched immediately at booking creation.
 *
 *   retry-{n}      (one per failed dispatch round, queued by
 *                  `enqueueAssignmentRetry`)
 *     → flips the booking back into SEARCHING and re-runs the wave
 *       dispatcher. We keep re-queuing this every RETRY_DELAY_MINUTES
 *       while there's still runway before `escalateAt`. When the next
 *       retry would land inside the emergency window we stop scheduling
 *       and let the `escalate` job take over.
 *
 *   reminder-{m}   (one per offset in REMINDER_OFFSETS_MINUTES)
 *     → emits a NOTIFICATION over socket so the user/driver app can
 *       toast. ONLY enqueued AFTER a driver has been assigned, via
 *       `enqueueReminderJobsForBooking` (called from
 *       `acceptBookingService` / `adminAssignDriverToEmergencyPoolService`).
 *
 *   escalate       (single, fires EMERGENCY_POOL_MINUTES before pickup)
 *     → if no driver is assigned yet, moves the booking into the
 *       admin-managed emergency pool for manual assignment.
 *
 * Job IDs are deterministic so:
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
  RETRY: 'retry',
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

function jobIdFor(kind, bookingId, qualifier) {
  if (kind === SCHEDULED_JOB_NAMES.ASSIGN) return `assign-${String(bookingId)}`;
  if (kind === SCHEDULED_JOB_NAMES.ESCALATE) return `escalate-${String(bookingId)}`;
  if (kind === SCHEDULED_JOB_NAMES.RETRY) {
    return `retry-${Number(qualifier) || 0}-${String(bookingId)}`;
  }
  return `reminder-${qualifier}-${String(bookingId)}`;
}

/**
 * Resolve the admin-tunable scheduling knobs for this service type,
 * falling back to platform defaults. Logs and degrades silently so a
 * pricing-collection outage doesn't take the queue down with it.
 */
async function loadDispatchConfig(serviceType) {
  if (!serviceType) return { ...SCHEDULED_BOOKING };
  try {
    const { default: ServicePricing } = await import('../models/servicePricing.model.js');
    const pricing = await ServicePricing.findOne({ serviceType })
      .select('scheduledDispatch')
      .lean();
    if (pricing?.scheduledDispatch) {
      return { ...SCHEDULED_BOOKING, ...pricing.scheduledDispatch };
    }
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to fetch pricing for dispatch config, using defaults:',
      err?.message,
    );
  }
  return { ...SCHEDULED_BOOKING };
}

/**
 * Enqueue the assignment kickoff + escalation jobs for a scheduled
 * booking. Idempotent — re-calling for the same booking ID is safe
 * (BullMQ silently drops duplicate job IDs).
 *
 * Reminder jobs are NOT pushed here. They're queued later — only after
 * a driver has actually been assigned — via
 * `enqueueReminderJobsForBooking`. This keeps Redis clean of reminders
 * for bookings that fizzle (no driver found / cancelled before assign).
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

  const config = await loadDispatchConfig(booking.serviceType);

  // Reuse the single source of truth for the schedule decision so the
  // queue and the booking flow can never disagree on assignAt.
  const { decideScheduleTier } = await import(
    '../services/bookingScheduled.service.js'
  );
  const decision = decideScheduleTier(new Date(start), new Date(now), config);
  const assignDelay = decision.immediate
    ? 0
    : Math.max(0, new Date(decision.assignAt).getTime() - now);

  const tasks = [
    queue.add(
      SCHEDULED_JOB_NAMES.ASSIGN,
      { bookingId, scheduledStartAt: new Date(start).toISOString() },
      {
        jobId: jobIdFor(SCHEDULED_JOB_NAMES.ASSIGN, bookingId),
        delay: assignDelay,
      },
    ),
  ];

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
 * Queue another assignment attempt for a scheduled booking whose
 * previous wave-dispatch round came back empty. Job ID embeds
 * `attemptNumber` so successive retries don't collide in BullMQ.
 *
 * Caller (`scheduleAssignmentRetryOrEscalate`) is responsible for
 * deciding whether there's still runway before `escalateAt` — this
 * helper just queues whatever it's told.
 *
 * @param {string|object} bookingId
 * @param {{ delayMs: number, attemptNumber: number, scheduledStartAt?: Date|string|null }} opts
 * @returns {Promise<boolean>}
 */
export async function enqueueAssignmentRetry(bookingId, opts = {}) {
  const queue = await getScheduledBookingQueue();
  if (!queue || !bookingId) return false;
  const bid = String(bookingId);
  const delay = Math.max(0, Number(opts.delayMs) || 0);
  const attempt = Math.max(1, Number(opts.attemptNumber) || 1);
  try {
    await queue.add(
      SCHEDULED_JOB_NAMES.RETRY,
      {
        bookingId: bid,
        attemptNumber: attempt,
        scheduledStartAt: opts.scheduledStartAt
          ? new Date(opts.scheduledStartAt).toISOString()
          : null,
      },
      {
        jobId: jobIdFor(SCHEDULED_JOB_NAMES.RETRY, bid, attempt),
        delay,
      },
    );
    return true;
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to enqueue retry for',
      bid,
      err?.message || err,
    );
    return false;
  }
}

/**
 * Queue the reminder toasts for a freshly-assigned scheduled booking.
 * Called from the accept-booking flow (and the emergency-pool manual
 * assign flow) — never at booking creation time.
 *
 * Past-due offsets (e.g. driver accepted only 10 min before pickup → the
 * 60-min reminder is already in the past) are skipped silently. Returns
 * true when at least one reminder was queued.
 *
 * @param {{ _id: any, serviceType?: string, hourly?: { scheduledStartAt: Date|string|null } }} booking
 * @returns {Promise<boolean>}
 */
export async function enqueueReminderJobsForBooking(booking) {
  const queue = await getScheduledBookingQueue();
  if (!queue) return false;
  const bookingId = String(booking?._id || '');
  const start = booking?.hourly?.scheduledStartAt
    ? new Date(booking.hourly.scheduledStartAt).getTime()
    : 0;
  if (!bookingId || !start) return false;
  const now = Date.now();

  const config = await loadDispatchConfig(booking.serviceType);
  const reminderOffsets = Array.isArray(config.REMINDER_OFFSETS_MINUTES)
    ? config.REMINDER_OFFSETS_MINUTES
    : SCHEDULED_BOOKING.REMINDER_OFFSETS_MINUTES;

  const tasks = [];
  for (const minutesAhead of reminderOffsets) {
    const offset = Number(minutesAhead);
    if (!Number.isFinite(offset) || offset <= 0) continue;
    const fireAt = start - offset * 60_000;
    if (fireAt <= now) continue;
    tasks.push(
      queue.add(
        SCHEDULED_JOB_NAMES.REMINDER,
        {
          bookingId,
          minutesAhead: offset,
          scheduledStartAt: new Date(start).toISOString(),
        },
        {
          jobId: jobIdFor(SCHEDULED_JOB_NAMES.REMINDER, bookingId, offset),
          delay: fireAt - now,
        },
      ),
    );
  }

  if (!tasks.length) return false;
  try {
    await Promise.all(tasks);
    return true;
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to enqueue reminders for booking',
      bookingId,
      err?.message || err,
    );
    return false;
  }
}

/**
 * Snapshot of every job in the scheduled-booking queue, grouped by
 * BullMQ status. Used by the admin "Scheduled Jobs" dashboard so ops
 * can see what's queued, what's running, what failed, and when the next
 * one fires.
 *
 * Falls back to `{ enabled: false, ... }` when Redis isn't wired up so
 * the admin UI can render a clear "queue disabled" empty state instead
 * of a crash. Limits are intentionally generous (admins do paginate
 * client-side) but capped so a huge queue doesn't OOM the API.
 */
export async function listScheduledBookingJobs({ limit = 200 } = {}) {
  const queue = await getScheduledBookingQueue();
  if (!queue) {
    return {
      enabled: false,
      counts: {},
      jobs: [],
      total: 0,
    };
  }
  const cap = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const states = ['delayed', 'waiting', 'active', 'failed', 'completed'];
  try {
    const counts = await queue.getJobCounts(...states);
    // Pull jobs per state with a small cap each so a chatty queue
    // doesn't blow up the response payload.
    const perState = Math.min(cap, 100);
    const buckets = await Promise.all(
      states.map((state) => queue.getJobs([state], 0, perState - 1, true)),
    );

    const rows = [];
    states.forEach((state, idx) => {
      for (const job of buckets[idx]) {
        const ts = job.timestamp || 0;
        const delay = Number(job.delay || 0);
        const nextRunAt = state === 'delayed' ? new Date(ts + delay) : null;
        rows.push({
          id: job.id,
          name: job.name,
          state,
          bookingId: job.data?.bookingId || null,
          minutesAhead: job.data?.minutesAhead ?? null,
          scheduledStartAt: job.data?.scheduledStartAt || null,
          createdAt: ts ? new Date(ts).toISOString() : null,
          nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
          processedOn: job.processedOn
            ? new Date(job.processedOn).toISOString()
            : null,
          finishedOn: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
          attemptsMade: job.attemptsMade || 0,
          failedReason: job.failedReason || null,
          delay,
        });
      }
    });

    rows.sort((a, b) => {
      // delayed jobs first, ordered by next run; everything else by
      // recency so failures don't push the live queue down.
      if (a.state === 'delayed' && b.state === 'delayed') {
        return new Date(a.nextRunAt || 0) - new Date(b.nextRunAt || 0);
      }
      if (a.state === 'delayed') return -1;
      if (b.state === 'delayed') return 1;
      const aT = new Date(a.finishedOn || a.processedOn || a.createdAt || 0).getTime();
      const bT = new Date(b.finishedOn || b.processedOn || b.createdAt || 0).getTime();
      return bT - aT;
    });

    return {
      enabled: true,
      counts: {
        delayed: counts.delayed || 0,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        failed: counts.failed || 0,
        completed: counts.completed || 0,
      },
      jobs: rows.slice(0, cap),
      total: rows.length,
    };
  } catch (err) {
    console.warn(
      '[scheduledBooking] failed to list jobs:',
      err?.message || err,
    );
    return { enabled: true, counts: {}, jobs: [], total: 0, error: err.message };
  }
}

/**
 * Remove every queued job for a booking. Called from every cancellation
 * path so a cancelled booking never wakes back up. Best-effort.
 *
 * We can't enumerate reminder offsets or retry attempts from the
 * constant any more — admins can change reminders, and retries are
 * driven by runtime dispatch outcomes — so we scan the queue's pending
 * buckets and drop anything tagged with this `bookingId` in
 * `job.data`. The fixed `assign`/`escalate` IDs are still removed by
 * hand so a reschedule that re-uses them stays idempotent.
 */
export async function removeScheduledBookingJobs(bookingId) {
  const queue = await getScheduledBookingQueue();
  if (!queue || !bookingId) return false;
  const bid = String(bookingId);
  try {
    // Static IDs (assign / escalate) for fast removal.
    const fixed = [
      jobIdFor(SCHEDULED_JOB_NAMES.ASSIGN, bid),
      jobIdFor(SCHEDULED_JOB_NAMES.ESCALATE, bid),
    ];
    await Promise.all(
      fixed.map(async (id) => {
        const job = await queue.getJob(id);
        if (job) await job.remove();
      }),
    );

    // Scan delayed/waiting/active for reminder jobs (their ID embeds
    // the minutesAhead, which we can no longer predict).
    const pending = await queue.getJobs(
      ['delayed', 'waiting', 'active'],
      0,
      500,
      true,
    );
    await Promise.all(
      pending
        .filter((j) => String(j?.data?.bookingId || '') === bid)
        .map((j) => j.remove().catch(() => {})),
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
