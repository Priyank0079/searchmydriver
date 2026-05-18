import AdminTask from '../models/adminTask.model.js';
import User from '../models/user.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import KitOrder from '../models/kitOrder.model.js';
import {
  TASK_TYPE,
  TASK_STATUS,
  OPEN_TASK_STATUSES,
  getTaskTypeConfig,
} from '../constants/adminTask.js';
import { PAYMENT_STATUS, KIT_ADMIN_STATUS } from '../constants/kitStatus.js';
import { USER_ROLES } from '../constants/roles.js';
import {
  STAFF_ROLES,
  hasOperationalStaffAccess,
  canManageTaskAssignment,
} from '../constants/staffPermissions.js';
import { ApiError } from '../utils/apiError.js';
import { appendTaskActivity } from '../utils/adminTaskActivity.util.js';
import {
  buildTaskListFilter,
  sanitizeTaskForResponse,
  sanitizeTasksForResponse,
  resolveResourceIdsFromTasks,
  assertStaffCanAccessResource,
  parseObjectId,
} from '../utils/adminTaskAccess.util.js';

function formatStaffName(staff) {
  return staff?.name || staff?.email || 'Staff';
}

function emptyPagination(page, limit) {
  return {
    data: [],
    pagination: {
      total: 0,
      page: parseInt(page, 10) || 1,
      pages: 1,
    },
  };
}

export async function getStaffAssigneesService() {
  return User.find({
    role: { $in: STAFF_ROLES },
    isActive: true,
    isDeleted: false,
  })
    .select('name email role')
    .sort({ name: 1 })
    .lean();
}

export async function getTaskSummaryService(staff) {
  const base = { status: { $in: OPEN_TASK_STATUSES } };

  if (!hasOperationalStaffAccess(staff)) {
    const mine = await AdminTask.countDocuments({
      ...base,
      assignedTo: staff._id,
    });
    return { mine, unassigned: 0, allOpen: mine };
  }

  const [unassigned, mine, allOpen] = await Promise.all([
    AdminTask.countDocuments({ ...base, assignedTo: null }),
    AdminTask.countDocuments({ ...base, assignedTo: staff._id }),
    AdminTask.countDocuments(base),
  ]);
  return { unassigned, mine, allOpen };
}

