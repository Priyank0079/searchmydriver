import Booking from '../models/booking.model.js';
import Car from '../models/user/car.model.js';
import User from '../models/user.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { findDriversInExpandingRadius } from './driverFinder.service.js';
import {
  adminMarkNoDriversFoundService,
  driverEarningFromFareSnapshot,
} from './booking.service.js';
import { schedulePaymentTimeout } from './bookingPaymentTimeout.service.js';
import {
  BOOKING_STATUS,
  BOOKING_PAYMENT_STATUS,
  PAYMENT_MODE,
  PAYMENT_POLICY,
  DISPATCH,
  DISPATCH_RESPONSE,
} from '../constants/bookingStatus.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';
import {
  emitToDriver,
  emitToUser,
  emitToAdmins,
  emitToBooking,
} from '../utils/socketEmitters.js';

/**
 * Wave-broadcast booking dispatcher.
 *
 * For every booking we run a sequence of "waves". Each wave:
 *
 *   1. Picks the closest WAVE_SIZE (=5) approved, online, idle drivers that
 *      haven't been offered yet, using an expanding-radius search starting at
 *      SEARCH_RADIUS_START_METERS (1 km) and growing up to either
 *      `dispatch.maxRadiusMeters` (default 5 km) or the booking's zone radius.
 *   2. Emits BOOKING_OFFERED to every selected driver in parallel.
 *   3. Starts a wave-level setTimeout. First driver to accept wins; the
 *      losing drivers receive BOOKING_OFFER_WITHDRAWN. If the timer expires
 *      without an accept, all unresponded offers are recorded as TIMEOUT
 *      and the next wave is dispatched.
 *
 * The lifecycle is essentially:
 *
 *   ┌─ dispatchNextWave ─────────────────────────────────────────────────┐
 *   │ 1. Pick next wave of N drivers (expanding radius)                  │
 *   │ 2. Emit BOOKING_OFFERED to all of them                             │
 *   │ 3. Start ONE wave timer                                            │
 *   │ 4. accept → withdraw others → STOP                                 │
 *   │ 5. all reject or timer expires → loop to step 1 (larger radius)    │
 *   │ 6. radius hits cap & wave is empty → no_drivers_found              │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Wave timers live in memory only (`waveTimers`). A server restart drops
 * outstanding timers; the next driver action or admin sweep resumes things.
 */

/** bookingId → setTimeout handle for the active wave's expiry. */
const waveTimers = new Map();

function clearWaveTimer(bookingId) {
  const handle = waveTimers.get(String(bookingId));
  if (handle) {
    clearTimeout(handle);
    waveTimers.delete(String(bookingId));
  }
}

function alreadyOfferedDriverIds(booking) {
  return (booking.dispatch?.offers || []).map((o) => String(o.driverId));
}

function buildOfferPayload(booking, driver, { customer, car } = {}) {
  return {
    bookingId: String(booking._id),
    bookingNumber: booking.bookingNumber,
    serviceType: booking.serviceType,
    paymentMode: booking.paymentMode,
    pickup: booking.pickup,
    dropoff: booking.dropoff || null,
    hourly: booking.hourly || null,
    outstation: booking.outstation || null,
    // Drivers only ever see their own earning — never the customer's
    // gross total or the platform commission. Computed once here so the
    // offer payload, the active-trip view and the trip history all show
    // the same number.
    fare: {
      driverEarning: driverEarningFromFareSnapshot(booking.fareSnapshot),
      currency: 'INR',
    },
    customer: customer
      ? {
          name: customer.name || '',
          phone: customer.phone_no ? String(customer.phone_no) : '',
          profilePicture: customer.profilePicture || '',
        }
      : null,
    car: car
      ? {
          _id: String(car._id),
          vehicleNumber: car.vehicleNumber || '',
          transmission: car.transmission || '',
          carTypeName: car.carTypeId?.name || '',
          brandName: car.brandId?.name || '',
          modelName: car.modelId?.name || '',
          fuelTypeName: car.fuelTypeId?.name || '',
        }
      : null,
    offerExpiresAt: booking.dispatch.currentExpiresAt,
    distanceMeters: driver.distanceMeters ?? null,
    waveSize: booking.dispatch.pendingOfferIds.length,
  };
}

function emitUserDispatchUpdate(booking) {
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, {
    bookingId: String(booking._id),
    status: booking.status,
    dispatch: {
      attempt: booking.dispatch.attemptsCount,
      maxAttempts: booking.dispatch.maxAttempts,
      radiusMeters: booking.dispatch.currentRadiusMeters,
      pendingDriverCount: booking.dispatch.pendingOfferIds.length,
    },
  });
}

