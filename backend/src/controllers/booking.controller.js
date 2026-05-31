import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import {
  createBookingService,
  getActiveBookingForUserService,
  getActiveBookingForDriverService,
  getBookingByIdService,
  cancelBookingByUserService,
  sanitizeBookingForDriver,
  listAdminBookingsService,
} from '../services/booking.service.js';
import {
  createExtensionService,
} from '../services/bookingExtension.service.js';
import {
  recordCustomerOnMyWay,
  recordCustomerNotComing,
} from '../services/bookingNoShowTimeout.service.js';
import {
  dispatchNextDriverService,
  acceptBookingService,
  rejectBookingService,
  withdrawCurrentOfferService,
} from '../services/bookingDispatch.service.js';
import {
  createBookingPaymentOrderService,
  verifyBookingPaymentService,
} from '../services/bookingPayment.service.js';
import {
  markDriverEnRouteService,
  markDriverArrivedService,
  startTripService,
  completeTripService,
  cancelBookingByDriverService,
} from '../services/bookingTrip.service.js';

/* ------------------------------------------------------------------ */
/* User                                                                */
/* ------------------------------------------------------------------ */

/**
 * POST /auth/bookings
 *
 * Creates a booking (status: searching) and immediately kicks off dispatch.
 * If the user already has an active booking the existing one is returned;
 * the frontend should then resume the flow from wherever it left off.
 */
export const createBooking = asyncHandler(async (req, res) => {
  const { booking, reused } = await createBookingService(req.user._id, req.body);
  if (!reused) {
    // Fire-and-forget; the response doesn't wait for the offer.
    dispatchNextDriverService(booking._id).catch((err) => {
      console.warn('[booking] initial dispatch failed:', err.message);
    });
  }
  return res.status(reused ? 200 : 201).json(
    new ApiResponse(reused ? 200 : 201, { booking, reused }, reused ? 'Active booking returned' : 'Booking created'),
  );
});

export const getMyActiveBooking = asyncHandler(async (req, res) => {
  const booking = await getActiveBookingForUserService(req.user._id);
  return res.status(200).json(new ApiResponse(200, { booking }, 'Active booking'));
});

export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await getBookingByIdService(req.params.id, { userId: req.user._id });
  return res.status(200).json(new ApiResponse(200, { booking }, 'Booking fetched'));
});

export const cancelBooking = asyncHandler(async (req, res) => {
  await withdrawCurrentOfferService(req.params.id, 'cancelled_by_user');
  const booking = await cancelBookingByUserService(req.user._id, req.params.id, req.body?.reason);
  return res.status(200).json(new ApiResponse(200, { booking }, 'Booking cancelled'));
});

export const createBookingPayment = asyncHandler(async (req, res) => {
  const order = await createBookingPaymentOrderService(req.user._id, req.params.id);
  return res.status(200).json(new ApiResponse(200, { razorpay: order }, 'Payment order created'));
});

export const verifyBookingPayment = asyncHandler(async (req, res) => {
  const booking = await verifyBookingPaymentService(req.user._id, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, { booking }, 'Payment verified'));
});

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

export const getDriverActiveBooking = asyncHandler(async (req, res) => {
  const booking = await getActiveBookingForDriverService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, { booking }, 'Driver active booking'));
});

export const driverAcceptBooking = asyncHandler(async (req, res) => {
  const result = await acceptBookingService(req.params.id, req.driver._id);
  if (!result.ok) {
    throw new ApiError(409, result.reason || 'Cannot accept booking');
  }
  return res.status(200).json(new ApiResponse(200, result, 'Booking accepted'));
});

export const driverRejectBooking = asyncHandler(async (req, res) => {
  const result = await rejectBookingService(req.params.id, req.driver._id);
  // `rejectBookingService` returns the dispatch result (which may itself be a
  // `no_drivers_found`) — that's fine, treat it as a successful reject.
  return res.status(200).json(new ApiResponse(200, result, 'Booking rejected'));
});

