import mongoose from 'mongoose';

const kitVariantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const kitItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    qty: { type: Number, default: 1, min: 1 },
    hasVariants: { type: Boolean, default: false },
    variantLabel: { type: String, default: 'Size', trim: true },
    variants: { type: [kitVariantSchema], default: [] },
  },
  { _id: true },
);

const driverKitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true },
    items: { type: [kitItemSchema], default: [] },
    isMandatory: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

driverKitSchema.index({ isMandatory: 1, isActive: 1 });

const DriverKit = mongoose.models.DriverKit || mongoose.model('DriverKit', driverKitSchema);
export default DriverKit;
