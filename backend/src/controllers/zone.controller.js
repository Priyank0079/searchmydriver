import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as zoneService from '../services/zone.service.js';

export const createZone = asyncHandler(async (req, res) => {
  const result = await zoneService.createZoneService(req.staff._id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Zone created successfully'));
});

export const listZones = asyncHandler(async (req, res) => {
  const result = await zoneService.listZonesService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Zones fetched'));
});

export const getZoneById = asyncHandler(async (req, res) => {
  const result = await zoneService.getZoneByIdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Zone fetched'));
});

export const updateZone = asyncHandler(async (req, res) => {
  const result = await zoneService.updateZoneService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Zone updated successfully'));
});

export const deleteZone = asyncHandler(async (req, res) => {
  const result = await zoneService.deleteZoneService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Zone deleted'));
});

/** Public / driver — active zones for matching (future dispatch) */
export const listActiveZones = asyncHandler(async (req, res) => {
  const result = await zoneService.listZonesService({ activeOnly: true });
  return res.status(200).json(new ApiResponse(200, result, 'Active zones fetched'));
});
