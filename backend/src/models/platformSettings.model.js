import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    cashCancelFeeThresholdMinutes: { type: Number, default: 30, min: 0 },
    cashCancelFeeAmount: { type: Number, default: 50, min: 0 },
    driverCancelFeeAmount: { type: Number, default: 50, min: 0 },
    monthlyRideRegistrationFee: { type: Number, default: 2000, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referral: {
      user: {
        enabled: { type: Boolean, default: false },
        rewardAmount: { type: Number, default: 100, min: 0 },
        signupBonus: { type: Number, default: 0, min: 0 },
        minRideAmountForEligibility: { type: Number, default: 0, min: 0 },
        walletExpiryDays: { type: Number, default: 365, min: 0 },
        maxWalletUsagePercentage: { type: Number, default: 10, min: 0, max: 100 },
        validityDays: { type: Number, default: 30, min: 0 },
        autoApproveRewards: { type: Boolean, default: true },
      },
      driver: {
        enabled: { type: Boolean, default: false },
        rewardAmount: { type: Number, default: 100, min: 0 },
        signupBonus: { type: Number, default: 0, min: 0 },
        minCompletedTripsForEligibility: { type: Number, default: 1, min: 0 },
        minEarningsForEligibility: { type: Number, default: 0, min: 0 },
        walletExpiryDays: { type: Number, default: 365, min: 0 },
        maxWalletUsagePercentage: { type: Number, default: 10, min: 0, max: 100 },
        validityDays: { type: Number, default: 30, min: 0 },
        autoApproveRewards: { type: Boolean, default: true },
        withdrawalRules: { type: String, default: 'Minimum withdrawal \u20b9500' },
      },
    },
  },
  { timestamps: true },
);

const PlatformSettings = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
