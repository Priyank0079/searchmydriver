import mongoose from 'mongoose';
import { SERVICE_TYPE_LIST } from '../constants/serviceTypes.js';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_LIST,
  BOOKING_PAYMENT_STATUS,
  PAYMENT_MODE,
  PAYMENT_MODE_LIST,
  BOOKING_TYPE,
  BOOKING_TYPE_LIST,
  DISPATCH,
  DISPATCH_RESPONSE,
} from '../constants/bookingStatus.js';

/* ------------------------------------------------------------------ */
/* Sub-schemas                                                         */
/* ------------------------------------------------------------------ */

// Shared by pickup + dropoff. Dropoff is optional today (hourly defaults it
// to the pickup; outstation already mirrors it into `outstation.destinationAddress`).
const placeSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    city: { type: String, default: '', trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
  },
  { _id: false },
);

const hourlyDetailsSchema = new mongoose.Schema(
  {
    scheduledStartAt: { type: Date, required: true },
    durationHours: { type: Number, required: true, min: 1 },
    slabId: { type: mongoose.Schema.Types.ObjectId, default: null },
    /** True when the user booked via the custom-hours option (no slab). */
    isCustomDuration: { type: Boolean, default: false },
  },
  { _id: false },
);

const outstationDetailsSchema = new mongoose.Schema(
  {
    destinationAddress: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    nights: { type: Number, default: 0, min: 0 },
    needsStay: { type: Boolean, default: true },
    needsFood: { type: Boolean, default: true },
    estimatedKm: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

/** Snapshot of pricing engine output at booking-creation time. */
const fareSnapshotSchema = new mongoose.Schema(
  {
    pricingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServicePricing', default: null },
    baseFare: { type: Number, required: true, min: 0 },
    extras: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    /** Full pricing engine output retained for display + audit. */
    breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSubscription', default: null },
  },
  { _id: false },
);

const dispatchOfferSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    offeredAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    response: {
      type: String,
      enum: Object.values(DISPATCH_RESPONSE),
      default: null,
    },
    distanceMeters: { type: Number, default: null },
  },
  { _id: false },
);

const dispatchSchema = new mongoose.Schema(
  {
    /** History of every driver offered, including their response. */
    offers: { type: [dispatchOfferSchema], default: [] },

    /**
     * Driver IDs that currently hold a live offer (one "wave" of up to
     * DISPATCH.WAVE_SIZE drivers in parallel). The first driver to accept
     * wins; the others receive BOOKING_OFFER_WITHDRAWN.
     */
    pendingOfferIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Driver' }],
      default: [],
    },
    /** When this wave's offers expire. Wave-level setTimeout fires against this. */
    currentExpiresAt: { type: Date, default: null },

    /**
     * Radius (in metres) used to find candidate drivers for the current wave.
     * Each empty/expired wave can expand this up to SEARCH_RADIUS_MAX_METERS.
     */
    currentRadiusMeters: {
      type: Number,
      default: DISPATCH.SEARCH_RADIUS_START_METERS,
    },
    /** Hard ceiling for radius expansion (cap from booking creation). */
    maxRadiusMeters: {
      type: Number,
      default: DISPATCH.SEARCH_RADIUS_MAX_METERS,
    },

    /** Number of waves issued so far. */
    attemptsCount: { type: Number, default: 0 },
    /** Max number of waves before declaring no_drivers_found. */
    maxAttempts: { type: Number, default: DISPATCH.MAX_ATTEMPTS },
  },
  { _id: false },
);

const razorpaySchema = new mongoose.Schema(
  {
    orderId: { type: String, default: null },
    paymentId: { type: String, default: null },
    signature: { type: String, default: null },
    amountPaise: { type: Number, default: null },
    refundId: { type: String, default: null },
  },
  { _id: false },
);

/**
 * In-ride extensions. The user is prompted near the end of their booked
 * duration; if they accept, an entry lands here with the agreed extra hours
 * and the incremental fare. `fareDelta` is added on top of `fareSnapshot.total`
 * when the payment service computes the amount due — see `payment` below for
 * the running balance.
 */
const extensionSchema = new mongoose.Schema(
  {
    requestedAt: { type: Date, default: Date.now },
    additionalHours: { type: Number, required: true, min: 0.5 },
    fareDelta: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'accepted',
    },
    respondedAt: { type: Date, default: null },
    driverNotifiedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: false },
);

/**
 * OTP the customer reads out to the driver at pickup. We never emit `code` to
 * the driver — they ask the customer in person, type it back, and the server
 * verifies. `attempts` lets us throttle abuse without locking the booking.
 */
