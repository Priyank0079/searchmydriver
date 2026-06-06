import mongoose from 'mongoose';

/**
 * Promotional/marketing ad shown to users on the home screen.
 *
 * Each ad is either an image OR a short video uploaded to Cloudinary
 * by an admin/sub_admin. Tapping an ad with a non-empty `linkUrl`
 * opens that link in a new browser tab — admins use this to drive
 * users to landing pages, app updates, partner offers, etc.
 *
 * The user-facing list is filtered to `isActive: true` and ordered by
 * `sortOrder` (asc) so admins can pin priority ads to the top without
 * touching timestamps.
 */
const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },
    /**
     * Cloudinary `public_id`. We keep it so the service can delete the
     * underlying asset when the admin removes the ad or swaps the
     * media on edit.
     */
    mediaPublicId: {
      type: String,
      default: '',
      trim: true,
    },
    /**
     * Optional click-through URL. When set, the user app opens it in
     * a new tab (`target="_blank"`, `rel="noopener noreferrer"`).
     * Stored as-is; the FE normalises missing schemes to `https://`.
     */
    linkUrl: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

adSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

const Ad = mongoose.models.Ad || mongoose.model('Ad', adSchema);
export default Ad;
