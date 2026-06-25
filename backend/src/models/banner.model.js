import mongoose from 'mongoose';

/**
 * Top Banners shown below the search bar on the user home screen.
 * Restricts media to images only with a 16:9 ratio.
 */
const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    imagePublicId: {
      type: String,
      default: '',
      trim: true,
    },
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

bannerSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;