function notifyWaveWithdrawn(driverIds, bookingId, reason) {
  for (const id of driverIds) {
    emitToDriver(id, S2C_EVENTS.BOOKING_OFFER_WITHDRAWN, {
      bookingId: String(bookingId),
      reason,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Start (or continue) the dispatch loop for a booking by sending the next
 * wave of offers. Idempotent — calling this multiple times for the same
 * booking is safe; only one wave timer can exist at a time per bookingId.
 *
 * @param {string} bookingId
 */
export async function dispatchNextDriverService(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { ok: false, reason: 'not_found' };
  if (booking.status !== BOOKING_STATUS.SEARCHING) {
    return { ok: false, reason: 'not_searching' };
  }

  clearWaveTimer(bookingId);

  const maxAttempts = booking.dispatch?.maxAttempts || DISPATCH.MAX_ATTEMPTS;
  if ((booking.dispatch?.attemptsCount || 0) >= maxAttempts) {
    return failBookingNoDrivers(bookingId);
  }

  const [lng, lat] = booking.pickup?.location?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return failBookingNoDrivers(bookingId);
  }

  // Expanding search starts at the radius we left off on (1 km → step → cap).
  const startMeters =
    booking.dispatch?.currentRadiusMeters || DISPATCH.SEARCH_RADIUS_START_METERS;
  const maxMeters = booking.dispatch?.maxRadiusMeters || DISPATCH.SEARCH_RADIUS_MAX_METERS;

  // Restrict driver matching to the user's chosen car-type so the driver
  // who picks up the offer is qualified to drive that vehicle. We also
  // pull the full car + customer doc here so we can hydrate the offer
  // payload without an extra round-trip per driver in the wave.
  const car = booking.carId
    ? await Car.findById(booking.carId)
        .populate('carTypeId', 'name')
        .populate('brandId', 'name')
        .populate('modelId', 'name')
        .populate('fuelTypeId', 'name')
        .lean()
    : null;
  const customer = await User.findById(booking.userId)
    .select('name phone_no profilePicture')
    .lean();
  const carTypeIds = car?.carTypeId?._id ? [String(car.carTypeId._id)] : [];

  const { drivers, radiusMeters } = await findDriversInExpandingRadius({
    lat,
    lng,
    startMeters,
    stepMeters: DISPATCH.SEARCH_RADIUS_STEP_METERS,
    maxMeters,
    limit: DISPATCH.WAVE_SIZE,
    minResults: 1,
    carTypeIds,
    excludeDriverIds: alreadyOfferedDriverIds(booking),
  });

  if (!drivers.length) {
    return failBookingNoDrivers(bookingId);
  }

  const expiresAt = new Date(Date.now() + DISPATCH.OFFER_TIMEOUT_SECONDS * 1000);
  booking.dispatch.currentExpiresAt = expiresAt;
  booking.dispatch.currentRadiusMeters = radiusMeters;
  booking.dispatch.attemptsCount = (booking.dispatch.attemptsCount || 0) + 1;
  booking.dispatch.pendingOfferIds = drivers.map((d) => d._id);
  for (const driver of drivers) {
    booking.dispatch.offers.push({
      driverId: driver._id,
      offeredAt: new Date(),
      response: null,
      distanceMeters: driver.distanceMeters ?? null,
    });
  }
  await booking.save();

  // Emit to every driver in the wave in parallel.
  for (const driver of drivers) {
    emitToDriver(
      driver._id,
      S2C_EVENTS.BOOKING_OFFERED,
      buildOfferPayload(booking, driver, { customer, car }),
    );
  }
  emitUserDispatchUpdate(booking);

  // Schedule the wave-level timeout-skip.
  const handle = setTimeout(() => {
    handleWaveTimeoutService(bookingId).catch((err) => {
      console.warn('[dispatch] wave timeout handler failed:', err.message);
    });
  }, DISPATCH.OFFER_TIMEOUT_SECONDS * 1000);
  waveTimers.set(String(bookingId), handle);

  return {
    ok: true,
    wave: booking.dispatch.attemptsCount,
    driverIds: drivers.map((d) => String(d._id)),
    radiusMeters,
  };
}

async function failBookingNoDrivers(bookingId) {
  clearWaveTimer(bookingId);
  // For scheduled bookings this routes to the emergency pool instead
  // of terminating with NO_DRIVERS_FOUND (see
  // `adminMarkNoDriversFoundService`). The status on the returned doc
  // is the source of truth for the broadcast payload below.
  const booking = await adminMarkNoDriversFoundService(bookingId);
  const escalated = booking.status === BOOKING_STATUS.IN_EMERGENCY_POOL;
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, {
    bookingId: String(booking._id),
    status: booking.status,
  });
  emitToAdmins(S2C_EVENTS.ADMIN_ALERT, {
    kind: escalated ? 'emergency_pool_entered' : 'no_drivers_found',
    severity: 'warn',
    message: escalated
      ? `Scheduled booking ${booking.bookingNumber} needs manual driver assignment`
      : `Booking ${booking.bookingNumber} could not find a driver`,
    data: { bookingId: String(booking._id) },
  });
  return {
    ok: false,
    reason: escalated ? 'in_emergency_pool' : 'no_drivers_found',
  };
}

/** Driver accepts a live offer for a booking. First driver in the wave wins. */
export async function acceptBookingService(bookingId, driverId) {
  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });
  if (!booking) return { ok: false, reason: 'not_found' };
  if (booking.status !== BOOKING_STATUS.SEARCHING) {
    return { ok: false, reason: 'no_longer_searching' };
  }
  const pending = (booking.dispatch?.pendingOfferIds || []).map(String);
  if (!pending.includes(String(driverId))) {
    return { ok: false, reason: 'not_in_active_wave' };
  }

  clearWaveTimer(bookingId);

  // Mark this driver's offer as accepted.
  const offer = booking.dispatch.offers.find(
    (o) => String(o.driverId) === String(driverId) && o.response == null,
  );
  if (offer) {
    offer.response = DISPATCH_RESPONSE.ACCEPTED;
    offer.respondedAt = new Date();
  }

  // Withdraw all the other drivers in this wave — they lost the race.
  const losers = pending.filter((id) => String(id) !== String(driverId));
  for (const loserId of losers) {
    const otherOffer = booking.dispatch.offers.find(
      (o) => String(o.driverId) === String(loserId) && o.response == null,
    );
    if (otherOffer) {
      otherOffer.response = DISPATCH_RESPONSE.CANCELLED;
      otherOffer.respondedAt = new Date();
    }
  }

  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;
  booking.driverId = driverId;
  const acceptedAt = new Date();
  booking.timeline.driverAssignedAt = acceptedAt;

  // When a previous driver cancelled a *paid* booking the dispatcher
  // re-queues it as SEARCHING with paymentStatus still PAID. In that
  // case we skip the AWAITING_PAYMENT phase entirely and the new
  // driver gets a fully-paid booking they can start immediately. The
  // booking's `cancellation` block (set by redispatchAfterDriverCancel)
  // is cleared so the UI doesn't keep showing the old popup.
  const alreadyPaid =
    booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;

  if (alreadyPaid) {
    booking.status = BOOKING_STATUS.DRIVER_ASSIGNED;
    booking.timeline.paymentDeadlineAt = null;
    booking.cancellation = null;
  } else {
    // Standard "first acceptance" flow: lock in PRE_RIDE, set the 60s
    // payment deadline, and arm the auto-cancel timer.
    booking.timeline.paymentDeadlineAt = new Date(
      acceptedAt.getTime() + PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS * 1000,
    );
    booking.status = BOOKING_STATUS.AWAITING_PAYMENT;
    booking.paymentMode = PAYMENT_MODE.PRE_RIDE;
    booking.paymentStatus = BOOKING_PAYMENT_STATUS.PENDING;
  }
  await booking.save();

  // Mark the driver as on-trip so future dispatches skip them. Other drivers
  // in the lost wave stay available.
  await Driver.updateOne({ _id: driverId }, { $set: { isOnTrip: true } });

  // Kick off the auto-cancel timer only for the standard (unpaid) flow.
  // Re-dispatched bookings are already paid → no payment timer needed.
  if (!alreadyPaid) {
    schedulePaymentTimeout(booking._id);
  }

  // Notify the losing drivers that the offer is gone.
  notifyWaveWithdrawn(losers, booking._id, 'awarded_to_other_driver');

  // We split the payload by audience so the driver never sees the
  // customer's `paymentMode`/`paymentStatus`. They only need to know the
  // booking is parked in `awaiting_payment` so their UI can render the
  // "user is making payment" overlay.
  const userPayload = {
    bookingId: String(booking._id),
    status: booking.status,
    paymentMode: booking.paymentMode,
    paymentStatus: booking.paymentStatus,
    driverId: String(driverId),
    timeline: booking.timeline?.toObject?.() || booking.timeline,
    // When this is a re-dispatched (already-paid) booking we wipe the
    // old cancellation block so the FE doesn't keep flashing the
    // "driver bailed" popup.
    cancellation: booking.cancellation
      ? booking.cancellation?.toObject?.() || booking.cancellation
      : null,
  };
  const driverPayload = {
    bookingId: String(booking._id),
    status: booking.status,
    driverId: String(driverId),
    timeline: booking.timeline?.toObject?.() || booking.timeline,
  };
  emitToUser(booking.userId, S2C_EVENTS.BOOKING_UPDATED, userPayload);
  emitToBooking(booking._id, S2C_EVENTS.BOOKING_UPDATED, driverPayload);
  emitToDriver(driverId, S2C_EVENTS.BOOKING_UPDATED, driverPayload);
  emitToAdmins(S2C_EVENTS.BOOKING_UPDATED, userPayload);

  return { ok: true, status: booking.status };
}