const rideStartOtpSchema = new mongoose.Schema(
  {
    code: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * Running payment state across every charge against the booking.
 * `fareSnapshot` is immutable; this sub-doc tracks what's actually been
 * collected so far so extensions and partial pre-payments compose
 * correctly:
 *
 *   amountDue = effectiveTotal − amountPaidRupees
 *
 * `attempts` counts Razorpay-order retries during the AWAITING_PAYMENT
 * window — used to refresh the auto-cancel deadline (see
 * bookingPaymentTimeout.service.js).
 *
 * `walletTxId` points to the WalletTransaction row that debited the
 * user when this booking was paid from the wallet. It lets cancel /
 * no-driver-found paths credit the exact amount back without consulting
 * a separate refund table.
 */
const paymentLedgerSchema = new mongoose.Schema(
  {
    amountPaidRupees: { type: Number, default: 0, min: 0 },
    attempts: { type: Number, default: 0, min: 0 },
    walletTxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null,
    },
  },
  { _id: false },
);

/**
 * Which rail the customer actually paid through.
 *
 *   wallet   — fare debited from the user's wallet at booking creation
 *              (the default, post-refactor).
 *   razorpay — legacy "Pay Now after driver accepts" flow.
 */
export const BOOKING_PAYMENT_METHOD = Object.freeze({
  WALLET: 'wallet',
  RAZORPAY: 'razorpay',
});
const BOOKING_PAYMENT_METHOD_LIST = Object.values(BOOKING_PAYMENT_METHOD);

/* ------------------------------------------------------------------ */
/* Main schema                                                         */
/* ------------------------------------------------------------------ */

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null, index: true },
    /** The user's own car the assigned driver will drive on this booking. */
    carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },

    serviceType: { type: String, enum: SERVICE_TYPE_LIST, required: true },
    /** Whether this is an instant ("now") or a future-scheduled booking. */
    bookingType: {
      type: String,
      enum: BOOKING_TYPE_LIST,
      default: BOOKING_TYPE.INSTANT,
      required: true,
    },
    pickup: { type: placeSchema, required: true },
    /**
     * Drop location. Optional today: hourly bookings default it to the pickup
     * if the user didn't separately pick a dropoff. Outstation continues to
     * persist the destination in `outstation.destinationAddress`.
     */
    dropoff: { type: placeSchema, default: null },

    hourly: { type: hourlyDetailsSchema, default: null },
    outstation: { type: outstationDetailsSchema, default: null },

    fareSnapshot: { type: fareSnapshotSchema, required: true },

    /**
     * The customer's payment timing. Created bookings default to
     * `post_ride`; the dispatch service flips the booking to `pre_ride`
     * + AWAITING_PAYMENT the moment a driver accepts.
     */
    paymentMode: {
      type: String,
      enum: PAYMENT_MODE_LIST,
      default: PAYMENT_MODE.POST_RIDE,
      required: true,
    },
    /**
     * Which rail the customer paid through. `wallet` means the fare was
     * debited from `User.wallet.balance` at booking creation (the new
     * default). `razorpay` is the legacy "pay after accept" path.
     */
    paymentMethod: {
      type: String,
      enum: BOOKING_PAYMENT_METHOD_LIST,
      default: BOOKING_PAYMENT_METHOD.WALLET,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(BOOKING_PAYMENT_STATUS),
      default: BOOKING_PAYMENT_STATUS.NOT_DUE_YET,
    },
    razorpay: { type: razorpaySchema, default: () => ({}) },

    status: { type: String, enum: BOOKING_STATUS_LIST, default: BOOKING_STATUS.SEARCHING, index: true },

    /**
     * Zones the pickup point falls inside at booking-creation time.
     * Persisted (rather than recomputed) so the admin emergency-pool
     * list can filter for team_member staff by `assignedZones` without
     * a per-row geo lookup. Empty when no zone matched (or when the
     * geo lookup failed — best-effort, never blocks creation).
     */
    zoneIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
      default: [],
      index: true,
    },

    /**
     * Lifecycle metadata for the scheduled-ride dispatcher. Populated
     * only when the booking is created with `bookingType = scheduled`.
     *
     *   tier             which branch of the schedule decision tree
     *                    fired: 'morning' | 'morning_lead' |
     *                    'short_window' | 'long_lead'
     *   assignAt         server time at which `kickoffScheduledAssignment`
     *                    is expected to run (null = "search immediately")
     *   escalateAt       server time at which `escalateToEmergencyPool`
     *                    will fire if no driver is assigned by then
     *   assignmentStartedAt  set when the worker actually flips
     *                    PENDING_ASSIGNMENT → SEARCHING
     *   retryAttempts    number of times the wave dispatcher has come
     *                    back empty and we've re-queued a `retry` job.
     *                    Bounded by `escalateAt` (we stop retrying and
     *                    let the escalate job take over when there's no
     *                    runway left).
     *   lastRetryAt      timestamp of the most recent retry kickoff —
     *                    surfaced in the admin "Scheduled Jobs" board.
     *   remindersEnqueuedAt  set when reminder jobs have been pushed to
     *                    the queue (one-shot, after a driver was
     *                    actually assigned). Reminders are NOT enqueued
     *                    at booking-creation time any more.
     *   escalatedAt      set when the booking lands in the emergency pool
     *   emergencyPool    audit + UI state for the manual-assignment
     *                    queue (notes the admin who took it, etc.)
     */
    scheduled: {
      tier: {
        type: String,
        enum: ['morning', 'morning_lead', 'short_window', 'long_lead', ''],
        default: '',
      },
      assignAt: { type: Date, default: null },
      escalateAt: { type: Date, default: null },
      assignmentStartedAt: { type: Date, default: null },
      retryAttempts: { type: Number, default: 0, min: 0 },
      lastRetryAt: { type: Date, default: null },
      remindersEnqueuedAt: { type: Date, default: null },
      escalatedAt: { type: Date, default: null },
      emergencyPool: {
        enteredAt: { type: Date, default: null },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        assignedAt: { type: Date, default: null },
        notes: { type: String, default: '' },
      },
    },

    dispatch: { type: dispatchSchema, default: () => ({}) },
    extensions: { type: [extensionSchema], default: [] },
    rideStartOtp: { type: rideStartOtpSchema, default: () => ({}) },
    payment: { type: paymentLedgerSchema, default: () => ({}) },

    /** Timeline timestamps — populated lazily as states transition. */
    timeline: {
      createdAt: { type: Date, default: Date.now },
      driverAssignedAt: { type: Date, default: null },
      /**
       * Hard deadline by which the customer must complete pre-pay. Set on
       * driver-accept and refreshed on each Pay Now click (so a retry
       * always has at least PAYMENT_DEADLINE_SECONDS of runway). The
       * server-side timer in bookingPaymentTimeout.service.js is the
       * source of truth; this timestamp exists so both the user UI and
       * the driver overlay can render an honest countdown.
       */
      paymentDeadlineAt: { type: Date, default: null },
      paymentReceivedAt: { type: Date, default: null },
      enRouteAt: { type: Date, default: null },
      arrivedAt: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
    },

    cancellation: {
      reason: { type: String, default: '' },
      cancelledBy: { type: String, enum: ['user', 'driver', 'system', 'admin', ''], default: '' },
      feeCharged: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      // Split of `feeCharged` between the driver who was mobilised and
      // the platform — driven by `ServicePricing.cancellation.driverSharePercent`.
      // `driverShare + companyShare === feeCharged`. Persisted so the
      // admin audit (and the Revenue page) can reconcile the books.
      driverShare: { type: Number, default: 0 },
      companyShare: { type: Number, default: 0 },
    },

    /**
     * Waiting charge accrued between the driver hitting "I've arrived"
     * and the trip actually starting (OTP verification). Computed when
     * `startTripService` fires using the live admin policy:
     *
     *   billableWait = max(0, waitedMinutes − freeWaitingMinutes)
     *   waitingCharge = billableWait × chargePerMinute
     *
     * Persisted here so completion can add it to the customer's bill
     * and the admin audit can see exactly what the driver waited.
     */
    waiting: {
      waitedMinutes: { type: Number, default: 0, min: 0 },
      billableMinutes: { type: Number, default: 0, min: 0 },
      chargeRupees: { type: Number, default: 0, min: 0 },
      freeMinutes: { type: Number, default: 0, min: 0 },
      perMinuteRupees: { type: Number, default: 0, min: 0 },
      // Set when the no-show flow auto-completes a ride the customer
      // never showed up for. Lets the driver-history UI badge the
      // booking with a "no-show" pill and admin audits filter on it.
      noShow: { type: Boolean, default: false },
    },

    /**
     * No-show prompt state. Lifecycle:
     *
     *   1. Driver hits ARRIVED → server schedules a job for
     *      `noShowPromptMinutes` later.
     *   2. Job fires → `promptSentAt` set + customer notified.
     *      `promptDeadlineAt` = promptSentAt + noShowGraceMinutes.
     *   3. Customer responds:
     *        Yes → `customerResponse = 'on_my_way'`, reschedule.
     *        No  → `customerResponse = 'not_coming'`, auto-complete.
     *   4. No response by deadline → auto-complete.
     *
     * `firedFor` records the minute threshold that triggered the
     * prompt so consecutive "on_my_way" responses can each re-prompt
     * at a later threshold without losing the audit trail.
     */
    noShow: {
      promptSentAt: { type: Date, default: null },
      promptDeadlineAt: { type: Date, default: null },
      customerResponse: {
        type: String,
        enum: ['', 'on_my_way', 'not_coming'],
        default: '',
      },
      respondedAt: { type: Date, default: null },
      firedFor: { type: Number, default: 0 }, // minute threshold that triggered the prompt
    },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

/* Geo + dispatch-friendly indexes. */
bookingSchema.index({ 'pickup.location': '2dsphere' });
bookingSchema.index({ userId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ driverId: 1, status: 1, createdAt: -1 });
/* Emergency-pool list: filter by status (+ optional zone) ordered by ride time. */
bookingSchema.index({ status: 1, 'hourly.scheduledStartAt': 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;
