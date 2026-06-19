import Booking from '../models/booking.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { ApiError } from '../utils/apiError.js';
import { BOOKING_STATUS } from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToUser,
  emitToDriver,
  emitToAdmins,
} from '../utils/socketEmitters.js';

/**
 * Post-trip ratings.
 *
 * Both sides (customer → driver, driver → customer) submit a 1–5 star
 * rating + optional review after the booking reaches `COMPLETED`. The
 * row is persisted on `booking.rating.{customer,driver}` so admins can
 * audit a single trip's feedback; the customer's rating ALSO rolls
 * into `Driver.rating` / `totalRatingScore` / `ratingCount` as a
 * running average so the driver-listing and dispatch heuristics see
 * the freshest aggregate without a per-render aggregation query.
 *
 * Each side can only submit once per booking — re-submitting throws a
 * 409 so the FE button stays idempotent. The COMPLETED gate keeps a
 * mid-trip rating from poisoning the driver's average before the trip
 * is actually settled.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const MIN_STARS = 1;
const MAX_STARS = 5;
const MAX_REVIEW_LENGTH = 500;

function parseStars(raw) {
  const stars = Number(raw);
  if (!Number.isFinite(stars) || stars < MIN_STARS || stars > MAX_STARS) {
    throw new ApiError(
      400,
      `Rating must be a number between ${MIN_STARS} and ${MAX_STARS}`,
    );
  }
  // Whole-star ratings only; halves can land here later by relaxing the
  // floor — the math averaging below already handles fractional inputs.
  return Math.round(stars);
}

function parseReview(raw) {
  if (raw == null) return '';
  const text = String(raw).trim();
  if (text.length > MAX_REVIEW_LENGTH) {
    throw new ApiError(
      400,
      `Review cannot exceed ${MAX_REVIEW_LENGTH} characters`,
    );
  }
  return text;
}

function ensureCompleted(booking) {
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, 'You can only rate a completed trip');
  }
}

/**
 * Customer rates the driver. Persists on the booking AND updates the
 * driver's running rating average atomically via `$inc`. The new
 * average is derived as
 *   newAvg = (totalRatingScore + stars) / (ratingCount + 1)
 * after the $inc, which is what the read-model expects.
 */
export async function rateDriverService(userId, bookingId, body = {}) {
  const stars = parseStars(body?.stars ?? body?.rating);
  const review = parseReview(body?.review);

  const booking = await Booking.findOne({
    _id: bookingId,
    userId,
    isDeleted: false,
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  ensureCompleted(booking);

  if (booking.rating?.customer?.stars != null) {
    throw new ApiError(409, 'You have already rated this trip');
  }
  if (!booking.driverId) {
    throw new ApiError(400, 'This booking has no driver to rate');
  }

  booking.rating = booking.rating || {};
  booking.rating.customer = {
    stars,
    review,
    ratedAt: new Date(),
  };
  await booking.save();

  // Roll the per-trip rating into the driver's running aggregate. The
  // $inc + recompute pattern keeps writes lock-free (no read-modify-
  // write race) and survives multiple bookings rating a driver at the
  // same time.
  try {
    const updated = await Driver.findOneAndUpdate(
      { _id: booking.driverId },
      {
        $inc: {
          totalRatingScore: stars,
          ratingCount: 1,
        },
      },
      { new: true, projection: { totalRatingScore: 1, ratingCount: 1 } },
    ).lean();
    if (updated && updated.ratingCount > 0) {
      const avg = round2(updated.totalRatingScore / updated.ratingCount);
      // Belt-and-braces — clamp to the schema range so a stale legacy
      // row with bad data can't push `rating` outside [0, 5].
      const clamped = Math.max(0, Math.min(5, avg));
      await Driver.updateOne(
        { _id: booking.driverId },
        { $set: { rating: clamped } },
      );
    }
  } catch (err) {
    // Best-effort — the per-booking record is already saved, the
    // aggregate can be reconciled later. Never wedge the customer's
    // submit on a write error here.
    console.warn(
      '[bookingRating] failed to update driver rating aggregate:',
      String(booking._id),
      err?.message,
    );
  }

  // Surface the new rating to the driver (silent toast / dashboard
  // tile) and admins (live feedback feed). The customer's own UI gets
  // the BOOKING_UPDATED to keep the rating store in sync across tabs.
  const payload = {
    bookingId: String(booking._id),
    bookingNumber: booking.bookingNumber || '',
    stars,
    review,
    serviceType: booking.serviceType,
  };
  try {
    if (booking.driverId) {
      emitToDriver(booking.driverId, S2C_EVENTS.BOOKING_RATED_BY_CUSTOMER, payload);
    }
    emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, {
      bookingId: String(booking._id),
      rating: booking.rating,
    });
    emitToAdmins(S2C_EVENTS.BOOKING_RATED_BY_CUSTOMER, payload);
  } catch (err) {
    console.warn('[bookingRating] socket emit failed (customer side):', err?.message);
  }

  return {
    booking: booking.toObject(),
    rating: booking.rating.customer,
  };
}

/**
 * Driver rates the customer. Stored on the booking only — there's no
 * per-customer running aggregate today (we can add one when the admin
 * needs to surface customer reputation; the field is reserved on the
 * User model already via free-form fields). Same one-shot semantics as
 * the customer side.
 */
export async function rateCustomerService(driverId, bookingId, body = {}) {
  const stars = parseStars(body?.stars ?? body?.rating);
  const review = parseReview(body?.review);

  const booking = await Booking.findOne({
    _id: bookingId,
    driverId,
    isDeleted: false,
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  ensureCompleted(booking);

  if (booking.rating?.driver?.stars != null) {
    throw new ApiError(409, 'You have already rated this customer');
  }

  booking.rating = booking.rating || {};
  booking.rating.driver = {
    stars,
    review,
    ratedAt: new Date(),
  };
  await booking.save();

  const payload = {
    bookingId: String(booking._id),
    bookingNumber: booking.bookingNumber || '',
    stars,
    review,
    serviceType: booking.serviceType,
  };
  try {
    emitToUser(booking.userId, S2C_EVENTS.BOOKING_RATED_BY_DRIVER, payload);
    emitToAdmins(S2C_EVENTS.BOOKING_RATED_BY_DRIVER, payload);
  } catch (err) {
    console.warn('[bookingRating] socket emit failed (driver side):', err?.message);
  }

  return {
    booking: booking.toObject(),
    rating: booking.rating.driver,
  };
}
