import mongoose from 'mongoose';
import { SUBSCRIPTION_DISCOUNT_TYPES } from '../constants/serviceTypes.js';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Months a single purchase remains active. */
    durationMonths: { type: Number, required: true, min: 1 },
    /** One-time price the user pays to activate the plan. */
    price: { type: Number, required: true, min: 0 },

    // ── Dedicated driver assignment ──
    /**
     * Hours per day the dedicated driver is available to the subscriber.
     * `0` = always-available (full-time chauffeur model).
     */
    includedHoursPerDay: { type: Number, default: 0, min: 0, max: 24 },

    // ── Discount on additional (non-subscription) bookings ──
    bookingDiscountType: {
      type: String,
      enum: Object.values(SUBSCRIPTION_DISCOUNT_TYPES),
      default: SUBSCRIPTION_DISCOUNT_TYPES.PERCENTAGE,
    },
    /**
     * Percentage (1-100) or flat ₹ off on additional bookings the subscriber makes
     * (e.g. when the dedicated driver is unavailable, or extra rides).
     */
    bookingDiscountValue: { type: Number, default: 0, min: 0 },

    description: { type: String, default: '', trim: true },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

const SubscriptionPlan =
  mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

export default SubscriptionPlan;
