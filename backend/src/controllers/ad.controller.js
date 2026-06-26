import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as adService from '../services/ad.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { AD_IMAGE_MAX } from '../middlewares/multer.js';

/**
 * Upload an ad's media file (image or short video) to Cloudinary and
 * return the CDN URL + publicId. The admin UI then includes those in
 * the create/update payload for `adminCreateAd` / `adminUpdateAd`.
 *
 * We delegate the `resource_type` detection to Cloudinary via `auto`
 * so a single endpoint handles both image and video uploads.
 */
export const adminUploadAdMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file provided');
  const mime = (req.file.mimetype || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  if (isImage && req.file.size > AD_IMAGE_MAX) {
    throw new ApiError(
      413,
      `Ad image must be at most ${Math.round(AD_IMAGE_MAX / 1024 / 1024)} MB`,
    );
  }
  const result = await uploadToCloudinary(req.file.buffer, 'searchmydriver/ads', {
    resourceType: 'auto',
  });
  // Best-effort cleanup of a previously-uploaded asset when the admin
  // swaps the media before saving the form.
  if (req.body.oldPublicId) {
    const oldType = (req.body.oldMediaType || '').toLowerCase() === 'video' ? 'video' : 'image';
    await deleteFromCloudinary(req.body.oldPublicId, oldType);
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        url: result.secure_url,
        publicId: result.public_id,
        mediaType: isImage ? 'image' : 'video',
      },
      'Ad media uploaded successfully',
    ),
  );
});

export const adminListAds = asyncHandler(async (_req, res) => {
  const ads = await adService.listAdsService({ onlyActive: false });
  return res
    .status(200)
    .json(new ApiResponse(200, ads, 'Ads fetched successfully'));
});

export const adminCreateAd = asyncHandler(async (req, res) => {
  const ad = await adService.createAdService(req.body, req.user?._id);
  return res.status(201).json(new ApiResponse(201, ad, 'Ad created successfully'));
});

export const adminUpdateAd = asyncHandler(async (req, res) => {
  const ad = await adService.updateAdService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, ad, 'Ad updated successfully'));
});

export const adminDeleteAd = asyncHandler(async (req, res) => {
  await adService.deleteAdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Ad deleted successfully'));
});

/** Public endpoint — returns only the active ads, ordered for display. */
export const listActiveAds = asyncHandler(async (_req, res) => {
  const ads = await adService.listAdsService({ onlyActive: true });
  return res.status(200).json(new ApiResponse(200, ads, 'Ads fetched successfully'));
});
