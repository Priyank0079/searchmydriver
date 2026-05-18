import mongoose from 'mongoose';
import { PAYMENT_PROVIDER, PAYMENT_PURPOSE } from '../constants/kitStatus.js';

const paymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: PAYMENT_PROVIDER.RAZORPAY },
    purpose: {
      type: String,
      enum: Object.values(PAYMENT_PURPOSE),
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    referenceModel: { type: String, default: 'KitOrder' },

    razorpayOrderId: { type: String, default: '', index: true },
    /** Only set after successful Razorpay payment — never store empty string */
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },

    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },

    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'created',
    },
    method: { type: String, default: '' },
    failureReason: { type: String, default: '' },

    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', index: true },
  },
  { timestamps: true },
);

paymentSchema.index(
  { referenceId: 1, referenceModel: 1 },
  { unique: true },
);

paymentSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;
