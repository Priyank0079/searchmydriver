import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'referrerType',
      index: true,
    },
    referrerType: {
      type: String,
      enum: ['User', 'Driver'],
      required: true,
    },
    referredId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'referredType',
      index: true,
    },
    referredType: {
      type: String,
      enum: ['User', 'Driver'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'successful', 'rejected'],
      default: 'pending',
      index: true,
    },
    rewardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    signupBonusAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    triggerEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    triggerEntityType: {
      type: String,
      enum: ['Booking', 'Admin', ''],
      default: '',
    },
  },
  { timestamps: true }
);

referralSchema.index({ referrerId: 1, createdAt: -1 });

const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema);

export default Referral;
