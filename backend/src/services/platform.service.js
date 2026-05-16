import CarType from '../models/carType.model.js';
import PlatformCondition from '../models/platformCondition.model.js';
import { ApiError } from '../utils/apiError.js';

// ─── Car Types ────────────────────────────────────────────────────────────────

export const createCarTypeService = async (data) => {
  const { name, description, image } = data;
  if (!name) throw new ApiError(400, 'Car type name is required');
  
  const exists = await CarType.findOne({ name });
  if (exists) throw new ApiError(400, 'Car type already exists');

  return await CarType.create({ name, description, image });
};

export const getAllCarTypesService = async (onlyActive = false) => {
  const filter = onlyActive ? { isActive: true } : {};
  return await CarType.find(filter).sort({ name: 1 });
};

export const updateCarTypeService = async (id, data) => {
  const carType = await CarType.findByIdAndUpdate(id, data, { new: true });
  if (!carType) throw new ApiError(404, 'Car type not found');
  return carType;
};

export const deleteCarTypeService = async (id) => {
  const carType = await CarType.findByIdAndDelete(id);
  if (!carType) throw new ApiError(404, 'Car type not found');
  return { id };
};

// ─── Platform Conditions (Checklist) ──────────────────────────────────────────

export const createConditionService = async (data) => {
  const { question, key, isRequired } = data;
  if (!question || !key) throw new ApiError(400, 'Question and key are required');

  const exists = await PlatformCondition.findOne({ key: key.toLowerCase() });
  if (exists) throw new ApiError(400, 'Condition key already exists');

  return await PlatformCondition.create({ question, key: key.toLowerCase(), isRequired });
};

export const getAllConditionsService = async (onlyActive = false) => {
  const filter = onlyActive ? { isActive: true } : {};
  return await PlatformCondition.find(filter).sort({ createdAt: 1 });
};

export const updateConditionService = async (id, data) => {
  const condition = await PlatformCondition.findByIdAndUpdate(id, data, { new: true });
  if (!condition) throw new ApiError(404, 'Condition not found');
  return condition;
};

export const deleteConditionService = async (id) => {
  const condition = await PlatformCondition.findByIdAndDelete(id);
  if (!condition) throw new ApiError(404, 'Condition not found');
  return { id };
};
