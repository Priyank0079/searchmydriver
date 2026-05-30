import Booking from '../models/booking.model.js';
import {Driver} from '../models/driverModels/driver.model.js';
import PlatformRevenue, {
  PLATFORM_REVENUE_SOURCE,
} from '../models/platformRevenue.model.js';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
} from '../constants/bookingStatus.js';
import { sanitizeBookingForDriver } from './booking.service.js';
import {
  loadCancellationPolicy,
  evaluateDriverCancelChance,
} from './bookingCancellation.service.js';

/**
 * Driver-facing analytics + history.
 *
 * Everything in this file is read-only and scoped to a single `driverId`. The
 * pricing snapshot stored on `booking.fareSnapshot.total` is treated as the
 * driver-earning surrogate today — when commission/payout splits land, swap
 * the projected field here (and only here) and the rest of the stack stays
 * untouched.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** Local-time start-of-day (server TZ) — fine for the demo. */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-anchored week start (ISO-ish, sufficient for the dashboard). */
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

/* ------------------------------------------------------------------ */
/* Earnings helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Sum the driver's net earnings in a window. Combines:
 *
 *   trip earnings        Σ fareSnapshot.breakdown.driverEarning over
 *                        completed bookings (post-commission, what the
 *                        driver actually receives).
 *   cancellation shares  Σ cancellation.driverShare over user-cancelled
 *                        bookings where this driver was the mobilised
 *                        driver — credited to their wallet on cancel.
 *
 * `trips` counts only completed bookings (cancellations are not trips).
 *
 * For older bookings without `breakdown.driverEarning`, falls back to
 * `fareSnapshot.total` so historical entries still surface non-zero
 * earnings — same fallback shape `driverEarningFromFareSnapshot` uses.
 */
