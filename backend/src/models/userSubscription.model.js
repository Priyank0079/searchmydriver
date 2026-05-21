import mongoose from 'mongoose';
import {
  SUBSCRIPTION_DISCOUNT_TYPES,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_ASSIGNMENT_STATUS,
} from '../constants/serviceTypes.js';

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.ACTIVE,
      index: true,
    },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },

    // ── Payment (Razorpay) ──
    amount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    paymentMethod: { type: String, default: '' },
    paidAt: { type: Date, default: null },

    // ── Dedicated driver assignment ──
    assignmentStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_ASSIGNMENT_STATUS),
      default: SUBSCRIPTION_ASSIGNMENT_STATUS.PENDING,
      index: true,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true,
    },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: '' },
    /** History of previously-assigned drivers (when reassignment happens). */
    previousAssignments: {
      type: [
        new mongoose.Schema(
          {
            driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
            assignedAt: Date,
            releasedAt: Date,
            releaseReason: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    // ── Plan snapshot (so later plan edits don't retro-affect existing subscribers) ──
    durationMonths: { type: Number, required: true, min: 1 },
    includedHoursPerDay: { type: Number, default: 0, min: 0, max: 24 },
    bookingDiscountType: {
      type: String,
      enum: Object.values(SUBSCRIPTION_DISCOUNT_TYPES),
      default: SUBSCRIPTION_DISCOUNT_TYPES.PERCENTAGE,
    },
    bookingDiscountValue: { type: Number, default: 0, min: 0 },
    planNameSnapshot: { type: String, default: '' },
  },
  { timestamps: true },
);

userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ expiryDate: 1 });

const UserSubscription =
  mongoose.models.UserSubscription ||
  mongoose.model('UserSubscription', userSubscriptionSchema);

export default UserSubscription;
