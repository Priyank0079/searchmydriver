/**
 * Booking lifecycle constants.
 *
 * Mirrored verbatim in `frontend/src/constants/bookingStatus.js`. Keep both
 * files in sync — any new state must land on both sides in the same change.
 *
 * The status machine is intentionally linear with two terminal branches:
 *
 *   searching → driver_assigned → awaiting_payment? → en_route → arrived
 *             → started → completed
 *             ↘ cancelled
 *             ↘ no_drivers_found
 *
 * `awaiting_payment` only appears for `pre_ride` payment mode. Phase 4 ends
 * the flow at `driver_assigned` (post-pay) or once `awaiting_payment` is
 * cleared back to `driver_assigned` (pre-pay). Anything from `en_route`
 * onward is Phase 5.
 */

export const BOOKING_STATUS = Object.freeze({
  SEARCHING: 'searching',
  DRIVER_ASSIGNED: 'driver_assigned',
  AWAITING_PAYMENT: 'awaiting_payment',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_DRIVERS_FOUND: 'no_drivers_found',
});

export const BOOKING_STATUS_LIST = Object.freeze(Object.values(BOOKING_STATUS));

/** Statuses where a booking is still "live" (driver may have work to do). */
export const ACTIVE_BOOKING_STATUSES = Object.freeze([
  BOOKING_STATUS.SEARCHING,
  BOOKING_STATUS.DRIVER_ASSIGNED,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.STARTED,
]);

export const TERMINAL_BOOKING_STATUSES = Object.freeze([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.NO_DRIVERS_FOUND,
]);

/** When does the customer's card get charged. */
export const PAYMENT_MODE = Object.freeze({
  PRE_RIDE: 'pre_ride',
  POST_RIDE: 'post_ride',
});

export const PAYMENT_MODE_LIST = Object.freeze(Object.values(PAYMENT_MODE));

/**
 * Whether the user wants the ride to start right away or at a future time.
 * Decided on the very first screen of the hourly flow.
 */
export const BOOKING_TYPE = Object.freeze({
  INSTANT: 'instant',
  SCHEDULED: 'scheduled',
});

export const BOOKING_TYPE_LIST = Object.freeze(Object.values(BOOKING_TYPE));

/** Payment lifecycle, independent of ride status. */
export const BOOKING_PAYMENT_STATUS = Object.freeze({
  /** Pre-pay flow before driver accepts; post-pay before ride completes. */
  NOT_DUE_YET: 'not_due_yet',
  /** Razorpay order created, awaiting user to complete checkout. */
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  PARTIAL_REFUND: 'partial_refund',
  FAILED: 'failed',
});

/** Dispatch policy knobs. */
export const DISPATCH = Object.freeze({
  /** Seconds a wave of drivers has to accept before we move to the next wave. */
  OFFER_TIMEOUT_SECONDS: 30,
  /** Maximum number of waves before declaring "no drivers found". */
  MAX_ATTEMPTS: 5,
  /** Number of drivers offered in parallel per wave. */
  WAVE_SIZE: 5,
  /** First (smallest) search radius, in metres. */
  SEARCH_RADIUS_START_METERS: 1000,
  /** How much to grow the radius each step when a wave is empty. */
  SEARCH_RADIUS_STEP_METERS: 1000,
  /** Hard ceiling — never search drivers further than this from pickup. */
  SEARCH_RADIUS_MAX_METERS: 5000,
  /** Seconds the user has to pay (pre-pay flow) before booking auto-cancels. */
  PRE_PAY_TIMEOUT_SECONDS: 300,
});

/**
 * Payment policy knobs.
 *
 *   PAYMENT_DEADLINE_SECONDS  Hard deadline — counted from
 *                             `timeline.driverAssignedAt` — within which the
 *                             customer MUST complete payment. The driver is
 *                             frozen behind an overlay while this clock runs.
 *                             If the booking is still `awaiting_payment` when
 *                             the timer fires we auto-cancel it and release
 *                             the driver back to the dispatcher.
 *   PRE_PAY_WINDOW_SECONDS    Deprecated alias kept so older code paths
 *                             continue to compile. New code should reference
 *                             `PAYMENT_DEADLINE_SECONDS` instead.
 *   RIDE_OTP_LENGTH           How many digits the start-of-ride OTP has.
 *   RIDE_OTP_MAX_ATTEMPTS     Max wrong attempts before the driver must
 *                             contact support (we surface a soft error; the
 *                             booking is not auto-cancelled).
 *   EXTENSION_PROMPT_LEAD_SECONDS  Seconds before booked end time at which
 *                                  the user app surfaces the "extend the
 *                                  ride?" prompt. Used purely on the
 *                                  client; lives here so both sides stay
 *                                  in lockstep.
 */
export const PAYMENT_POLICY = Object.freeze({
  PAYMENT_DEADLINE_SECONDS: 60,
  PRE_PAY_WINDOW_SECONDS: 60,
  RIDE_OTP_LENGTH: 4,
  RIDE_OTP_MAX_ATTEMPTS: 5,
  EXTENSION_PROMPT_LEAD_SECONDS: 5 * 60,
});

/** Constants for the user-facing "nearby drivers" view (home page). */
export const NEARBY_DRIVERS = Object.freeze({
  /** Default radius shown to the customer on the home page. */
  DEFAULT_RADIUS_METERS: 2000,
  /** Hard ceiling the user-facing endpoint will honour. */
  MAX_RADIUS_METERS: 5000,
  /** Default number of driver pins shown on the map / in the bottom sheet. */
  DEFAULT_LIMIT: 8,
  MAX_LIMIT: 25,
});

/** Driver's response to a dispatch offer. */
export const DISPATCH_RESPONSE = Object.freeze({
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
});
