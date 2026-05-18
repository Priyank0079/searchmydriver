import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as adminTaskService from '../services/adminTask.service.js';

export const getTaskAssignees = asyncHandler(async (_req, res) => {
  const result = await adminTaskService.getStaffAssigneesService();
  return res.status(200).json(new ApiResponse(200, result, 'Assignees fetched'));
});

export const getTaskSummary = asyncHandler(async (req, res) => {
  const result = await adminTaskService.getTaskSummaryService(req.staff);
  return res.status(200).json(new ApiResponse(200, result, 'Task summary fetched'));
});

export const listTasks = asyncHandler(async (req, res) => {
  const result = await adminTaskService.listTasksService(req.staff, req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Tasks fetched'));
});

export const listTaskActivity = asyncHandler(async (req, res) => {
  const result = await adminTaskService.listTaskActivityLogService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Task activity fetched'));
});

export const getTaskByResource = asyncHandler(async (req, res) => {
  const { taskType, resourceId } = req.query;
  const result = await adminTaskService.getTaskByResourceService(
    req.staff,
    taskType,
    resourceId,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Task fetched'));
});

export const assignTasks = asyncHandler(async (req, res) => {
  const result = await adminTaskService.assignTasksService(req.staff, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Tasks assigned'));
});

export const assignTask = asyncHandler(async (req, res) => {
  const result = await adminTaskService.assignTaskToService(req.staff, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Task assigned'));
});

export const claimTask = asyncHandler(async (req, res) => {
  const result = await adminTaskService.claimTaskService(
    req.staff,
    req.params.id,
    req.body?.note,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Task claimed'));
});

export const syncReviewTasks = asyncHandler(async (_req, res) => {
  const result = await adminTaskService.syncAllOpenReviewTasksService();
  return res.status(200).json(new ApiResponse(200, result, 'Review tasks synced'));
});
