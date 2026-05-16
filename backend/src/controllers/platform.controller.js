import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as platformService from '../services/platform.service.js';

// ─── Car Types ────────────────────────────────────────────────────────────────

export const createCarType = asyncHandler(async (req, res) => {
  const carType = await platformService.createCarTypeService(req.body);
  return res.status(201).json(new ApiResponse(201, carType, 'Car type created successfully'));
});

export const getCarTypes = asyncHandler(async (req, res) => {
  const carTypes = await platformService.getAllCarTypesService(req.query.active === 'true');
  return res.status(200).json(new ApiResponse(200, carTypes, 'Car types fetched successfully'));
});

export const updateCarType = asyncHandler(async (req, res) => {
  const carType = await platformService.updateCarTypeService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, carType, 'Car type updated successfully'));
});

export const deleteCarType = asyncHandler(async (req, res) => {
  await platformService.deleteCarTypeService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Car type deleted successfully'));
});

// ─── Conditions ────────────────────────────────────────────────────────────────

export const createCondition = asyncHandler(async (req, res) => {
  const condition = await platformService.createConditionService(req.body);
  return res.status(201).json(new ApiResponse(201, condition, 'Condition created successfully'));
});

export const getConditions = asyncHandler(async (req, res) => {
  const conditions = await platformService.getAllConditionsService(req.query.active === 'true');
  return res.status(200).json(new ApiResponse(200, conditions, 'Conditions fetched successfully'));
});

export const updateCondition = asyncHandler(async (req, res) => {
  const condition = await platformService.updateConditionService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, condition, 'Condition updated successfully'));
});

export const deleteCondition = asyncHandler(async (req, res) => {
  await platformService.deleteConditionService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Condition deleted successfully'));
});

// ─── Training videos ───────────────────────────────────────────────────────────

export const createTrainingVideo = asyncHandler(async (req, res) => {
  const video = await platformService.createTrainingVideoService(req.body);
  return res.status(201).json(new ApiResponse(201, video, 'Training video created successfully'));
});

export const getTrainingVideos = asyncHandler(async (req, res) => {
  const videos = await platformService.getAllTrainingVideosService(req.query.active === 'true');
  return res.status(200).json(new ApiResponse(200, videos, 'Training videos fetched successfully'));
});

export const updateTrainingVideo = asyncHandler(async (req, res) => {
  const video = await platformService.updateTrainingVideoService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, video, 'Training video updated successfully'));
});

export const deleteTrainingVideo = asyncHandler(async (req, res) => {
  await platformService.deleteTrainingVideoService(req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Training video deleted successfully'));
});
