import mongoose from 'mongoose';

const DOCUMENT_TYPES = [
  'driving_license', 'selfie', 'aadhaar_front', 'aadhaar_back', 'police_verification',
  'address_proof', 'driver_registration', 'live_selfie'
];

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: DOCUMENT_TYPES,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true },
);

export default documentSchema;
