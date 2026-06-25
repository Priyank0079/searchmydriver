import Banner from '../models/banner.model.js';
import { ApiError } from '../utils/apiError.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';

export const listBannersService = async ({ onlyActive = true } = {}) => {
  const filter = onlyActive ? { isActive: true } : {};
  return await Banner.find(filter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();
};

export const createBannerService = async (payload, adminId) => {
  return await Banner.create({ ...payload, createdBy: adminId });
};

export const updateBannerService = async (bannerId, payload) => {
  const banner = await Banner.findById(bannerId);
  if (!banner) throw new ApiError(404, 'Banner not found');

  if (payload.imagePublicId && payload.imagePublicId !== banner.imagePublicId) {
    if (banner.imagePublicId) {
      await deleteFromCloudinary(banner.imagePublicId, 'image').catch(() => {});
    }
  }

  Object.assign(banner, payload);
  await banner.save();
  return banner;
};

export const deleteBannerService = async (bannerId) => {
  const banner = await Banner.findById(bannerId);
  if (!banner) throw new ApiError(404, 'Banner not found');

  if (banner.imagePublicId) {
    await deleteFromCloudinary(banner.imagePublicId, 'image').catch(() => {});
  }
  await banner.deleteOne();
};
