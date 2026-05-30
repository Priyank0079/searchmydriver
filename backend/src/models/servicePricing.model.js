import mongoose from 'mongoose';
import { SERVICE_TYPE_LIST } from '../constants/serviceTypes.js';

// ─── Hourly: slab inside a service type — e.g. "Up to 1 Hour → ₹299" ──────────
const slabSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    minHours: { type: Number, required: true, min: 0 },
    maxHours: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true },
);

const waitingChargeSchema = new mongoose.Schema(
  {
    /**
     * Free wait the customer gets after the driver hits "I've arrived".
     * Within this window, no waiting charge accrues. Beyond it, every
     * additional minute costs `chargePerMinute`.
     */
    freeWaitingMinutes: { type: Number, default: 15, min: 0 },
    chargePerMinute: { type: Number, default: 2, min: 0 },
    /**
     * Minutes after arrival to wait before pinging the customer with a
     * "Are you coming?" prompt. Triggered by the no-show scheduler.
     */
    noShowPromptMinutes: { type: Number, default: 30, min: 0 },
    /**
     * Grace minutes the customer has to respond to the no-show prompt
     * once it fires. After this window expires (or the customer says
     * "no") the trip is auto-completed — the driver gets paid in full
     * for waiting (no-show fee covered by the standard waiting +
     * fare math), and the booking is closed.
     */
    noShowGraceMinutes: { type: Number, default: 5, min: 0 },
  },
  { _id: false },
);

const nightChargeSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    /** 24h "HH:mm" */
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '06:00' },
    type: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    amount: { type: Number, default: 0, min: 0 },
    /**
     * Optional duration-based trigger. When set (> 0), any booking whose
     * `bookedHours` (hourly) or `days × 24` (outstation) crosses this
     * threshold pays the night charge regardless of the time window.
     * Use 0 to disable (window-only behaviour).
     */
    thresholdHours: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const foodAllowanceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    /** ₹ added per day (outstation) or per booking (hourly) when food is owed. */
    amount: { type: Number, default: 0, min: 0 },
    /**
     * Hourly-only: minimum booked duration (hours) at which food becomes
     * payable. Charge kicks in when `bookedHours >= thresholdHours`. Ignored
     * for outstation (food is per-day there).
     */
    thresholdHours: { type: Number, default: 4, min: 0 },
    /**
     * If true, the booking UI exposes a "I'll arrange food" toggle once
     * the threshold is crossed so the user can opt out of the allowance.
     * Outstation always honours this (`needsFood` lives on the booking).
     */
    userOptOut: { type: Boolean, default: true },
  },
  { _id: false },
);

/**
 * Driver accommodation allowance for HOURLY bookings whose duration
 * extends past the configured `thresholdHours` (e.g. an overnight
 * 12-hour booking). Outstation has its own per-night stay charge under
 * `outstation.stayChargePerNight`.
 */
const stayAllowanceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, default: 0, min: 0 },
    thresholdHours: { type: Number, default: 8, min: 0 },
    userOptOut: { type: Boolean, default: true },
  },
  { _id: false },
);

// ─── Hourly: custom-duration option ───────────────────────────────────────────
const customHoursSchema = new mongoose.Schema(
  {
    /** Whether users can request a duration not covered by the slabs. */
    enabled: { type: Boolean, default: false },
    /** Upper bound for the custom hours input (0 = unlimited). */
    maxHours: { type: Number, default: 24, min: 0 },
    /** ₹ per hour applied as the base package price for custom bookings. */
    ratePerHour: { type: Number, default: 0, min: 0 },
    /** Customer-facing label shown on the slab picker. */
    label: { type: String, default: 'Custom duration', trim: true },
  },
  { _id: false },
);

