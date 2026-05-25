import Booking from '../models/booking.model.js';
import {Driver} from '../models/driverModels/driver.model.js';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
} from '../constants/bookingStatus.js';
import { sanitizeBookingForDriver } from './booking.service.js';

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
 * Sum `fareSnapshot.total` over completed bookings for a driver in a window.
 * Returns `{ earnings, trips }` (both numbers, never null).
 */
async function aggregateEarnings(driverId, gte, lte) {
  const [row] = await Booking.aggregate([
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
        earnings: { $sum: { $ifNull: ['$fareSnapshot.total', 0] } },
        trips: { $sum: 1 },
      },
    },
  ]);
  return {
    earnings: round2(row?.earnings || 0),
    trips: row?.trips || 0,
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
    Driver.findById(driverId).select('rating ratingCount').lean(),
    Booking.findOne({
      driverId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      isDeleted: false,
    })
      .populate('userId', 'name phone profilePicture')
      .lean(),
  ]);

  return {
    today,
    rating: {
      value: Number(driver?.rating || 0),
      count: Number(driver?.ratingCount || 0),
    },
    activeBooking: sanitizeBookingForDriver(activeBookingRaw),
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
 */
async function buildDailyBuckets(driverId, fromDate, days = 7) {
  const start = startOfDay(fromDate);
  const end = endOfDay(addDays(start, days - 1));

  const rows = await Booking.aggregate([
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
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$timeline.completedAt',
          },
        },
        earnings: { $sum: { $ifNull: ['$fareSnapshot.total', 0] } },
        trips: { $sum: 1 },
      },
    },
  ]);

  const byDate = new Map(rows.map((r) => [r._id, r]));
  const buckets = [];
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i);
    const iso = d.toISOString().slice(0, 10);
    const row = byDate.get(iso);
    buckets.push({
      date: iso,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      earnings: round2(row?.earnings || 0),
      trips: row?.trips || 0,
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
/* Re-exports (lets the controller import everything from one path).   */
/* ------------------------------------------------------------------ */

export const __EXPORTED_STATUSES__ = {
  ACTIVE_BOOKING_STATUSES,
  TERMINAL_BOOKING_STATUSES,
};
