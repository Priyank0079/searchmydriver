import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index. Document will be deleted when current time >= expiresAt
    },
  },
  { timestamps: true }
);

export const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);
