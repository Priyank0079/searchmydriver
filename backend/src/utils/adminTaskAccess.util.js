import mongoose from 'mongoose';
import { OPEN_TASK_STATUSES } from '../constants/adminTask.js';
import { hasOperationalStaffAccess } from '../constants/staffPermissions.js';
import { ApiError } from './apiError.js';

/** Team members may only see/act on tasks assigned to them. */
export function staffAssignedToFilter(staff) {
  if (hasOperationalStaffAccess(staff)) return {};
  return { assignedTo: staff._id };
}

export function sanitizeTaskForResponse(task, { includeActivityLog = false } = {}) {
  if (!task) return null;
  const doc = typeof task.toObject === 'function' ? task.toObject() : { ...task };
  if (!includeActivityLog) {
    delete doc.activityLog;
  }
  return doc;
}

export function sanitizeTasksForResponse(tasks, options) {
  return (tasks || []).map((t) => sanitizeTaskForResponse(t, options));
}

/**
 * Build Mongo filter for listing tasks. Team scope is enforced server-side only.
 */
export function buildTaskListFilter(staff, query = {}) {
  const { scope = 'all', taskType, status, assigneeId, search, category } = query;

  const filter = { ...staffAssignedToFilter(staff) };

  if (taskType) filter.taskType = taskType;
  if (category) filter.category = category;
  if (status) filter.status = status;
  else filter.status = { $in: OPEN_TASK_STATUSES };

  if (hasOperationalStaffAccess(staff)) {
    if (scope === 'mine') {
      filter.assignedTo = staff._id;
    } else if (scope === 'unassigned') {
      filter.assignedTo = null;
    } else if (scope === 'assigned') {
      filter.assignedTo = { $ne: null };
    } else if (assigneeId) {
      filter.assignedTo = assigneeId === 'unassigned' ? null : assigneeId;
    }
  }

  if (search?.trim()) {
    const q = search.trim();
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
  }

  return filter;
}

/**
 * Resolve resource IDs from open tasks (drivers, orders, etc.).
 * Returns null when no task-based restriction should apply (operations staff, all records).
 */
export async function resolveResourceIdsFromTasks(AdminTask, staff, taskType, assigneeId) {
  const taskFilter = {
    taskType,
    status: { $in: OPEN_TASK_STATUSES },
    ...staffAssignedToFilter(staff),
  };

  if (hasOperationalStaffAccess(staff)) {
    if (assigneeId === 'unassigned') taskFilter.assignedTo = null;
    else if (assigneeId) taskFilter.assignedTo = assigneeId;
    else return null;
  }

  const taskDocs = await AdminTask.find(taskFilter).select('resourceId').lean();
  return taskDocs.map((t) => t.resourceId);
}

/**
 * Read access: operations staff see all; team members need any task they owned (open or completed).
 */
export async function assertStaffCanAccessResource(staff, AdminTask, taskType, resourceId) {
  if (hasOperationalStaffAccess(staff)) return;

  const task = await AdminTask.findOne({
    taskType,
    resourceId,
    $or: [{ assignedTo: staff._id }, { completedBy: staff._id }],
  }).select('_id status');

  if (!task) {
    throw new ApiError(403, 'You do not have access to this record');
  }
}

export function parseObjectId(id, fieldName = 'id') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(id);
}
