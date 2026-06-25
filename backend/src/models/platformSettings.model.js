import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    cashCancelFeeThresholdMinutes: { type: Number, default: 30, min: 0 },
    cashCancelFeeAmount: { type: Number, default: 50, min: 0 },
    driverCancelFeeAmount: { type: Number, default: 50, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

const PlatformSettings = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