async function aggregateEarnings(driverId, gte, lte) {
  const [trips, cancels] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          driverId,
          status: BOOKING_STATUS.COMPLETED,
          isDeleted: false,
          'timeline.completedAt': { $gte: gte, $lte: lte },
        },
      },
      {
        $group: {
          _id: null,
          earnings: {
            $sum: {
              $ifNull: [
                '$fareSnapshot.breakdown.driverEarning',
                { $ifNull: ['$fareSnapshot.total', 0] },
              ],
            },
          },
          trips: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          driverId,
          status: BOOKING_STATUS.CANCELLED,
          isDeleted: false,
          'cancellation.driverShare': { $gt: 0 },
          'timeline.cancelledAt': { $gte: gte, $lte: lte },
        },
      },
      {
        $group: {
          _id: null,
          earnings: { $sum: { $ifNull: ['$cancellation.driverShare', 0] } },
        },
      },
    ]),
  ]);
  const tripsAgg = trips?.[0] || { earnings: 0, trips: 0 };
  const cancelsAgg = cancels?.[0] || { earnings: 0 };
  return {
    earnings: round2((tripsAgg.earnings || 0) + (cancelsAgg.earnings || 0)),
    trips: tripsAgg.trips || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Home summary                                                        */
/* ------------------------------------------------------------------ */

/**
 * Drives the "today's earnings + trips + rating + active trip" tile on
 * `/driver/home`. Cheap enough to be re-queried on every dashboard load.
 */
export async function getDriverHomeSummaryService(driverId) {
  if (!driverId) return null;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [today, driver, activeBookingRaw] = await Promise.all([
    aggregateEarnings(driverId, todayStart, todayEnd),
    Driver.findById(driverId)
      .select('rating ratingCount cancellationChances')
      .lean(),
    Booking.findOne({
      driverId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      isDeleted: false,
    })
      .populate('userId', 'name phone phone_no profilePicture')
      .lean(),
  ]);

  // Cancellation budget for today. We hand the driver-side UI a
  // structured snapshot so it can render "2/3 free cancels left today"
  // on the home page even before they tap into an active trip. The
  // policy load is best-effort — if pricing isn't configured we
  // fall back to schema defaults so the tile keeps rendering.
  let cancellationChances = null;
  try {
    const fallbackService = activeBookingRaw?.serviceType || null;
    const policy = await loadCancellationPolicy(fallbackService);
    const chance = evaluateDriverCancelChance(driver, activeBookingRaw, policy);
    cancellationChances = {
      dailyLimit: chance.dailyLimit,
      usedToday: chance.usedToday,
      chancesLeft: chance.chancesLeft,
      graceMinutes: chance.graceMinutes,
      // When there's an active booking, also surface the live grace
      // window state so the home tile can show a "free cancel: 1m 24s
      // left" countdown alongside the chances chip.
      inGrace: activeBookingRaw ? chance.inGrace : false,
      remainingMinutes: activeBookingRaw
        ? Math.max(0, chance.graceMinutes - chance.elapsedMinutes)
        : null,
    };
  } catch (err) {
    console.warn(
      '[driverTrips] cancellation-chance hydration failed:',
      err?.message,
    );
  }

  return {
    today,
    rating: {
      value: Number(driver?.rating || 0),
      count: Number(driver?.ratingCount || 0),
    },
    activeBooking: sanitizeBookingForDriver(activeBookingRaw),
    cancellationChances,
  };
}

/* ------------------------------------------------------------------ */
/* Trips list                                                          */
/* ------------------------------------------------------------------ */

const TRIPS_TAB_FILTERS = {
  all: () => ({}),
  ongoing: () => ({ status: { $in: ACTIVE_BOOKING_STATUSES } }),
  completed: () => ({ status: BOOKING_STATUS.COMPLETED }),
  cancelled: () => ({ status: BOOKING_STATUS.CANCELLED }),
};

/**
 * Driver trip history.
 *
 *   GET /driver/trips?tab=all|ongoing|completed|cancelled&page=&limit=
 *
 * Mirrors the admin-list pagination shape used elsewhere in the codebase:
 * `{ data, pagination: { total, page, pages } }`.
 */
export async function getDriverTripsListService(driverId, query = {}) {
  const tab = String(query.tab || 'all').toLowerCase();
  const filterBuilder = TRIPS_TAB_FILTERS[tab] || TRIPS_TAB_FILTERS.all;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 15));
  const skip = (page - 1) * limit;

  const filter = {
    driverId,
    isDeleted: false,
    ...filterBuilder(),
  };

  const [total, rows] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name phone profilePicture')
      .lean(),
  ]);

  const data = rows.map((b) => sanitizeBookingForDriver(b));

  return {
    data,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Earnings page                                                       */
/* ------------------------------------------------------------------ */

/**
 * Per-day earnings for the last 7 days, oldest → newest. Each bucket carries
 * its ISO date so the frontend can render the chart deterministically.
 *
 * Sums trip earnings (post-commission `driverEarning`) plus cancellation
 * shares on the same date — same accounting `aggregateEarnings` uses.
 */
async function buildDailyBuckets(driverId, fromDate, days = 7) {
  const start = startOfDay(fromDate);
  const end = endOfDay(addDays(start, days - 1));

  const [tripRows, cancelRows] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          driverId,
          status: BOOKING_STATUS.COMPLETED,
          isDeleted: false,
          'timeline.completedAt': { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timeline.completedAt' },
          },
          earnings: {
            $sum: {
              $ifNull: [
                '$fareSnapshot.breakdown.driverEarning',
                { $ifNull: ['$fareSnapshot.total', 0] },
              ],
            },
          },
          trips: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          driverId,
          status: BOOKING_STATUS.CANCELLED,
          isDeleted: false,
          'cancellation.driverShare': { $gt: 0 },
          'timeline.cancelledAt': { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timeline.cancelledAt' },
          },
          earnings: { $sum: { $ifNull: ['$cancellation.driverShare', 0] } },
        },
      },
    ]),
  ]);

  const byDate = new Map();
  for (const r of tripRows) {
    byDate.set(r._id, { earnings: r.earnings || 0, trips: r.trips || 0 });
  }
  for (const r of cancelRows) {
    const cur = byDate.get(r._id) || { earnings: 0, trips: 0 };
    cur.earnings += r.earnings || 0;
    byDate.set(r._id, cur);
  }

  const buckets = [];
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i);
    const iso = d.toISOString().slice(0, 10);
    const row = byDate.get(iso) || { earnings: 0, trips: 0 };
    buckets.push({
      date: iso,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      earnings: round2(row.earnings),
      trips: row.trips,
    });
  }
  return buckets;
}