// ─── Outstation-specific block ────────────────────────────────────────────────
const outstationSchema = new mongoose.Schema(
  {
    /** Flat ₹ charged per day of the trip. */
    dailyRate: { type: Number, default: 0, min: 0 },
    /** Km included in `dailyRate` per day. `0` = unlimited (no per-km charge). */
    kmIncludedPerDay: { type: Number, default: 0, min: 0 },
    /** ₹ per km after the daily km limit is exhausted. Ignored if kmIncludedPerDay is 0. */
    extraKmRate: { type: Number, default: 0, min: 0 },
    /** ₹ driver bata per night (nights = trip days − 1). */
    nightHaltCharge: { type: Number, default: 0, min: 0 },
    /** ₹ per night for driver's accommodation when the customer doesn't arrange stay. */
    stayChargePerNight: { type: Number, default: 0, min: 0 },
    /** Minimum days that can be booked as outstation. */
    minDays: { type: Number, default: 1, min: 1 },
    /** Maximum days that can be booked as outstation (0 = unlimited). */
    maxDays: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const cancellationSchema = new mongoose.Schema(
  {
    /**
     * Flat ₹ deducted from the customer's paid amount when they cancel
     * AFTER a driver has been assigned but BEFORE the driver has reached
     * the pickup (statuses: driver_assigned / awaiting_payment / en_route).
     * Single flat number — driver mobilisation cost is independent of fare.
     */
    flatFeeAfterAssignment: { type: Number, default: 100, min: 0 },

    /**
     * Fee charged when the customer cancels AFTER the driver has
     * reached the pickup (statuses: arrived / started).
     *
     *   arrivedFeeType   'flat' → `arrivedFeeAmount` ₹ deducted.
     *                    'percentage' → `arrivedFeeAmount` % of paid.
     *   arrivedFeeAmount ₹ (flat) or 0-100 (percentage) — admin picks.
     *
     * Defaults: flat ₹250. The customer always sees a deterministic
     * deduction in the cancellation preview either way.
     */
    arrivedFeeType: {
      type: String,
      enum: ['flat', 'percentage'],
      default: 'flat',
    },
    arrivedFeeAmount: { type: Number, default: 250, min: 0 },

    /**
     * Split of every cancellation fee between the driver who was
     * mobilised and the platform. `driverSharePercent` is the % the
     * driver receives (credited to their wallet on cancel); the rest
     * flows into the platform's revenue ledger.
     *
     *   driverSharePercent = 0   → 100% to platform (default)
     *   driverSharePercent = 30  → 30% to driver, 70% to platform
     *   driverSharePercent = 100 → 100% to driver, platform gets nothing
     */
    driverSharePercent: { type: Number, default: 0, min: 0, max: 100 },

    /**
     * @deprecated Old flat-only knob from a prior revision. Kept so
     * legacy admin docs read back cleanly; the runtime falls back to
     * this only if `arrivedFeeAmount` is missing.
     */
    flatFeeAfterArrival: { type: Number, default: 250, min: 0 },
    /**
     * @deprecated Earlier percentage-only knob. Kept for back-compat.
     */
    arrivedFeePercent: { type: Number, default: 0, min: 0, max: 100 },
    /**
     * @deprecated Earliest revision — single user-wide percentage. Kept
     * for back-compat; runtime never reads it.
     */
    userCancellationFeePercent: { type: Number, default: 0, min: 0, max: 100 },

    /** Flat ₹ deducted from driver wallet when the driver cancels. */
    driverCancellationPenalty: { type: Number, default: 50, min: 0 },
    /**
     * @deprecated Older user-side "free cancel window" knob that was
     * never enforced — user-cancel fees are status-driven, not
     * time-driven (see `computeUserCancellation`). The driver-side
     * grace lives on `driverGraceMinutes` below. Kept here so legacy
     * pricing docs still load; runtime ignores it.
     */
    freeCancellationMinutes: { type: Number, default: 2, min: 0 },

    /**
     * Driver grace window — minutes a driver can cancel after accepting
     * a booking without incurring `driverCancellationPenalty`, provided
     * they still have free cancellations left today. After this window
     * (or once the daily quota is exhausted) the flat ₹ penalty applies.
     */
    driverGraceMinutes: { type: Number, default: 2, min: 0 },
    /**
     * Free driver cancellations allowed per calendar day. Each driver
     * cancellation — penalty or not — decrements the counter. When the
     * counter hits zero, every subsequent cancel for the rest of the day
     * charges the penalty regardless of the grace window.
     */
    driverDailyFreeCancellations: { type: Number, default: 3, min: 0 },
  },
  { _id: false },
);

const driverSearchSchema = new mongoose.Schema(
  {
    searchTimeoutMinutes: { type: Number, default: 5, min: 1 },
    searchRadiusKm: { type: Number, default: 10, min: 1 },
    maxRetries: { type: Number, default: 3, min: 1 },
  },
  { _id: false },
);

const servicePricingSchema = new mongoose.Schema(
  {
    // ── Service identity ──
    serviceType: {
      type: String,
      enum: SERVICE_TYPE_LIST,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    icon: { type: String, default: '', trim: true },

    // ── Hourly-only: time slabs ──
    slabs: { type: [slabSchema], default: [] },
    /** ₹ per extra hour beyond the booked slab (hourly only). */
    extraHourCharge: { type: Number, default: 0, min: 0 },
    waitingCharge: { type: waitingChargeSchema, default: () => ({}) },
    /** Hourly-only: opt-in custom-duration knob, lets users go beyond slabs. */
    customHours: { type: customHoursSchema, default: () => ({}) },

    // ── Outstation-only block ──
    outstation: { type: outstationSchema, default: () => ({}) },

    // ── Shared extras ──
    nightCharge: { type: nightChargeSchema, default: () => ({}) },
    tollParkingEnabled: { type: Boolean, default: true },
    foodAllowance: { type: foodAllowanceSchema, default: () => ({}) },
    /** Hourly-only driver accommodation allowance (long bookings). */
    stayAllowance: { type: stayAllowanceSchema, default: () => ({}) },

    // ── Platform charges (shared) ──
    serviceChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    gstPercent: { type: Number, default: 18, min: 0, max: 100 },
    platformCommissionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Policies (shared) ──
    cancellation: { type: cancellationSchema, default: () => ({}) },
    driverSearch: { type: driverSearchSchema, default: () => ({}) },

    // ── Visibility ──
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

servicePricingSchema.index({ isActive: 1, sortOrder: 1 });

const ServicePricing =
  mongoose.models.ServicePricing || mongoose.model('ServicePricing', servicePricingSchema);

export default ServicePricing;