export const driverGetBookingById = asyncHandler(async (req, res) => {
  const booking = await getBookingByIdService(req.params.id, { driverId: req.driver._id });
  return res.status(200).json(new ApiResponse(200, { booking }, 'Booking fetched'));
});

/* --- Trip execution (post-accept lifecycle) ----------------------- */

export const driverMarkEnRoute = asyncHandler(async (req, res) => {
  const booking = await markDriverEnRouteService(req.driver._id, req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, { booking: sanitizeBookingForDriver(booking) }, 'Heading to pickup'));
});

export const driverMarkArrived = asyncHandler(async (req, res) => {
  const { driverCoords } = req.body || {};
  const booking = await markDriverArrivedService(req.driver._id, req.params.id, {
    driverCoords:
      driverCoords && typeof driverCoords === 'object'
        ? { lat: Number(driverCoords.lat), lng: Number(driverCoords.lng) }
        : null,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, { booking: sanitizeBookingForDriver(booking) }, 'Arrived at pickup'));
});

export const driverStartTrip = asyncHandler(async (req, res) => {
  const booking = await startTripService(req.driver._id, req.params.id, { otp: req.body?.otp });
  return res
    .status(200)
    .json(new ApiResponse(200, { booking: sanitizeBookingForDriver(booking) }, 'Trip started'));
});

export const driverCompleteTrip = asyncHandler(async (req, res) => {
  const booking = await completeTripService(req.driver._id, req.params.id);
  return res
    .status(200)
    .json(new ApiResponse(200, { booking: sanitizeBookingForDriver(booking) }, 'Trip completed'));
});

export const driverCancelBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBookingByDriverService(
    req.driver._id,
    req.params.id,
    req.body?.reason,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, { booking: sanitizeBookingForDriver(booking) }, 'Booking cancelled'));
});

/* ------------------------------------------------------------------ */
/* User: abort pre-pay + extend the ride                               */
/* ------------------------------------------------------------------ */

/**
 * POST /auth/bookings/:id/extensions
 *
 * User accepts the in-ride "your time is ending — extend?" prompt. Body:
 *   { additionalHours: number }   // minimum 0.5
 */
export const createBookingExtension = asyncHandler(async (req, res) => {
  const booking = await createExtensionService(req.user._id, req.params.id, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, { booking }, 'Ride extended'));
});

/**
 * POST /auth/bookings/:id/noshow/respond
 *
 * Customer's answer to the "are you coming?" prompt that fired when
 * the driver had been waiting past `noShowPromptMinutes`.
 *
 *   body: { response: 'on_my_way' | 'not_coming' }
 *
 * "on_my_way" cancels the auto-complete timer and reschedules the
 * prompt for another grace cycle. "not_coming" fires the auto-complete
 * immediately so the driver doesn't sit idle through the deadline.
 */
export const respondToNoShowPrompt = asyncHandler(async (req, res) => {
  const response = String(req.body?.response || '').trim();
  if (response !== 'on_my_way' && response !== 'not_coming') {
    throw new ApiError(
      400,
      'response must be "on_my_way" or "not_coming"',
    );
  }
  // The booking is loaded inside the no-show service — we just trust
  // `:id` here since the caller is authenticated as a user already
  // and a stray bookingId is a no-op (no timer to cancel, no booking
  // to update).
  if (response === 'on_my_way') {
    await recordCustomerOnMyWay(req.params.id);
  } else {
    await recordCustomerNotComing(req.params.id);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, { response }, 'Response recorded'));
});

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const getAdminBookings = asyncHandler(async (req, res) => {
  const result = await listAdminBookingsService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Bookings fetched'));
});

export const getAdminBookingById = asyncHandler(async (req, res) => {
  const booking = await getBookingByIdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, { booking }, 'Booking fetched'));
});