/**
 * Drives `/driver/earnings`. Returns:
 *  - today / week / month aggregates
 *  - last-7-days bar chart buckets
 *  - last 10 completed trips for the "recent payouts" feed
 */
export async function getDriverEarningsService(driverId) {
  if (!driverId) return null;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const sevenDaysAgo = addDays(startOfDay(now), -6); // last 7 days inclusive

  const [today, week, month, daily, recentRaw] = await Promise.all([
    aggregateEarnings(driverId, todayStart, todayEnd),
    aggregateEarnings(driverId, weekStart, todayEnd),
    aggregateEarnings(driverId, monthStart, todayEnd),
    buildDailyBuckets(driverId, sevenDaysAgo, 7),
    Booking.find({
      driverId,
      status: BOOKING_STATUS.COMPLETED,
      isDeleted: false,
    })
      .sort({ 'timeline.completedAt': -1, createdAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .lean(),
  ]);

  const peak = daily.reduce(
    (m, b) => (b.earnings > m ? b.earnings : m),
    0,
  );

  return {
    summary: { today, week, month },
    daily: {
      buckets: daily,
      peak: round2(peak),
    },
    recent: recentRaw.map((b) => sanitizeBookingForDriver(b)),
  };
}

/* ------------------------------------------------------------------ */
/* Earnings ledger (paginated)                                         */
/* ------------------------------------------------------------------ */

const LEDGER_KIND = Object.freeze({
  TRIP: 'trip',
  CANCELLATION_SHARE: 'cancellation_share',
  PENALTY: 'penalty',
});

/**
 * Paginated, unified ledger of EVERY rupee that moved the driver's
 * wallet — credits (trip payouts, cancellation shares) AND debits
 * (penalty deductions when the driver cancels outside the grace
 * window). Used by the driver Earnings page's "All earnings" feed.
 *
 *   GET /driver/earnings/ledger?page=1&limit=20
 *
 * Returns: `{ rows, total, page, limit, pages, totals }`
 *   rows: most-recent-first ledger lines with `{ kind, direction,
 *         amountRupees, occurredAt, bookingNumber, serviceType, meta }`.
 *         `direction` is 'credit' for trip/cancellation_share rows and
 *         'debit' for penalty rows so the UI can render the sign +
 *         colour deterministically.
 *   totals: lifetime summary split by kind plus a NET total (credits −
 *           debits).
 *
 * Implementation note: we union three sources before paginating:
 *   - Booking.COMPLETED         → trip earnings (positive)
 *   - Booking.CANCELLED w/ share → cancellation share (positive)
 *   - PlatformRevenue.DRIVER_PENALTY for this driver → penalty (negative)
 *
 * PlatformRevenue is the source-of-truth for penalties because the
 * booking's `driverId` is cleared on the re-dispatch path, but the
 * revenue row keeps `driverId` set to whoever was penalised.
 */
export async function listDriverEarningsLedgerService(
  driverId,
  { page = 1, limit = 20 } = {},
) {
  if (!driverId) {
    return {
      rows: [],
      total: 0,
      page: 1,
      limit: 20,
      pages: 1,
      totals: {
        tripEarnings: 0,
        cancellationEarnings: 0,
        penaltyDeductions: 0,
        tripCount: 0,
        cancellationCount: 0,
        penaltyCount: 0,
        netEarnings: 0,
        total: 0,
      },
    };
  }
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  // Pull every booking-derived ledger row (trips + cancellation shares)
  // and every penalty row from PlatformRevenue in parallel, then merge
  // + paginate in-process. The cardinality here is bounded by the
  // driver's full activity history, which is small.
  const [bookingRows, penaltyRows] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          driverId,
          isDeleted: false,
          $or: [
            { status: BOOKING_STATUS.COMPLETED },
            {
              status: BOOKING_STATUS.CANCELLED,
              'cancellation.driverShare': { $gt: 0 },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          bookingNumber: 1,
          serviceType: 1,
          status: 1,
          cancellation: 1,
          timeline: 1,
          createdAt: 1,
          kind: {
            $cond: [
              { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
              LEDGER_KIND.TRIP,
              LEDGER_KIND.CANCELLATION_SHARE,
            ],
          },
          amount: {
            $cond: [
              { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
              {
                $ifNull: [
                  '$fareSnapshot.breakdown.driverEarning',
                  { $ifNull: ['$fareSnapshot.total', 0] },
                ],
              },
              { $ifNull: ['$cancellation.driverShare', 0] },
            ],
          },
          occurredAt: {
            $cond: [
              { $eq: ['$status', BOOKING_STATUS.COMPLETED] },
              { $ifNull: ['$timeline.completedAt', '$createdAt'] },
              { $ifNull: ['$timeline.cancelledAt', '$createdAt'] },
            ],
          },
        },
      },
      { $match: { amount: { $gt: 0 } } },
    ]),
    PlatformRevenue.find({
      driverId,
      source: PLATFORM_REVENUE_SOURCE.DRIVER_PENALTY,
    })
      .select('_id bookingId bookingNumber serviceType amountRupees occurredAt meta')
      .lean(),
  ]);

  // Normalise both sources into a single ledger-row shape, then sort
  // + paginate together.
  const normalisedBookings = bookingRows.map((r) => ({
    _id: r._id,
    kind: r.kind,
    direction: 'credit',
    bookingNumber: r.bookingNumber || null,
    bookingId: r._id,
    serviceType: r.serviceType || null,
    amountRupees: round2(r.amount || 0),
    occurredAt: r.occurredAt,
    status: r.status,
    meta:
      r.kind === LEDGER_KIND.CANCELLATION_SHARE
        ? {
            reason: r.cancellation?.reason || null,
            cancelledBy: r.cancellation?.cancelledBy || null,
            feeCharged: round2(r.cancellation?.feeCharged || 0),
          }
        : null,
  }));

  const normalisedPenalties = penaltyRows.map((r) => ({
    _id: r._id,
    kind: LEDGER_KIND.PENALTY,
    direction: 'debit',
    bookingNumber: r.bookingNumber || null,
    bookingId: r.bookingId || null,
    serviceType: r.serviceType || null,
    amountRupees: round2(r.amountRupees || 0),
    occurredAt: r.occurredAt,
    status: null,
    meta: {
      reason: r.meta?.reason || 'cancelled_by_driver',
      bookingStatus: r.meta?.status || null,
    },
  }));

  const merged = [...normalisedBookings, ...normalisedPenalties].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const total = merged.length;
  const rows = merged.slice(skip, skip + safeLimit);

  // Lifetime totals are computed across the FULL merged list (not the
  // paginated slice) so the breakdown card matches reality regardless
  // of which page the driver is on.
  let tripEarnings = 0;
  let cancellationEarnings = 0;
  let penaltyDeductions = 0;
  let tripCount = 0;
  let cancellationCount = 0;
  let penaltyCount = 0;
  for (const row of merged) {
    if (row.kind === LEDGER_KIND.TRIP) {
      tripEarnings += row.amountRupees;
      tripCount += 1;
    } else if (row.kind === LEDGER_KIND.CANCELLATION_SHARE) {
      cancellationEarnings += row.amountRupees;
      cancellationCount += 1;
    } else if (row.kind === LEDGER_KIND.PENALTY) {
      penaltyDeductions += row.amountRupees;
      penaltyCount += 1;
    }
  }

  const totalCredits = tripEarnings + cancellationEarnings;

  return {
    rows,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.ceil(total / safeLimit) || 1,
    totals: {
      tripEarnings: round2(tripEarnings),
      cancellationEarnings: round2(cancellationEarnings),
      penaltyDeductions: round2(penaltyDeductions),
      tripCount,
      cancellationCount,
      penaltyCount,
      // Total CREDITS (kept under `total` for back-compat with the FE
      // card that read this field directly).
      total: round2(totalCredits),
      // Net = credits − debits, the actual rupee change for the driver.
      netEarnings: round2(totalCredits - penaltyDeductions),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Re-exports (lets the controller import everything from one path).   */
/* ------------------------------------------------------------------ */

export const __EXPORTED_STATUSES__ = {
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
};
