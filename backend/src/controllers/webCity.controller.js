import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import WebCity from '../models/webCity.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

export const adminListCities = asyncHandler(async (req, res) => {
  const cities = await WebCity.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
  return res.status(200).json(new ApiResponse(200, cities, 'Cities fetched successfully'));
});

export const adminCreateCity = asyncHandler(async (req, res) => {
  const { name, imageUrl, imagePublicId, sortOrder, isActive } = req.body;
  if (!name || !imageUrl) {
    throw new ApiError(400, 'Name and Image URL are required');
  }

  const city = await WebCity.create({
    name,
    imageUrl,
    imagePublicId,
    sortOrder: Number(sortOrder) || 0,
    isActive: isActive !== false,
  });

  return res.status(201).json(new ApiResponse(201, city, 'City created successfully'));
});

export const adminUpdateCity = asyncHandler(async (req, res) => {
  const { name, imageUrl, imagePublicId, sortOrder, isActive } = req.body;
  const city = await WebCity.findById(req.params.id);
  if (!city) {
    throw new ApiError(404, 'City not found');
  }

  // Cleanup old asset if replaced
  if (imagePublicId && imagePublicId !== city.imagePublicId && city.imagePublicId) {
    await deleteFromCloudinary(city.imagePublicId, 'image').catch(() => {});
  }

  city.name = name ?? city.name;
  city.imageUrl = imageUrl ?? city.imageUrl;
  city.imagePublicId = imagePublicId ?? city.imagePublicId;
  city.sortOrder = sortOrder !== undefined ? Number(sortOrder) : city.sortOrder;
  city.isActive = isActive !== undefined ? isActive : city.isActive;

  await city.save();

  return res.status(200).json(new ApiResponse(200, city, 'City updated successfully'));
});

export const adminDeleteCity = asyncHandler(async (req, res) => {
  const city = await WebCity.findById(req.params.id);
  if (!city) {
    throw new ApiError(404, 'City not found');
  }

  if (city.imagePublicId) {
    await deleteFromCloudinary(city.imagePublicId, 'image').catch(() => {});
  }

  await city.deleteOne();

  return res.status(200).json(new ApiResponse(200, null, 'City deleted successfully'));
});

export const adminUploadCityMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file provided');
  
  const result = await uploadToCloudinary(req.file.buffer, 'searchmydriver/cities', {
    resourceType: 'image',
    transformation: [{ format: 'webp', quality: 'auto:eco' }],
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
      'City media uploaded successfully',
    ),
  );
});

export const listActiveCities = asyncHandler(async (req, res) => {
  const cities = await WebCity.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
  return res.status(200).json(new ApiResponse(200, cities, 'Active cities fetched successfully'));
});
