import mongoose from 'mongoose';
import {
  PAYMENT_STATUS,
  KIT_ADMIN_STATUS,
  FULFILLMENT_STATUS,
} from '../constants/kitStatus.js';

const statusHistorySchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    from: { type: String, default: '' },
    to: { type: String, required: true },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: '', trim: true },
    line2: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const selectedVariantSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    label: { type: String, default: '' },
  },
  { _id: false },
);

const itemSelectionSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    name: { type: String, default: '' },
    image: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    hasVariants: { type: Boolean, default: false },
    variantLabel: { type: String, default: '' },
    selectedVariant: { type: selectedVariantSchema, default: null },
  },
  { _id: false },
);

const kitSnapshotItemSchema = new mongoose.Schema(
  {
    name: String,
    image: String,
    description: String,
    qty: Number,
    hasVariants: Boolean,
    variantLabel: String,
    variants: [{ id: String, label: String }],
  },
  { _id: false },
);

const kitOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    kitId: { type: mongoose.Schema.Types.ObjectId, ref: 'DriverKit', required: true },

    kitSnapshot: {
      name: String,
      price: Number,
      currency: String,
      items: [kitSnapshotItemSchema],
      itemSelections: [itemSelectionSchema],
      version: Number,
    },

    itemSelections: { type: [itemSelectionSchema], default: [] },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    razorpayOrderId: { type: String, default: '', index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },

    adminStatus: {
      type: String,
      enum: Object.values(KIT_ADMIN_STATUS),
      default: KIT_ADMIN_STATUS.PENDING,
      index: true,
    },
    adminNote: { type: String, default: '', trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },

    fulfillmentStatus: {
      type: String,
      enum: Object.values(FULFILLMENT_STATUS),
      default: FULFILLMENT_STATUS.NOT_STARTED,
    },
    shippingAddress: { type: shippingAddressSchema, default: () => ({}) },
    tracking: {
      carrier: { type: String, default: '' },
      trackingId: { type: String, default: '' },
      trackingUrl: { type: String, default: '' },
      dispatchedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },

    invoice: {
      number: { type: String, default: '' },
      url: { type: String, default: '' },
      generatedAt: { type: Date, default: null },
    },

    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true },
);

kitOrderSchema.index({ driverId: 1, createdAt: -1 });
kitOrderSchema.index({ paymentStatus: 1, adminStatus: 1 });

const KitOrder = mongoose.models.KitOrder || mongoose.model('KitOrder', kitOrderSchema);
export default KitOrder;