/**
 * Driver rejects their pending offer. Removes them from the active wave; if
 * the wave is now empty, immediately dispatches the next one.
 */
export async function rejectBookingService(bookingId, driverId) {
  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });
  if (!booking) return { ok: false, reason: 'not_found' };
  if (booking.status !== BOOKING_STATUS.SEARCHING) {
    return { ok: false, reason: 'not_searching' };
  }
  const pending = (booking.dispatch?.pendingOfferIds || []).map(String);
  if (!pending.includes(String(driverId))) {
    return { ok: false, reason: 'not_in_active_wave' };
  }

  const offer = booking.dispatch.offers.find(
    (o) => String(o.driverId) === String(driverId) && o.response == null,
  );
  if (offer) {
    offer.response = DISPATCH_RESPONSE.REJECTED;
    offer.respondedAt = new Date();
  }
  booking.dispatch.pendingOfferIds = booking.dispatch.pendingOfferIds.filter(
    (id) => String(id) !== String(driverId),
  );
  const stillPending = booking.dispatch.pendingOfferIds.length;
  if (stillPending === 0) {
    booking.dispatch.currentExpiresAt = null;
  }
  await booking.save();

  emitToDriver(driverId, S2C_EVENTS.BOOKING_OFFER_WITHDRAWN, {
    bookingId: String(booking._id),
    reason: 'rejected_by_driver',
  });

  if (stillPending === 0) {
    // Everyone in the wave bailed — move on with an expanded radius.
    clearWaveTimer(bookingId);
    return dispatchNextDriverService(bookingId);
  }

  // Wave still has other drivers; keep waiting for them.
  return { ok: true, pendingDriverCount: stillPending };
}

