import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import * as driverHistoryService from '../services/driverHistory.service.js';

export const getMyOrders = asyncHandler(async (req, res) => {
  const result = await driverHistoryService.getDriverOrdersService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Orders fetched'));
});

export const getMyOrderById = asyncHandler(async (req, res) => {
  const result = await driverHistoryService.getDriverOrderByIdService(
    req.driver._id,
    req.params.id,
  );
  if (!result) throw new ApiError(404, 'Order not found');
  return res.status(200).json(new ApiResponse(200, result, 'Order fetched'));
});

export const getMyPaymentHistory = asyncHandler(async (req, res) => {
  const result = await driverHistoryService.getDriverPaymentHistoryService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Payment history fetched'));
});
