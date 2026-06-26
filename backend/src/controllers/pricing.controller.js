import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as pricingService from '../services/pricing.service.js';

// ─── Admin: Service Pricing ───────────────────────────────────────────────────

export const adminListServicePricings = asyncHandler(async (_req, res) => {
  const list = await pricingService.listServicePricingsService({ onlyActive: false });
  return res.status(200).json(new ApiResponse(200, list, 'Service pricings fetched'));
});

export const adminUpsertServicePricing = asyncHandler(async (req, res) => {
  const staffId = req.staff?._id || null;
  const saved = await pricingService.upsertServicePricingService(req.body, staffId);
  return res.status(200).json(new ApiResponse(200, saved, 'Service pricing saved'));
});

export const adminUpdateServicePricing = asyncHandler(async (req, res) => {
  const staffId = req.staff?._id || null;
  const updated = await pricingService.updateServicePricingService(req.params.id, req.body, staffId);
  return res.status(200).json(new ApiResponse(200, updated, 'Service pricing updated'));
});

export const adminDeleteServicePricing = asyncHandler(async (req, res) => {
  await pricingService.deleteServicePricingService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Service pricing deleted'));
});


// ─── Public / User-facing ─────────────────────────────────────────────────────

export const getActiveServicePricings = asyncHandler(async (_req, res) => {
  const list = await pricingService.listServicePricingsService({ onlyActive: true });
  return res.status(200).json(new ApiResponse(200, list, 'Active service pricings fetched'));
});

/**
 * Fare estimate before the user confirms a booking.
 * Body: { serviceType, slabId, bookedHours, scheduledAt, foodProvided }
 */
export const estimateFare = asyncHandler(async (req, res) => {
  const userId = req.user?._id || null;
  const {
    serviceType,
    slabId = null,
    bookedHours = null,
    scheduledAt = null,
    foodProvided = true,
    stayProvided = true,
    waitingMinutes = 0,
    tollParking = 0,
    days = null,
    actualKm = 0,
  } = req.body || {};

  const result = await pricingService.estimateFareService({
    serviceType,
    slabId,
    bookedHours,
    scheduledAt,
    foodProvided,
    stayProvided,
    waitingMinutes,
    tollParking,
    days,
    actualKm,
    userId,
  });

  return res.status(200).json(new ApiResponse(200, result, 'Fare estimated'));
});
