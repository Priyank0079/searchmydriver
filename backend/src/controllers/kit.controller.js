import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as kitService from '../services/kit.service.js';

export const createKit = asyncHandler(async (req, res) => {
  const result = await kitService.createKitService(req.staff._id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Driver kit created'));
});

export const getKits = asyncHandler(async (req, res) => {
  const result = await kitService.getKitsService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Kits fetched'));
});

export const getKitById = asyncHandler(async (req, res) => {
  const result = await kitService.getKitByIdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit fetched'));
});

export const updateKit = asyncHandler(async (req, res) => {
  const result = await kitService.updateKitService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Kit updated'));
});

export const deleteKit = asyncHandler(async (req, res) => {
  const result = await kitService.deleteKitService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit deleted'));
});

export const getMandatoryKit = asyncHandler(async (req, res) => {
  const result = await kitService.getMandatoryKitService();
  return res.status(200).json(new ApiResponse(200, result, 'Mandatory kit fetched'));
});

export const getAvailableKits = asyncHandler(async (req, res) => {
  const result = await kitService.getKitsService({ activeOnly: true });
  return res.status(200).json(new ApiResponse(200, result, 'Available kits fetched'));
});