export async function listTasksService(staff, query = {}) {
  const { page = 1, limit = 20 } = query;
  const filter = buildTaskListFilter(staff, query);
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const limitNum = parseInt(limit, 10);

  const [tasks, total] = await Promise.all([
    AdminTask.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email')
      .populate('completedBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    AdminTask.countDocuments(filter),
  ]);

  const enriched = sanitizeTasksForResponse(
    await enrichTasksWithResource(tasks),
    { includeActivityLog: false },
  );

  return {
    tasks: enriched,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
}

export async function listTaskActivityLogService(query = {}) {
  const { taskType, taskId, category, page = 1, limit = 50 } = query;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
  const skip = (parseInt(page, 10) - 1) * limitNum;

  const match = {};
  if (taskType) match.taskType = taskType;
  if (category) match.category = category;
  if (taskId) match._id = parseObjectId(taskId, 'taskId');

  const [result] = await AdminTask.aggregate([
    { $match: match },
    { $unwind: '$activityLog' },
    { $sort: { 'activityLog.at': -1 } },
    {
      $facet: {
        entries: [
          { $skip: skip },
          { $limit: limitNum },
          {
            $project: {
              _id: 0,
              taskId: '$_id',
              taskType: 1,
              category: 1,
              title: 1,
              resourceId: 1,
              resourceModel: 1,
              status: 1,
              action: '$activityLog.action',
              by: '$activityLog.by',
              byName: '$activityLog.byName',
              note: '$activityLog.note',
              at: '$activityLog.at',
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]);

  const entries = result?.entries ?? [];
  const total = result?.totalCount?.[0]?.count ?? 0;

  return {
    entries,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
}

async function enrichTasksWithResource(tasks) {
  const driverIds = tasks
    .filter((t) => t.resourceModel === 'Driver')
    .map((t) => t.resourceId);
  const orderIds = tasks
    .filter((t) => t.resourceModel === 'KitOrder')
    .map((t) => t.resourceId);

  const [drivers, orders] = await Promise.all([
    driverIds.length
      ? Driver.find({ _id: { $in: driverIds } }).select('name phone approvalStatus').lean()
      : [],
    orderIds.length
      ? KitOrder.find({ _id: { $in: orderIds } })
          .select('orderNumber amount paymentStatus adminStatus kitSnapshot.name')
          .lean()
      : [],
  ]);

  const driverMap = new Map(drivers.map((d) => [String(d._id), d]));
  const orderMap = new Map(orders.map((o) => [String(o._id), o]));

  return tasks.map((task) => ({
    ...task,
    resource:
      task.resourceModel === 'Driver'
        ? driverMap.get(String(task.resourceId)) || null
        : task.resourceModel === 'KitOrder'
          ? orderMap.get(String(task.resourceId)) || null
          : null,
  }));
}

export async function getTaskByResourceService(staff, taskType, resourceId) {
  if (!taskType || !resourceId) {
    throw new ApiError(400, 'taskType and resourceId are required');
  }

  if (!hasOperationalStaffAccess(staff)) {
    const mine = await AdminTask.findOne({
      taskType,
      resourceId,
      status: { $in: OPEN_TASK_STATUSES },
      assignedTo: staff._id,
    })
      .populate('assignedTo', 'name email role')
      .select('-activityLog')
      .lean();
    if (!mine) return null;
    const [enriched] = await enrichTasksWithResource([mine]);
    return sanitizeTaskForResponse(enriched, { includeActivityLog: false });
  }

  const open = await AdminTask.findOne({
    taskType,
    resourceId,
    status: { $in: OPEN_TASK_STATUSES },
  })
    .populate('assignedTo', 'name email role')
    .populate('assignedBy', 'name email')
    .select('-activityLog')
    .sort({ createdAt: -1 })
    .lean();

  if (!open) {
    const latest = await AdminTask.findOne({ taskType, resourceId })
      .populate('assignedTo', 'name email role')
      .populate('completedBy', 'name email')
      .select('-activityLog')
      .sort({ createdAt: -1 })
      .lean();
    if (!latest) return null;
    const [enriched] = await enrichTasksWithResource([latest]);
    return sanitizeTaskForResponse(enriched, { includeActivityLog: false });
  }

  const [enriched] = await enrichTasksWithResource([open]);
  return sanitizeTaskForResponse(enriched, { includeActivityLog: false });
}

export async function attachReviewTasks(staff, items, taskType, idField = '_id') {
  if (!items?.length) return items;

  const ids = items.map((i) => i[idField]);
  const taskQuery = {
    taskType,
    resourceId: { $in: ids },
    status: { $in: OPEN_TASK_STATUSES },
  };

  if (!hasOperationalStaffAccess(staff)) {
    taskQuery.assignedTo = staff._id;
  }

  const tasks = await AdminTask.find(taskQuery)
    .populate('assignedTo', 'name email role')
    .select('-activityLog')
    .lean();

  const map = new Map(tasks.map((t) => [String(t.resourceId), t]));
  return items.map((item) => ({
    ...item,
    reviewTask: map.get(String(item[idField])) || null,
  }));
}

/** Restrict list queries to resources linked to the staff member's assigned tasks. */
export async function getResourceIdScopeForStaff(staff, taskType, assigneeId, page, limit) {
  const resourceIds = await resolveResourceIdsFromTasks(
    AdminTask,
    staff,
    taskType,
    assigneeId,
  );

  if (resourceIds === null) return null;

  if (!resourceIds.length) {
    return { empty: true, ...emptyPagination(page, limit) };
  }

  return { resourceIds };
}

async function findAssignee(assigneeId) {
  const assignee = await User.findOne({
    _id: assigneeId,
    role: { $in: STAFF_ROLES },
    isActive: true,
    isDeleted: false,
  });
  if (!assignee) throw new ApiError(404, 'Assignee not found or inactive');
  return assignee;
}

export async function assignTasksService(staff, { taskIds, assigneeId, note = '' }) {
  if (!hasOperationalStaffAccess(staff)) {
    throw new ApiError(403, 'Only admins can assign tasks to team members');
  }
  if (!taskIds?.length) throw new ApiError(400, 'Select at least one task');
  if (!assigneeId) throw new ApiError(400, 'Select a team member');

  const assignee = await findAssignee(assigneeId);
  const tasks = await AdminTask.find({
    _id: { $in: taskIds },
    status: { $in: OPEN_TASK_STATUSES },
  });

  if (!tasks.length) throw new ApiError(404, 'No open tasks found');

  const updated = [];
  for (const task of tasks) {
    task.assignedTo = assignee._id;
    task.assignedBy = staff._id;
    task.assignedAt = new Date();
    task.status = TASK_STATUS.ASSIGNED;
    appendTaskActivity(task, {
      action: 'assigned',
      by: staff._id,
      byName: formatStaffName(staff),
      note: note || `Assigned to ${formatStaffName(assignee)}`,
    });
    await task.save();
    updated.push(sanitizeTaskForResponse(task, { includeActivityLog: false }));
  }

  return { count: updated.length, assignee: { _id: assignee._id, name: assignee.name } };
}

export async function assignTaskToService(staff, taskId, { assigneeId, note = '' }) {
  return assignTasksService(staff, { taskIds: [taskId], assigneeId, note });
}

/** Self-claim is admin-only; team members receive assignments from admins. */
export async function claimTaskService(staff, taskId, note = '') {
  if (!hasOperationalStaffAccess(staff)) {
    throw new ApiError(403, 'Only admins can claim unassigned tasks');
  }

  const task = await AdminTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  if (!OPEN_TASK_STATUSES.includes(task.status)) {
    throw new ApiError(400, 'Task is no longer open');
  }

  task.assignedTo = staff._id;
  task.assignedBy = staff._id;
  task.assignedAt = new Date();
  task.status = TASK_STATUS.ASSIGNED;
  appendTaskActivity(task, {
    action: 'claimed',
    by: staff._id,
    byName: formatStaffName(staff),
    note: note || 'Claimed by admin',
  });
  await task.save();
  return sanitizeTaskForResponse(task, { includeActivityLog: false });
}

export async function assertStaffCanActOnResource(staff, taskType, resourceId) {
  if (hasOperationalStaffAccess(staff)) return null;

  const task = await AdminTask.findOne({
    taskType,
    resourceId,
    status: { $in: OPEN_TASK_STATUSES },
    assignedTo: staff._id,
  });

  if (!task) {
    throw new ApiError(
      403,
      'This record is not assigned to you. Contact an admin if you need access.',
    );
  }

  return task;
}

export { assertStaffCanAccessResource };

export async function completeTaskForResource(
  staff,
  taskType,
  resourceId,
  { action, note = '' } = {},
) {
  const task = await AdminTask.findOne({
    taskType,
    resourceId,
    status: { $in: OPEN_TASK_STATUSES },
    ...(hasOperationalStaffAccess(staff) ? {} : { assignedTo: staff._id }),
  });

  if (!task) return null;

  task.status = TASK_STATUS.COMPLETED;
  task.completedBy = staff._id;
  task.completedAt = new Date();
  task.completedAction = action || '';
  appendTaskActivity(task, {
    action: action || 'completed',
    by: staff._id,
    byName: formatStaffName(staff),
    note,
  });
  await task.save();
  return sanitizeTaskForResponse(task, { includeActivityLog: false });
}

function baseTaskFields(taskType, resourceId, resourceModel, title, description, extra = {}) {
  const config = getTaskTypeConfig(taskType);
  if (!config) throw new ApiError(500, `Task type not configured: ${taskType}`);

  return {
    taskType,
    category: config.category,
    resourceId,
    resourceModel: resourceModel || config.resourceModel,
    title,
    description,
    priority: extra.priority || config.defaultPriority || 'normal',
    metadata: extra.metadata || {},
    status: TASK_STATUS.OPEN,
    activityLog: extra.activityLog || [],
  };
}

export async function upsertDriverReviewTask(driver) {
  if (driver.approvalStatus !== 'under_review') {
    await AdminTask.updateMany(
      {
        taskType: TASK_TYPE.DRIVER_REVIEW,
        resourceId: driver._id,
        status: { $in: OPEN_TASK_STATUSES },
      },
      { $set: { status: TASK_STATUS.CANCELLED } },
    );
    return null;
  }

  let task = await AdminTask.findOne({
    taskType: TASK_TYPE.DRIVER_REVIEW,
    resourceId: driver._id,
    status: { $in: OPEN_TASK_STATUSES },
  });

  if (task) return task;

  task = await AdminTask.create(
    baseTaskFields(
      TASK_TYPE.DRIVER_REVIEW,
      driver._id,
      null,
      `Review driver: ${driver.name}`,
      'Driver application submitted — review documents and approve or reject.',
      {
        activityLog: [
          {
            action: 'created',
            by: null,
            byName: 'System',
            note: 'Driver submitted application',
            at: new Date(),
          },
        ],
      },
    ),
  );

  return task;
}

export async function upsertKitOrderReviewTask(order) {
  const needsReview =
    order.paymentStatus === PAYMENT_STATUS.PAID &&
    order.adminStatus === KIT_ADMIN_STATUS.PENDING;

  if (!needsReview) {
    await AdminTask.updateMany(
      {
        taskType: TASK_TYPE.KIT_ORDER_REVIEW,
        resourceId: order._id,
        status: { $in: OPEN_TASK_STATUSES },
      },
      { $set: { status: TASK_STATUS.CANCELLED } },
    );
    return null;
  }

  let task = await AdminTask.findOne({
    taskType: TASK_TYPE.KIT_ORDER_REVIEW,
    resourceId: order._id,
    status: { $in: OPEN_TASK_STATUSES },
  });

  if (task) return task;

  const kitName = order.kitSnapshot?.name || 'Driver kit';

  task = await AdminTask.create(
    baseTaskFields(
      TASK_TYPE.KIT_ORDER_REVIEW,
      order._id,
      null,
      `Approve kit order: ${order.orderNumber}`,
      `${kitName} — payment received, pending admin approval.`,
      {
        priority: 'high',
        activityLog: [
          {
            action: 'created',
            by: null,
            byName: 'System',
            note: 'Kit order paid — awaiting review',
            at: new Date(),
          },
        ],
      },
    ),
  );

  return task;
}

export async function syncAllOpenReviewTasksService() {
  const legacyTasks = await AdminTask.find({ category: { $exists: false } }).select('taskType');
  for (const task of legacyTasks) {
    const config = getTaskTypeConfig(task.taskType);
    if (config) {
      task.category = config.category;
      await task.save();
    }
  }

  const drivers = await Driver.find({ approvalStatus: 'under_review' }).select('name approvalStatus');
  const orders = await KitOrder.find({
    paymentStatus: PAYMENT_STATUS.PAID,
    adminStatus: KIT_ADMIN_STATUS.PENDING,
  });

  let created = 0;
  for (const driver of drivers) {
    const before = await AdminTask.countDocuments({
      taskType: TASK_TYPE.DRIVER_REVIEW,
      resourceId: driver._id,
      status: { $in: OPEN_TASK_STATUSES },
    });
    await upsertDriverReviewTask(driver);
    const after = await AdminTask.countDocuments({
      taskType: TASK_TYPE.DRIVER_REVIEW,
      resourceId: driver._id,
      status: { $in: OPEN_TASK_STATUSES },
    });
    if (after > before) created += 1;
  }

  for (const order of orders) {
    const before = await AdminTask.countDocuments({
      taskType: TASK_TYPE.KIT_ORDER_REVIEW,
      resourceId: order._id,
      status: { $in: OPEN_TASK_STATUSES },
    });
    await upsertKitOrderReviewTask(order);
    const after = await AdminTask.countDocuments({
      taskType: TASK_TYPE.KIT_ORDER_REVIEW,
      resourceId: order._id,
      status: { $in: OPEN_TASK_STATUSES },
    });
    if (after > before) created += 1;
  }

  return { drivers: drivers.length, kitOrders: orders.length, tasksCreated: created };
}