/** Called by the timer when no driver in the active wave has responded in time. */
export async function handleWaveTimeoutService(bookingId) {
  const booking = await Booking.findOne({ _id: bookingId, isDeleted: false });
  if (!booking) return;
  if (booking.status !== BOOKING_STATUS.SEARCHING) return;

  const pending = (booking.dispatch?.pendingOfferIds || []).map(String);
  if (pending.length === 0) return;

  // Mark every unresponded offer in the wave as timed out.
  for (const driverId of pending) {
    const offer = booking.dispatch.offers.find(
      (o) => String(o.driverId) === String(driverId) && o.response == null,
    );
    if (offer) {
      offer.response = DISPATCH_RESPONSE.TIMEOUT;
      offer.respondedAt = new Date();
    }
  }

  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;
  await booking.save();

  notifyWaveWithdrawn(pending, booking._id, 'timeout');

  await dispatchNextDriverService(bookingId);
}

/** Backwards-compat alias for legacy callers. */
export const handleOfferTimeoutService = handleWaveTimeoutService;

/**
 * Withdraw every in-flight offer for a booking (used by user-cancel and
 * post-payment dispatch transitions).
 */
export async function withdrawCurrentOfferService(bookingId, reason = 'cancelled') {
  clearWaveTimer(bookingId);
  const booking = await Booking.findById(bookingId);
  if (!booking) return;
  const pending = (booking.dispatch?.pendingOfferIds || []).map(String);
  if (!pending.length) return;

  for (const driverId of pending) {
    const offer = booking.dispatch.offers.find(
      (o) => String(o.driverId) === String(driverId) && o.response == null,
    );
    if (offer) {
      offer.response = DISPATCH_RESPONSE.CANCELLED;
      offer.respondedAt = new Date();
    }
  }
  booking.dispatch.pendingOfferIds = [];
  booking.dispatch.currentExpiresAt = null;
  await booking.save();

  notifyWaveWithdrawn(pending, bookingId, reason);
}
