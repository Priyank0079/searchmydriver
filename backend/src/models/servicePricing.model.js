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
    freeWaitingMinutes: { type: Number, default: 15, min: 0 },
    chargePerMinute: { type: Number, default: 2, min: 0 },
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
  },
  { _id: false },
);

const foodAllowanceSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    /** ₹ added per day when the customer does NOT provide food. */
    amount: { type: Number, default: 0, min: 0 },
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
    /** Percentage of paid amount deducted on user-initiated cancellation (after free window). */
    userCancellationFeePercent: { type: Number, default: 15, min: 0, max: 100 },
    /** Flat ₹ deducted from driver wallet when the driver cancels. */
    driverCancellationPenalty: { type: Number, default: 50, min: 0 },
    /** Minutes after booking during which the user can cancel free of charge. */
    freeCancellationMinutes: { type: Number, default: 2, min: 0 },
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

    // ── Outstation-only block ──
    outstation: { type: outstationSchema, default: () => ({}) },

    // ── Shared extras ──
    nightCharge: { type: nightChargeSchema, default: () => ({}) },
    tollParkingEnabled: { type: Boolean, default: true },
    foodAllowance: { type: foodAllowanceSchema, default: () => ({}) },

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
