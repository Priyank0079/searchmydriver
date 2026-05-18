import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as driverOnlineService from '../services/driverOnline.service.js';

export const getOnlineStatus = asyncHandler(async (req, res) => {
  const result = await driverOnlineService.getOnlineStatusService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Online status fetched'));
});

export const setOnlineStatus = asyncHandler(async (req, res) => {
  const { online } = req.body;
  if (typeof online !== 'boolean') {
    return res.status(400).json({ status: 400, message: 'online must be a boolean' });
  }
  const result = await driverOnlineService.setDriverOnlineService(req.driver._id, online);
  return res.status(200).json(new ApiResponse(200, result, online ? 'You are now online' : 'You are now offline'));
});
