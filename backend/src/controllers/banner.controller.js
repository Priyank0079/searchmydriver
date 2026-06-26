import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as bannerService from '../services/banner.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { AD_IMAGE_MAX } from '../middlewares/multer.js';

export const adminUploadBannerMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file provided');
  const mime = (req.file.mimetype || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  
  if (!isImage) {
    throw new ApiError(400, 'Top Banners only support images');
  }

  if (req.file.size > AD_IMAGE_MAX) {
    throw new ApiError(
      413,
      `Banner image must be at most ${Math.round(AD_IMAGE_MAX / 1024 / 1024)} MB`,
    );
  }
  
  const result = await uploadToCloudinary(req.file.buffer, 'searchmydriver/banners', {
    resourceType: 'image',
  });

  if (req.body.oldPublicId) {
    await deleteFromCloudinary(req.body.oldPublicId, 'image').catch(() => {});
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        url: result.secure_url,
        publicId: result.public_id,
      },
      'Banner image uploaded successfully',
    ),
  );
});

export const adminListBanners = asyncHandler(async (_req, res) => {
  const banners = await bannerService.listBannersService({ onlyActive: false });
  return res
    .status(200)
    .json(new ApiResponse(200, banners, 'Banners fetched successfully'));
});

export const adminCreateBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.createBannerService(req.body, req.user?._id);
  return res.status(201).json(new ApiResponse(201, banner, 'Banner created successfully'));
});

export const adminUpdateBanner = asyncHandler(async (req, res) => {
  const banner = await bannerService.updateBannerService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, banner, 'Banner updated successfully'));
});

export const adminDeleteBanner = asyncHandler(async (req, res) => {
  await bannerService.deleteBannerService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Banner deleted successfully'));
});

export const listActiveBanners = asyncHandler(async (_req, res) => {
  const banners = await bannerService.listBannersService({ onlyActive: true });
  return res.status(200).json(new ApiResponse(200, banners, 'Banners fetched successfully'));
});
